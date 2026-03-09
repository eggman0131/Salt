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
    it('should prefer exact match', () => {
      const match = suggestBestMatch('Chicken Breast', mockCofidItems());
      expect(match).not.toBeNull();
      expect(match?.method).toBe('exact');
    });

    it('should fall back to fuzzy match', () => {
      // "Chicken Thighs" (plural) vs "Chicken Thigh" (singular)
      const match = suggestBestMatch('Chicken Thighs', mockCofidItems());
      expect(match).not.toBeNull();
      expect(match?.method).toBe('fuzzy');
    });

    it('should find matches across all items regardless of category', () => {
      // "Apple" is in produce group — should now be found even when searching with no aisle filter
      const match = suggestBestMatch('Apple', mockCofidItems());
      expect(match).not.toBeNull();
      expect(match?.cofidId).toBe('cofid_003');
    });

    it('should return null for no good match', () => {
      const match = suggestBestMatch('Completely Different Item', mockCofidItems());
      expect(match).toBeNull();
    });
  });

  describe('rankCandidates', () => {
    it('should rank exact matches highest', () => {
      const candidates = rankCandidates('Apple', mockCofidItems());
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].method).toBe('exact');
      expect(candidates[0].cofidId).toBe('cofid_003');
    });

    it('should include fuzzy matches', () => {
      // "chicken breasts" (plural) vs "Chicken Breast" - fuzzy match with 0.6 threshold
      const candidates = rankCandidates('chicken breasts', mockCofidItems());
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates[0].cofidId).toBe('cofid_001');
    });

    it('should find candidates across all groups, not just one aisle', () => {
      // "Apple" is produce; "Chicken Breast" is meat — both should appear in a broad search
      const candidates = rankCandidates('Apple', mockCofidItems(), 10);
      const ids = candidates.map(c => c.cofidId);
      expect(ids).toContain('cofid_003'); // Apple (produce)
    });

    it('should respect limit', () => {
      const candidates = rankCandidates('Chicken', mockCofidItems(), 2);
      expect(candidates.length).toBeLessThanOrEqual(2);
    });

    it('should sort by score descending', () => {
      const candidates = rankCandidates('Chicken', mockCofidItems(), 10);
      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i].score).toBeLessThanOrEqual(candidates[i - 1].score);
      }
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
