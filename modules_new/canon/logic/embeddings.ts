/**
 * Embedding-based Semantic Matching (PURE)
 *
 * Cosine similarity calculation, aisle-bounded candidate selection, and tie-breaking
 * for semantic matching using vector embeddings.
 * All functions are synchronous, deterministic, and fully testable.
 */

import type { CanonEmbeddingLookup } from '../../../types/contract';

export interface SemanticMatch {
  refId: string;
  kind: 'cofid' | 'canon';
  name: string;
  aisleId: string;
  similarity: number; // 0-1 cosine similarity score
  reason: string;
}

/**
 * Calculate cosine similarity between two embeddings.
 * Returns a score 0-1 where 1 is identical direction.
 * 
 * Formula: cos(θ) = (A · B) / (||A|| * ||B||)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  const similarity = dotProduct / (normA * normB);

  // Clamp to [0, 1] range (cosine can be negative, but we only care about positive similarity)
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Find semantic matches for a query embedding against a pool of candidates.
 * Returns matches above the threshold, sorted by similarity descending.
 * 
 * Args:
 *   - queryEmbedding: The embedding to search for
 *   - candidates: Pool of embedding lookup entries
 *   - aisleId: Optional aisle ID to filter candidates (aisle-bounded search)
 *   - threshold: Minimum similarity score (default: 0.7)
 *   - limit: Maximum number of results (default: 5)
 * 
 * Returns:
 *   - Array of SemanticMatch objects sorted by similarity descending
 */
export function findSemanticMatches(
  queryEmbedding: number[],
  candidates: CanonEmbeddingLookup[],
  aisleId?: string,
  threshold: number = 0.7,
  limit: number = 5
): SemanticMatch[] {
  // Filter by aisle if specified (aisle-bounded search)
  const filtered = aisleId
    ? candidates.filter(c => c.aisleId === aisleId)
    : candidates;

  const matches: SemanticMatch[] = [];

  for (const candidate of filtered) {
    const similarity = cosineSimilarity(queryEmbedding, candidate.embedding);

    if (similarity >= threshold) {
      matches.push({
        refId: candidate.refId,
        kind: candidate.kind,
        name: candidate.name,
        aisleId: candidate.aisleId,
        similarity,
        reason: `Semantic match (${(similarity * 100).toFixed(1)}% similar)`,
      });
    }
  }

  // Sort by similarity descending, then by kind (prefer cofid over canon for tie-breaking)
  matches.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    // Tie-break: CofID items preferred (more authoritative)
    return (b.kind === 'cofid' ? 1 : 0) - (a.kind === 'cofid' ? 1 : 0);
  });

  return matches.slice(0, limit);
}

/**
 * Get the best semantic match (highest similarity).
 * Returns null if no match above threshold.
 */
export function getBestSemanticMatch(
  queryEmbedding: number[],
  candidates: CanonEmbeddingLookup[],
  aisleId?: string,
  threshold: number = 0.7
): SemanticMatch | null {
  const matches = findSemanticMatches(queryEmbedding, candidates, aisleId, threshold, 1);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Calculate embedding coverage statistics.
 * Returns percentage and counts of embedded vs total items.
 */
export function calculateCoverageStats(
  totalItems: number,
  embeddedItems: number
): {
  percentage: number;
  embedded: number;
  total: number;
  missing: number;
} {
  return {
    percentage: totalItems > 0 ? (embeddedItems / totalItems) * 100 : 0,
    embedded: embeddedItems,
    total: totalItems,
    missing: Math.max(0, totalItems - embeddedItems),
  };
}

/**
 * Group embedding coverage by aisle.
 * Useful for dashboard display.
 */
export function groupCoverageByAisle(
  embeddings: CanonEmbeddingLookup[]
): Record<string, { kind: string; count: number }[]> {
  const byAisle: Record<string, { kind: string; count: number }[]> = {};

  for (const emb of embeddings) {
    if (!byAisle[emb.aisleId]) {
      byAisle[emb.aisleId] = [];
    }

    const existing = byAisle[emb.aisleId].find(g => g.kind === emb.kind);
    if (existing) {
      existing.count++;
    } else {
      byAisle[emb.aisleId].push({ kind: emb.kind, count: 1 });
    }
  }

  return byAisle;
}

/**
 * Validate embedding dimension and model match.
 * Returns true if embedding is valid for the specified model and dimension.
 */
export function validateEmbedding(
  embedding: number[],
  expectedDim: number = 768,
  expectedModel: string = 'text-embedding-005'
): { valid: boolean; reason?: string } {
  if (!embedding || embedding.length === 0) {
    return { valid: false, reason: 'Embedding is empty' };
  }

  if (embedding.length !== expectedDim) {
    return {
      valid: false,
      reason: `Embedding dimension mismatch: expected ${expectedDim}, got ${embedding.length}`,
    };
  }

  // Check if all values are numbers and not NaN
  if (embedding.some(v => typeof v !== 'number' || isNaN(v))) {
    return { valid: false, reason: 'Embedding contains invalid values' };
  }

  return { valid: true };
}
