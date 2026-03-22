/**
 * Ingredient Matching Pipeline (PR8)
 *
 * Orchestrates fuzzy + semantic matching to find the best canon item for a recipe ingredient.
 * Pure logic layer — all I/O happens in the data layer.
 *
 * Pipeline:
 * 1. Fuzzy matching (exact + Levenshtein) against existing canon items
 * 2. Semantic matching (cosine similarity) via embeddings if available
 * 3. Decision: auto-link, manual review, or create new canon item
 */

import type { CanonItem } from './items';
import type { CanonEmbeddingLookup } from '../types';
import { levenshteinSimilarity, normaliseForMatching } from './suggestCofidMatch';
import { cosineSimilarity, findSemanticMatches, type SemanticMatch } from './embeddings';

/** Match result with decision */
export interface IngredientMatchResult {
  decision: 'use_existing_canon' | 'create_new_canon' | 'no_match';
  canonItemId?: string; // Set if decision === 'use_existing_canon'
  matchedSource: 'canon-fuzzy' | 'canon-semantic' | 'unlinked';
  stage: 'fuzzy' | 'semantic';
  topScore: number;
  scoreGap: number; // Difference between top and second match
  reason: string;
  candidates: MatchCandidate[];
  staleEmbeddingIds: string[]; // Embedding IDs referencing deleted canon items (caller should clean up)
  timingsMs: {
    lexical: number;
    semantic: number;
    merge: number;
    decision: number;
    total: number;
  };
}

export interface MatchCandidate {
  canonItemId: string;
  name: string;
  score: number;
  method: 'exact' | 'fuzzy' | 'semantic';
  reason: string;
}

/** Thresholds for auto-linking decisions */
const AUTO_LINK_THRESHOLD = 0.85; // Auto-link if top score >= 85%
const FUZZY_THRESHOLD = 0.75; // Minimum for fuzzy matching
const SEMANTIC_THRESHOLD = 0.70; // Minimum for semantic matching
const MIN_SCORE_GAP = 0.15; // Minimum gap between top and second match for auto-link

/**
 * Try exact fuzzy match (normalized comparison).
 */
function tryExactFuzzyMatch(
  ingredientName: string,
  canonItems: CanonItem[],
  aisleId?: string
): MatchCandidate | null {
  const normIngredient = normaliseForMatching(ingredientName);

  // Filter by aisle if provided
  const filtered = aisleId
    ? canonItems.filter(item => item.aisleId === aisleId)
    : canonItems;

  for (const item of filtered) {
    const normCanon = normaliseForMatching(item.name);
    if (normIngredient === normCanon) {
      return {
        canonItemId: item.id,
        name: item.name,
        score: 1.0,
        method: 'exact',
        reason: 'Exact name match (normalized)',
      };
    }
  }

  return null;
}

/**
 * Try fuzzy matching using Levenshtein similarity.
 * Returns top N candidates above threshold.
 */
function tryFuzzyMatching(
  ingredientName: string,
  canonItems: CanonItem[],
  aisleId?: string,
  threshold: number = FUZZY_THRESHOLD,
  limit: number = 5
): MatchCandidate[] {
  // Filter by aisle if provided
  const filtered = aisleId
    ? canonItems.filter(item => item.aisleId === aisleId)
    : canonItems;

  const matches: MatchCandidate[] = [];

  for (const item of filtered) {
    const similarity = levenshteinSimilarity(ingredientName, item.name);
    if (similarity >= threshold) {
      matches.push({
        canonItemId: item.id,
        name: item.name,
        score: similarity,
        method: similarity === 1.0 ? 'exact' : 'fuzzy',
        reason: `Fuzzy match (${(similarity * 100).toFixed(0)}% similar)`,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit);
}

/**
 * Try semantic matching using embeddings.
 * Returns top N candidates above threshold.
 */
function trySemanticMatching(
  queryEmbedding: number[],
  embeddingLookup: CanonEmbeddingLookup[],
  aisleId?: string,
  threshold: number = SEMANTIC_THRESHOLD,
  limit: number = 5
): MatchCandidate[] {
  const matches = findSemanticMatches(
    queryEmbedding,
    embeddingLookup,
    aisleId,
    threshold,
    limit
  );

  // Convert SemanticMatch to MatchCandidate
  return matches
    .filter(m => m.kind === 'canon') // Only canon items (not CofID)
    .map(m => ({
      canonItemId: m.refId,
      name: m.name,
      score: m.similarity,
      method: 'semantic' as const,
      reason: m.reason,
    }));
}

/**
 * Merge and rank candidates from fuzzy and semantic matching.
 * Deduplicates by canonItemId, keeping the best score.
 */
function mergeAndRankCandidates(
  fuzzyCandidates: MatchCandidate[],
  semanticCandidates: MatchCandidate[]
): MatchCandidate[] {
  const candidateMap = new Map<string, MatchCandidate>();

  // Add fuzzy candidates
  for (const candidate of fuzzyCandidates) {
    candidateMap.set(candidate.canonItemId, candidate);
  }

  // Merge semantic candidates (keep best score)
  for (const candidate of semanticCandidates) {
    const existing = candidateMap.get(candidate.canonItemId);
    if (!existing || candidate.score > existing.score) {
      candidateMap.set(candidate.canonItemId, candidate);
    }
  }

  // Sort by score descending
  const merged = Array.from(candidateMap.values());
  merged.sort((a, b) => b.score - a.score);

  return merged;
}

/**
 * Decide whether to auto-link based on top match score and gap.
 *
 * Auto-link if:
 * - Top score >= AUTO_LINK_THRESHOLD (85%)
 * - Score gap >= MIN_SCORE_GAP (15%) OR only one candidate
 */
function shouldAutoLink(candidates: MatchCandidate[]): boolean {
  if (candidates.length === 0) return false;

  const topScore = candidates[0].score;
  if (topScore < AUTO_LINK_THRESHOLD) return false;

  // Exact name match (score == 1.0) is unambiguous — skip the gap check.
  // As the canon grows, semantic search returns many near-neighbours that
  // tighten the gap and would otherwise block obvious matches.
  if (topScore === 1.0) return true;

  // If only one candidate, auto-link
  if (candidates.length === 1) return true;

  // Check score gap
  const secondScore = candidates[1].score;
  const scoreGap = topScore - secondScore;

  return scoreGap >= MIN_SCORE_GAP;
}

/**
 * Match a recipe ingredient to an existing canon item.
 *
 * Pipeline:
 * 1. Fuzzy matching (exact + Levenshtein)
 * 2. Semantic matching (if embedding provided)
 * 3. Merge and rank candidates
 * 4. Decide: auto-link, create new, or no match
 *
 * Args:
 *   - ingredientName: The ingredient name from recipe
 *   - canonItems: Pool of existing canon items
 *   - embeddingLookup: Embedding lookup table (optional)
 *   - queryEmbedding: Embedding for the ingredient (optional)
 *   - aisleId: Optional aisle ID for aisle-bounded search
 *
 * Returns:
 *   - IngredientMatchResult with decision and audit trail
 */
export function matchIngredientToCanonItem(
  ingredientName: string,
  canonItems: CanonItem[],
  embeddingLookup?: CanonEmbeddingLookup[],
  queryEmbedding?: number[],
  aisleId?: string
): IngredientMatchResult {
  const totalStart = performance.now();

  // Stage 1: Fuzzy matching
  const lexicalStart = performance.now();
  const fuzzyCandidates = tryFuzzyMatching(ingredientName, canonItems, aisleId);
  const lexicalDuration = performance.now() - lexicalStart;

  // Stage 2: Semantic matching (if embeddings available)
  let semanticCandidates: MatchCandidate[] = [];
  const semanticStart = performance.now();
  if (embeddingLookup && queryEmbedding) {
    semanticCandidates = trySemanticMatching(queryEmbedding, embeddingLookup, aisleId);
  }
  const semanticDuration = performance.now() - semanticStart;

  // Filter semantic candidates to only include IDs that exist in the current canon items list.
  // The embedding lookup can contain stale entries for deleted canon items.
  const canonItemIds = new Set(canonItems.map(item => item.id));
  const staleEmbeddingIds = semanticCandidates
    .filter(c => !canonItemIds.has(c.canonItemId))
    .map(c => c.canonItemId);
  const validSemanticCandidates = semanticCandidates.filter(c => canonItemIds.has(c.canonItemId));

  // Merge candidates
  const mergeStart = performance.now();
  const allCandidates = mergeAndRankCandidates(fuzzyCandidates, validSemanticCandidates);
  const mergeDuration = performance.now() - mergeStart;

  const decisionStart = performance.now();

  // No candidates found
  if (allCandidates.length === 0) {
    const decisionDuration = performance.now() - decisionStart;
    const totalDuration = performance.now() - totalStart;
    return {
      decision: 'create_new_canon',
      matchedSource: 'unlinked',
      stage: queryEmbedding ? 'semantic' : 'fuzzy',
      topScore: 0,
      scoreGap: 0,
      reason: 'No matching canon items found',
      candidates: [],
      staleEmbeddingIds,
      timingsMs: {
        lexical: lexicalDuration,
        semantic: semanticDuration,
        merge: mergeDuration,
        decision: decisionDuration,
        total: totalDuration,
      },
    };
  }

  // Calculate score gap
  const topScore = allCandidates[0].score;
  const secondScore = allCandidates.length > 1 ? allCandidates[1].score : 0;
  const scoreGap = topScore - secondScore;

  // Decide: auto-link or create new
  const autoLink = shouldAutoLink(allCandidates);

  if (autoLink) {
    const decisionDuration = performance.now() - decisionStart;
    const totalDuration = performance.now() - totalStart;
    return {
      decision: 'use_existing_canon',
      canonItemId: allCandidates[0].canonItemId,
      matchedSource:
        allCandidates[0].method === 'semantic' ? 'canon-semantic' : 'canon-fuzzy',
      stage: queryEmbedding && semanticCandidates.length > 0 ? 'semantic' : 'fuzzy',
      topScore,
      scoreGap,
      reason: `Auto-linked: ${allCandidates[0].reason} (gap: ${(scoreGap * 100).toFixed(0)}%)`,
      candidates: allCandidates,
      staleEmbeddingIds,
      timingsMs: {
        lexical: lexicalDuration,
        semantic: semanticDuration,
        merge: mergeDuration,
        decision: decisionDuration,
        total: totalDuration,
      },
    };
  } else {
    const decisionDuration = performance.now() - decisionStart;
    const totalDuration = performance.now() - totalStart;
    return {
      decision: 'create_new_canon',
      matchedSource: 'unlinked',
      stage: queryEmbedding && semanticCandidates.length > 0 ? 'semantic' : 'fuzzy',
      topScore,
      scoreGap,
      reason: `Match ambiguous (top: ${(topScore * 100).toFixed(0)}%, gap: ${(scoreGap * 100).toFixed(0)}%) — creating pending item`,
      candidates: allCandidates,
      staleEmbeddingIds,
      timingsMs: {
        lexical: lexicalDuration,
        semantic: semanticDuration,
        merge: mergeDuration,
        decision: decisionDuration,
        total: totalDuration,
      },
    };
  }
}
