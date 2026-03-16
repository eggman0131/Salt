/**
 * CofID Match Suggestion (PURE)
 *
 * Deterministic matching logic for suggesting CofID items as canon item sources.
 * All functions are synchronous, deterministic, and fully testable.
 */

import type { CofIDItem } from '../types';

export interface CofidMatch {
  status: 'auto' | 'manual';
  method: 'exact' | 'fuzzy' | 'semantic';
  score: number;
  matchedAt: string;
}

export interface SuggestedMatch {
  cofidId: string;
  name: string;
  score: number;
  method: 'exact' | 'fuzzy' | 'semantic';
  reason: string;
}

/**
 * Normalize a string for matching: lowercase, trim, remove extra spaces.
 */
export function normaliseForMatching(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Levenshtein distance for fuzzy matching.
 * Returns a score 0-1 where 1 is identical.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const norm_a = normaliseForMatching(a);
  const norm_b = normaliseForMatching(b);

  if (norm_a === norm_b) return 1;
  if (norm_a.length === 0 || norm_b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= norm_b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= norm_a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= norm_b.length; i++) {
    for (let j = 1; j <= norm_a.length; j++) {
      if (norm_b.charAt(i - 1) === norm_a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  const distance = matrix[norm_b.length][norm_a.length];
  const maxLength = Math.max(norm_a.length, norm_b.length);
  return 1 - distance / maxLength;
}

/**
 * Try exact match (normalized).
 */
export function tryExactMatch(
  canonName: string,
  cofidItem: CofIDItem
): SuggestedMatch | null {
  const normCanon = normaliseForMatching(canonName);
  const normCofid = normaliseForMatching(cofidItem.name);

  if (normCanon === normCofid) {
    return {
      cofidId: cofidItem.id,
      name: cofidItem.name,
      score: 1.0,
      method: 'exact',
      reason: 'Exact name match (normalized)',
    };
  }

  return null;
}

/**
 * Try fuzzy match if similarity is above threshold.
 * Threshold: 0.75 (75% similarity)
 */
export function tryFuzzyMatch(
  canonName: string,
  cofidItem: CofIDItem,
  threshold: number = 0.75
): SuggestedMatch | null {
  const normCanon = normaliseForMatching(canonName);
  const normCofid = normaliseForMatching(cofidItem.name);

  // Handle short search terms that are contained within a longer item name.
  // Example: "rice" should match "basmati rice".
  if (
    normCanon.length >= 3 &&
    (normCofid.includes(normCanon) || normCanon.includes(normCofid))
  ) {
    const containsScore = Math.max(
      0.8,
      Math.min(normCanon.length, normCofid.length) / Math.max(normCanon.length, normCofid.length)
    );

    if (containsScore < threshold) {
      return null;
    }

    return {
      cofidId: cofidItem.id,
      name: cofidItem.name,
      score: containsScore,
      method: 'fuzzy',
      reason: 'Token containment match',
    };
  }

  const similarity = levenshteinSimilarity(normCanon, normCofid);

  if (similarity >= threshold) {
    return {
      cofidId: cofidItem.id,
      name: cofidItem.name,
      score: similarity,
      method: 'fuzzy',
      reason: `Fuzzy match (${(similarity * 100).toFixed(0)}% similar)`,
    };
  }

  return null;
}

/**
 * Suggest a best CofID match for a canon item.
 *
 * Strategy:
 * 1. Try exact match first across all candidates
 * 2. Fall back to fuzzy (with threshold)
 * 3. Return best match or null
 *
 * No aisle filtering — CoFID food groups don't align cleanly with shopping
 * aisles, and filtering caused missed matches when the aisle assignment was
 * imprecise. Searching the full pool is fast enough locally.
 */
export function suggestBestMatch(
  canonName: string,
  candidates: CofIDItem[]
): SuggestedMatch | null {
  // Try exact match first
  for (const candidate of candidates) {
    const exactMatch = tryExactMatch(canonName, candidate);
    if (exactMatch) return exactMatch;
  }

  // Fall back to fuzzy
  let bestFuzzy: SuggestedMatch | null = null;
  for (const candidate of candidates) {
    const fuzzyMatch = tryFuzzyMatch(canonName, candidate);
    if (fuzzyMatch && (!bestFuzzy || fuzzyMatch.score > bestFuzzy.score)) {
      bestFuzzy = fuzzyMatch;
    }
  }

  return bestFuzzy;
}

/**
 * Get top N candidates ranked by score across all CoFID items.
 * Includes both exact and fuzzy matches.
 * No aisle filtering — see suggestBestMatch for rationale.
 */
export function rankCandidates(
  canonName: string,
  candidates: CofIDItem[],
  limit: number = 5
): SuggestedMatch[] {
  const matches: SuggestedMatch[] = [];

  for (const candidate of candidates) {
    const exactMatch = tryExactMatch(canonName, candidate);
    if (exactMatch) {
      matches.push(exactMatch);
      continue;
    }
    const fuzzyMatch = tryFuzzyMatch(canonName, candidate, 0.6);
    if (fuzzyMatch) {
      matches.push(fuzzyMatch);
    }
  }

  // Sort by score descending, then exact before fuzzy
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.method === 'exact' ? 1 : 0) - (a.method === 'exact' ? 1 : 0);
  });

  return matches.slice(0, limit);
}

/**
 * Build a CofidMatch object for storage.
 * Called when a match is confirmed or auto-suggested.
 */
export function buildCofidMatch(
  match: SuggestedMatch,
  status: 'auto' | 'manual' = 'auto'
): CofidMatch {
  return {
    status,
    method: match.method,
    score: match.score,
    matchedAt: new Date().toISOString(),
  };
}
