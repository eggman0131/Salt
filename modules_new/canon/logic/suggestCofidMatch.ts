/**
 * CofID Match Suggestion (PURE)
 *
 * Deterministic matching logic for suggesting CofID items as canon item sources.
 * All functions are synchronous, deterministic, and fully testable.
 */

import { CofidMatch } from './items';
import type { CofIDItem } from '../../../types/contract';

export interface SuggestedMatch {
  cofidId: string;
  name: string;
  score: number;
  method: 'exact' | 'fuzzy';
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
  const similarity = levenshteinSimilarity(canonName, cofidItem.name);

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
 * 1. Filter candidates to same aisle only (aisle-bounded)
 * 2. Try exact match first
 * 3. If no exact, try fuzzy (with threshold)
 * 4. Return best match or null
 * 
 * Args:
 *   - canonName: The canon item name
 *   - canonAisleId: The canon aisle ID
 *   - candidates: Pool of CofID items (already filtered if possible)
 *   - aisleMapping: Map of CofID aisle ID → canon aisle ID (for filtering)
 * 
 * Returns:
 *   - Best match with score and method, or null if no good match
 */
export function suggestBestMatch(
  canonName: string,
  canonAisleId: string,
  candidates: CofIDItem[],
  aisleMapping: Record<CofIDItem['id'], string>
): SuggestedMatch | null {
  // Filter to same aisle only (aisle-bounded search)
  const aisleFiltered = candidates.filter(c => {
    const mappedAisleId = aisleMapping[c.id];
    return mappedAisleId === canonAisleId;
  });

  // Try exact match first
  for (const candidate of aisleFiltered) {
    const exactMatch = tryExactMatch(canonName, candidate);
    if (exactMatch) {
      return exactMatch;
    }
  }

  // Fall back to fuzzy
  let bestFuzzy: SuggestedMatch | null = null;
  for (const candidate of aisleFiltered) {
    const fuzzyMatch = tryFuzzyMatch(canonName, candidate);
    if (fuzzyMatch && (!bestFuzzy || fuzzyMatch.score > bestFuzzy.score)) {
      bestFuzzy = fuzzyMatch;
    }
  }

  return bestFuzzy;
}

/**
 * Get top N candidates ranked by score.
 * Includes both exact and fuzzy matches.
 */
export function rankCandidates(
  canonName: string,
  candidates: CofIDItem[],
  aisleMapping: Record<CofIDItem['id'], string>,
  limit: number = 5
): SuggestedMatch[] {
  const matches: SuggestedMatch[] = [];

  // Collect exact matches
  for (const candidate of candidates) {
    const exactMatch = tryExactMatch(canonName, candidate);
    if (exactMatch) {
      matches.push(exactMatch);
    }
  }

  // Collect fuzzy matches (with lower threshold for ranking)
  for (const candidate of candidates) {
    if (tryExactMatch(canonName, candidate)) continue; // Skip if already exact
    const fuzzyMatch = tryFuzzyMatch(canonName, candidate, 0.6);
    if (fuzzyMatch) {
      matches.push(fuzzyMatch);
    }
  }

  // Sort by score descending, then by method (exact before fuzzy)
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
  status: 'auto' | 'manual' = 'auto',
  candidates?: SuggestedMatch[]
): CofidMatch {
  return {
    status,
    method: match.method,
    score: match.score,
    matchedAt: new Date().toISOString(),
    candidates: candidates?.map(c => ({
      cofidId: c.cofidId,
      name: c.name,
      score: c.score,
      method: c.method,
    })),
  };
}
