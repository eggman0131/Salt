/**
 * Semantic Matching Utility
 *
 * Implements vector-based similarity operations for embedding-powered ingredient matching.
 * Used in Phase 2 of the Issue #68 semantic matching pipeline.
 */

import { CanonicalItem } from '../../../types/contract';

/**
 * Computes cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical direction.
 * For embeddings, typically only compare magnitude (both positive), so 0-1 range.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) return 0;

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Represents a scored item candidate with similarity information
 */
export interface SemanticCandidate {
  itemId: string;
  itemName: string;
  score: number; // 0-1 cosine similarity score
  synonyms?: string[];
  externalSources?: Array<{ source: string; externalId: string }>;
}

/**
 * Normalizes embedding from various storage formats (array or object-indexed)
 * Firestore may return embeddings as arrays or as objects with numeric keys
 */
export function normalizeEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /^\d+$/.test(key))
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, item]) => item)
      .filter((item): item is number => typeof item === 'number' && Number.isFinite(item));

    if (entries.length > 0) {
      return entries;
    }
  }

  return [];
}

/**
 * Searches canonical items by semantic similarity to the given query embedding.
 * Returns ranked candidates sorted by descending similarity score.
 *
 * @param queryEmbedding - The embedding vector to search for
 * @param canonicalItems - The item pool to search
 * @param maxCandidates - Maximum number of candidates to return (ordered by score)
 * @param minScore - Minimum similarity score threshold (0-1)
 */
export function searchBySemantic(
  queryEmbedding: number[],
  canonicalItems: CanonicalItem[],
  maxCandidates: number = 5,
  minScore: number = 0
): SemanticCandidate[] {
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  const candidates: SemanticCandidate[] = [];

  for (const item of canonicalItems) {
    // Skip items without embeddings
    if (!item.embedding) continue;

    const itemEmbedding = normalizeEmbedding(item.embedding);
    if (itemEmbedding.length === 0) continue;

    // Compute similarity
    const score = cosineSimilarity(queryEmbedding, itemEmbedding);

    // Apply threshold
    if (score >= minScore) {
      candidates.push({
        itemId: item.id,
        itemName: item.name,
        score,
        synonyms: item.synonyms,
        externalSources: item.externalSources,
      });
    }
  }

  // Sort by descending score and limit
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);
}

/**
 * Analyzes a cluster of candidates with similar scores
 * Used to detect ambiguous matches where multiple items have similar confidence
 *
 * @param candidates - Sorted candidates (highest score first)
 * @param gapThreshold - Minimum score gap between items to consider distinct
 * @param clusterWindow - Maximum score difference within a cluster
 */
export interface ScoreCluster {
  topScore: number;
  topCandidates: SemanticCandidate[]; // Items within clusterWindow of top score
  nextScore: number | null; // Score of first item outside cluster
  scoreGap: number; // Difference between top score and second-tier candidates
  isAmbiguous: boolean; // True if gap < gapThreshold
  clusterSize: number;
}

export function analyzeScoreClusters(
  candidates: SemanticCandidate[],
  gapThreshold: number = 0.10,
  clusterWindow: number = 0.05
): ScoreCluster {
  const result: ScoreCluster = {
    topScore: 0,
    topCandidates: [],
    nextScore: null,
    scoreGap: 1,
    isAmbiguous: false,
    clusterSize: 0,
  };

  if (candidates.length === 0) {
    return result;
  }

  result.topScore = candidates[0].score;

  // Find all candidates within the cluster window of top score
  for (const candidate of candidates) {
    const diff = result.topScore - candidate.score;
    if (diff <= clusterWindow) {
      result.topCandidates.push(candidate);
    } else {
      result.nextScore = candidate.score;
      break;
    }
  }

  result.clusterSize = result.topCandidates.length;

  // Compute score gap to next tier
  if (result.nextScore !== null) {
    result.scoreGap = result.topScore - result.nextScore;
  }

  // Ambiguous if gap is below threshold (too close to next option)
  result.isAmbiguous = result.scoreGap < gapThreshold;

  return result;
}

/**
 * Filters candidates based on high/low confidence thresholds
 * Used in Phase 2 decision logic:
 * - highThreshold: Accept immediately (high confidence)
 * - lowThreshold: Requires LLM arbitration (weak match)
 * - Between: Potential candidates worth exploring
 */
export function categorizeByConfidence(
  candidates: SemanticCandidate[],
  highThreshold: number = 0.90,
  lowThreshold: number = 0.70
): {
  highConfidence: SemanticCandidate[];
  candidates: SemanticCandidate[];
  lowConfidence: SemanticCandidate[];
} {
  return {
    highConfidence: candidates.filter((c) => c.score >= highThreshold),
    candidates: candidates.filter((c) => c.score >= lowThreshold && c.score < highThreshold),
    lowConfidence: candidates.filter((c) => c.score < lowThreshold),
  };
}
