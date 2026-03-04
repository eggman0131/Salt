/**
 * Canon Module — Module-specific types
 *
 * Only types that are specific to this module and not already
 * defined in types/contract.ts belong here.
 */

/** Result of sortAisles / sortUnits helpers */
export type SortOrder = number;

/** Grouped units by category */
export type UnitsByCategory = {
  weight: import('../../../types/contract').Unit[];
  volume: import('../../../types/contract').Unit[];
  count: import('../../../types/contract').Unit[];
  colloquial: import('../../../types/contract').Unit[];
};

/** Result of an aisle name lookup */
export type AisleLookupResult =
  | { found: true; aisle: import('../../../types/contract').Aisle }
  | { found: false };

/** Result of a unit lookup */
export type UnitLookupResult =
  | { found: true; unit: import('../../../types/contract').Unit }
  | { found: false };

// ── PR4-A: AI Parse Types ────────────────────────────────────────────────────

/** Reference to a canonical aisle (used in parse results) */
export interface AisleRef {
  id: string;
  name: string;
}

/** Reference to a canonical unit (used in parse results) */
export interface UnitRef {
  id: string;
  name: string;
}

/** Single ingredient parse result from AI */
export interface AiSingleParseResult {
  index: number;
  originalLine: string;
  itemName: string;
  quantity: number | null;
  recipeUnitId: string | null;
  aisleId: string;
  suggestedAisleName?: string;
  preparations: string[];
  notes: string[];
}

/** AI parse response from Cloud Function */
export interface AiParseResponse {
  success: boolean;
  message?: string;
  data?: {
    results: AiSingleParseResult[];
  };
}

/** Validation flags on a parsed result */
export type ReviewFlag =
  | 'invalid-aisle-id-repaired'
  | 'invalid-unit-id-repaired'
  | 'missing-aisle-suggestion'
  | 'index-mismatch'
  | 'index-duplicate'
  | 'data-repaired';

/** Validated and potentially repaired parse result */
export interface ValidatedParseResult extends AiSingleParseResult {
  reviewFlags: ReviewFlag[];
}

/** Batch parse response after validation */
export interface BatchParseResponse {
  totalCount: number;
  successCount: number;
  hasErrors: boolean;
  hasReviewFlags: boolean;
  results: ValidatedParseResult[];
  errors?: string[];
}

/** System fallback aisle */
export const UNCATEGORISED_AISLE: AisleRef = {
  id: 'uncategorised',
  name: 'Uncategorised',
};
