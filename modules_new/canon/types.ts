/**
 * Canon Module – Module-Specific Types
 *
 * These types are scoped to the canon module and not shared globally.
 * Shared domain types (Unit, Aisle, etc.) come from types/contract.ts.
 */

// ---------------------------------------------------------------------------
// Reference shapes passed into the AI prompt
// ---------------------------------------------------------------------------

/** Minimal aisle shape sent to the AI for categorisation. */
export type AisleRef = {
  id: string;
  name: string;
};

/** Minimal unit shape sent to the AI for unit resolution. */
export type UnitRef = {
  id: string;
  name: string;
  plural: string | null;
};

// ---------------------------------------------------------------------------
// System aisles
// ---------------------------------------------------------------------------

/** The stable system aisle used when no category can be assigned. */
export const UNCATEGORISED_AISLE: AisleRef = {
  id: 'uncategorised',
  name: 'Uncategorised',
};

// ---------------------------------------------------------------------------
// Pre-parse (deterministic, library-based)
// ---------------------------------------------------------------------------

/**
 * Result of the optional deterministic pre-parse step.
 * Provides quantity/unit/residual text before AI processing.
 */
export type PreParsedIngredient = {
  /** Original raw ingredient line. */
  rawLine: string;
  /** Numeric quantity extracted by the parser (null if not found). */
  quantity: number | null;
  /** Unit string as recognised by the parser (null if not found). */
  unit: string | null;
  /** Resolved unit ID from canon unit refs (null if not matched). */
  unitId: string | null;
  /** Remaining text after quantity and unit are stripped. */
  residualText: string;
};

// ---------------------------------------------------------------------------
// AI parse contract
// ---------------------------------------------------------------------------

/**
 * A single ingredient parse result as expected from the AI.
 * Index-aligned with the input ingredient array.
 */
export type AiIngredientParseResult = {
  /** Index matching the input array position. */
  index: number;
  /** Quantity as a number (null if unquantified). */
  quantity: number | null;
  /** Unit ID from the canon units table (null if unknown or absent). */
  recipeUnitId: string | null;
  /** Preferred storage/purchase unit ID (null if unknown). */
  preferredUnitId: string | null;
  /** Canonical name of the ingredient (e.g. "Chicken Breast"). */
  canonicalName: string;
  /** Aisle ID from the allowed aisle list, or "uncategorised". */
  aisleId: string;
  /**
   * Suggested aisle name when aisleId is "uncategorised" and the AI has a
   * suggestion.  Must be present when aisleId is "uncategorised".
   */
  suggestedAisleName: string | null;
  /** Preparation methods e.g. ["finely chopped", "peeled"]. */
  preparations: string[];
  /** Additional notes e.g. ["preferably organic"]. */
  notes: string[];
};

// ---------------------------------------------------------------------------
// Validation review flags
// ---------------------------------------------------------------------------

/** Codes describing why a parse result was flagged for human review. */
export type ReviewFlagCode =
  | 'INVALID_AISLE_ID'
  | 'MISSING_SUGGESTED_AISLE_NAME'
  | 'INVALID_RECIPE_UNIT_ID'
  | 'INVALID_PREFERRED_UNIT_ID'
  | 'DUPLICATE_INDEX'
  | 'INDEX_OUT_OF_RANGE'
  | 'MISSING_INDEX';

/** A single review flag attached to a validated parse result. */
export type ReviewFlag = {
  code: ReviewFlagCode;
  message: string;
};

// ---------------------------------------------------------------------------
// Validated parse result
// ---------------------------------------------------------------------------

/**
 * A validated and repaired AI ingredient parse result together with any
 * review flags raised during validation.
 */
export type ValidatedParseResult = {
  /** The (possibly repaired) parse result. */
  result: AiIngredientParseResult;
  /** Review flags; empty when the result is clean. */
  flags: ReviewFlag[];
};

// ---------------------------------------------------------------------------
// Batch AI parse response
// ---------------------------------------------------------------------------

/** The full validated response returned after AI batch parsing. */
export type BatchParseResponse = {
  /** One entry per input ingredient line. */
  items: ValidatedParseResult[];
  /** True when any item has at least one review flag. */
  hasReviewFlags: boolean;
};
