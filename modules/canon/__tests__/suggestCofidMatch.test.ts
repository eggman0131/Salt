/**
 * CofID Match Suggestion Tests
 *
 * Test deterministic matching logic for CofID suggestions.
 */

import { describe, it, expect } from 'vitest';
import {
  normaliseForMatching,
  levenshteinSimilarity,
  tryExactMatch,
  tryFuzzyMatch,
  suggestBestMatch,
  rankCandidates,
  buildCofidMatch,
} from '../logic/suggestCofidMatch';
import type { CofIDItem } from '../types';

const mockCofidItems = (aisle: string = 'produce'): CofIDItem[] => [
  {
    id: 'cofid_001',
    name: 'Chicken Breast',
    group: 'FA',
    importedAt: '2026-03-04T00:00:00Z',
    nutrients: {},
  },
  {
    id: 'cofid_002',
    name: 'Chicken Thigh',
    group: 'FA',
    importedAt: '2026-03-04T00:00:00Z',
    nutrients: {},
  },
  {
    id: 'cofid_003',
    name: 'Apple',
    group: 'AA',
    importedAt: '2026-03-04T00:00:00Z',
    nutrients: {},
  },
  {
    id: 'cofid_004',
    name: 'Orange',
    group: 'AA',
    importedAt: '2026-03-04T00:00:00Z',
    nutrients: {},
  },
];

describe('CofID Match Suggestion', () => {
  describe('normaliseForMatching', () => {
    it('should lowercase and trim', () => {
      expect(normaliseForMatching('  CHICKEN  ')).toBe('chicken');
    });

    it('should collapse whitespace', () => {
      expect(normaliseForMatching('Chicken   Breast')).toBe('chicken breast');
    });

    it('should handle mixed case', () => {
      expect(normaliseForMatching('ChIcKeN BrEaSt')).toBe('chicken breast');
    });
  });

  describe('levenshteinSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(levenshteinSimilarity('apple', 'apple')).toBe(1);
    });

    it('should handle normalized matching', () => {
      expect(levenshteinSimilarity('APPLE', 'apple')).toBe(1);
    });

    it('should score close strings high', () => {
      const score = levenshteinSimilarity('chicken breast', 'chicken');
      expect(score).toBeGreaterThanOrEqual(0.5);
    });

    it('should score distant strings low', () => {
      const score = levenshteinSimilarity('apple', 'steak');
      expect(score).toBeLessThan(0.4);
    });

    it('should return 0 for empty string vs non-empty', () => {
      expect(levenshteinSimilarity('', 'apple')).toBe(0);
    });
  });

  describe('tryExactMatch', () => {
    it('should match identical names (normalized)', () => {
      const items = mockCofidItems();
      const match = tryExactMatch('Chicken Breast', items[0]);
      expect(match).not.toBeNull();
      expect(match?.score).toBe(1.0);
      expect(match?.method).toBe('exact');
    });

    it('should match case-insensitively', () => {
      const items = mockCofidItems();
      const match = tryExactMatch('CHICKEN BREAST', items[0]);
      expect(match).not.toBeNull();
    });

    it('should return null for non-matches', () => {
      const items = mockCofidItems();
      const match = tryExactMatch('Not A Match', items[0]);
      expect(match).toBeNull();
    });
  });

  describe('tryFuzzyMatch', () => {
    it('should fuzzy match above threshold', () => {
      const items = mockCofidItems();
      // "chicken breast" vs "Chicken Breast" - same words, different case - should pass 0.75 threshold
      const match = tryFuzzyMatch('chicken breast', items[0]); // items[0] is "Chicken Breast"
      expect(match).not.toBeNull();
      expect(match?.score).toBeGreaterThan(0.75);
      expect(match?.method).toBe('fuzzy');
    });

    it('should return null below threshold', () => {
      const items = mockCofidItems();
      const match = tryFuzzyMatch('Pizza', items[0]);
      expect(match).toBeNull();
    });

    it('should respect custom threshold', () => {
      const items = mockCofidItems();
      const match = tryFuzzyMatch('Chicken', items[0], 0.95);
      expect(match).toBeNull(); // Too strict
    });

    it('should match short contained terms like rice in basmati rice', () => {
      const riceItem: CofIDItem = {
        id: 'cofid_rice_001',
        name: 'Basmati Rice',
        group: 'AC',
        importedAt: '2026-03-04T00:00:00Z',
        nutrients: {},
      };

      const match = tryFuzzyMatch('Rice', riceItem);
      expect(match).not.toBeNull();
      expect(match?.score).toBeGreaterThanOrEqual(0.8);
      expect(match?.reason).toBe('Token containment match');
    });
  });

  describe('suggestBestMatch', () => {
    it('should prefer exact match in aisle', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };

      const match = suggestBestMatch('Chicken Breast', 'meat-fish', items, mapping);
      expect(match).not.toBeNull();
      expect(match?.method).toBe('exact');
    });

    it('should fall back to fuzzy match', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };

      // "Chicken Thighs" (plural) vs "Chicken Thigh" (singular) - should fuzzy match
      const match = suggestBestMatch('Chicken Thighs', 'meat-fish', items, mapping);
      expect(match).not.toBeNull();
      expect(match?.method).toBe('fuzzy');
    });

    it('should filter by aisle only', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };

      // Try to match "Apple" in meat-fish aisle (should fail)
      const match = suggestBestMatch('Apple', 'meat-fish', items, mapping);
      expect(match).toBeNull();
    });

    it('should return null for no good match', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };

      const match = suggestBestMatch('Completely Different Item', 'meat-fish', items, mapping);
      expect(match).toBeNull();
    });
  });

  describe('rankCandidates', () => {
    it('should rank exact matches highest', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };
      const candidates = rankCandidates('Apple', 'produce', items, mapping);
      
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].method).toBe('exact');
      expect(candidates[0].cofidId).toBe('cofid_003');
    });

    it('should include fuzzy matches below exact', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };
      // "chicken breasts" (plural) vs "Chicken Breast" - fuzzy match with 0.6 threshold
      const candidates = rankCandidates('chicken breasts', 'meat-fish', items, mapping);
      
      // Should have at least one match for "Chicken Breast"  
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      // First should be the fuzzy match
      const firstCandidate = candidates[0];
      expect(firstCandidate.cofidId).toBe('cofid_001');
    });

    it('should respect limit', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };
      const candidates = rankCandidates('Chicken', 'meat-fish', items, mapping, 2);
      expect(candidates.length).toBeLessThanOrEqual(2);
    });

    it('should sort by score descending', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };
      const candidates = rankCandidates('Chicken', 'meat-fish', items, mapping, 10);
      
      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i].score).toBeLessThanOrEqual(candidates[i - 1].score);
      }
    });

    it('should only include candidates from the same aisle', () => {
      const items = mockCofidItems();
      const mapping: Record<string, string> = {
        cofid_001: 'meat-fish',
        cofid_002: 'meat-fish',
        cofid_003: 'produce',
        cofid_004: 'produce',
      };

      const candidates = rankCandidates('Apple', 'meat-fish', items, mapping, 10);
      expect(candidates.length).toBe(0);
    });
  });

  describe('buildCofidMatch', () => {
    it('should create match object with auto status', () => {
      const suggestedMatch = {
        cofidId: 'cofid_001',
        name: 'Chicken Breast',
        score: 0.95,
        method: 'exact' as const,
        reason: 'Test match',
      };

      const match = buildCofidMatch(suggestedMatch);
      expect(match.status).toBe('auto');
      expect(match.method).toBe('exact');
      expect(match.score).toBe(0.95);
      expect(match.matchedAt).toBeDefined();
    });

    it('should create match with manual status', () => {
      const suggestedMatch = {
        cofidId: 'cofid_001',
        name: 'Chicken Breast',
        score: 0.95,
        method: 'fuzzy' as const,
        reason: 'Test match',
      };

      const match = buildCofidMatch(suggestedMatch, 'manual');
      expect(match.status).toBe('manual');
    });

    it('should not persist candidates in stored metadata', () => {
      const suggestedMatch = {
        cofidId: 'cofid_001',
        name: 'Chicken Breast',
        score: 0.95,
        method: 'exact' as const,
        reason: 'Test match',
      };

      const match = buildCofidMatch(suggestedMatch, 'auto');
      expect(match.candidates).toBeUndefined();
    });
  });
});
