/**
 * Canon Module – AI Parse Validation Logic
 *
 * Pure, deterministic validation and repair of the AI's batch ingredient
 * parse response.  Contains no I/O, no side-effects.
 *
 * Responsibilities:
 * - Enforce index coverage, uniqueness and length match with the input.
 * - Repair invalid aisleId → "uncategorised" and flag.
 * - Repair invalid unit IDs → null and flag.
 * - Flag missing suggestedAisleName when aisleId is "uncategorised".
 * - Return validated results alongside structured ReviewFlags.
 */

import { UNCATEGORISED_AISLE } from '../types';
import type {
  AiIngredientParseResult,
  AisleRef,
  UnitRef,
  ValidatedParseResult,
  ReviewFlag,
  BatchParseResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFlag(
  code: ReviewFlag['code'],
  message: string,
): ReviewFlag {
  return { code, message };
}

function isValidAisleId(aisleId: string, aisleRefs: AisleRef[]): boolean {
  if (aisleId === UNCATEGORISED_AISLE.id) return true;
  return aisleRefs.some((a) => a.id === aisleId);
}

function isValidUnitId(unitId: string | null, unitRefs: UnitRef[]): boolean {
  if (unitId === null) return true;
  return unitRefs.some((u) => u.id === unitId);
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

/**
 * Validates and repairs AI parse results.
 *
 * @param rawResults   - Array of parse results as returned by the AI (may be
 *                       partially malformed).
 * @param aisleRefs    - Allowed aisles (from the prompt); must include system
 *                       aisles if you want them accepted without flagging.
 * @param unitRefs     - Allowed units (from the prompt).
 * @param ingredientCount - Expected number of results (equals input line count).
 * @returns A BatchParseResponse with validated items and a hasReviewFlags flag.
 */
export function validateAiParseResults(
  rawResults: AiIngredientParseResult[],
  aisleRefs: AisleRef[],
  unitRefs: UnitRef[],
  ingredientCount: number,
): BatchParseResponse {
  // Build a map from index → result (first occurrence wins for duplicates)
  const seenIndices = new Set<number>();
  const indexMap = new Map<number, AiIngredientParseResult>();
  const duplicateIndices = new Set<number>();

  for (const raw of rawResults) {
    if (seenIndices.has(raw.index)) {
      duplicateIndices.add(raw.index);
    } else {
      seenIndices.add(raw.index);
      indexMap.set(raw.index, raw);
    }
  }

  const items: ValidatedParseResult[] = [];

  for (let i = 0; i < ingredientCount; i++) {
    const flags: ReviewFlag[] = [];

    // -----------------------------------------------------------------------
    // Index coverage – synthesise a fallback when the AI omitted this index
    // -----------------------------------------------------------------------
    if (!indexMap.has(i)) {
      flags.push(
        makeFlag(
          'MISSING_INDEX',
          `AI did not return a result for index ${i}.`,
        ),
      );
      const fallback: AiIngredientParseResult = {
        index: i,
        quantity: null,
        recipeUnitId: null,
        preferredUnitId: null,
        canonicalName: '',
        aisleId: UNCATEGORISED_AISLE.id,
        suggestedAisleName: null,
        preparations: [],
        notes: [],
      };
      items.push({ result: fallback, flags });
      continue;
    }

    // Take a mutable copy so we can repair it
    const result: AiIngredientParseResult = { ...indexMap.get(i)! };

    // -----------------------------------------------------------------------
    // Duplicate index flag
    // -----------------------------------------------------------------------
    if (duplicateIndices.has(i)) {
      flags.push(
        makeFlag(
          'DUPLICATE_INDEX',
          `Index ${i} appeared more than once in the AI response; first occurrence used.`,
        ),
      );
    }

    // -----------------------------------------------------------------------
    // Out-of-range index flag (can only occur if ingredientCount is correct)
    // -----------------------------------------------------------------------
    if (result.index < 0 || result.index >= ingredientCount) {
      flags.push(
        makeFlag(
          'INDEX_OUT_OF_RANGE',
          `Index ${result.index} is outside the expected range 0–${ingredientCount - 1}.`,
        ),
      );
    }

    // -----------------------------------------------------------------------
    // Aisle ID validation + repair
    // -----------------------------------------------------------------------
    if (!isValidAisleId(result.aisleId, aisleRefs)) {
      flags.push(
        makeFlag(
          'INVALID_AISLE_ID',
          `aisleId "${result.aisleId}" is not in the allowed aisle list; reset to "uncategorised".`,
        ),
      );
      result.aisleId = UNCATEGORISED_AISLE.id;
    }

    // -----------------------------------------------------------------------
    // suggestedAisleName required when aisleId is "uncategorised"
    // -----------------------------------------------------------------------
    if (
      result.aisleId === UNCATEGORISED_AISLE.id &&
      !result.suggestedAisleName
    ) {
      flags.push(
        makeFlag(
          'MISSING_SUGGESTED_AISLE_NAME',
          'aisleId is "uncategorised" but suggestedAisleName is absent.',
        ),
      );
    }

    // -----------------------------------------------------------------------
    // Recipe unit ID validation + repair
    // -----------------------------------------------------------------------
    if (!isValidUnitId(result.recipeUnitId, unitRefs)) {
      flags.push(
        makeFlag(
          'INVALID_RECIPE_UNIT_ID',
          `recipeUnitId "${result.recipeUnitId}" is not in the allowed unit list; reset to null.`,
        ),
      );
      result.recipeUnitId = null;
    }

    // -----------------------------------------------------------------------
    // Preferred unit ID validation + repair
    // -----------------------------------------------------------------------
    if (!isValidUnitId(result.preferredUnitId, unitRefs)) {
      flags.push(
        makeFlag(
          'INVALID_PREFERRED_UNIT_ID',
          `preferredUnitId "${result.preferredUnitId}" is not in the allowed unit list; reset to null.`,
        ),
      );
      result.preferredUnitId = null;
    }

    items.push({ result, flags });
  }

  return {
    items,
    hasReviewFlags: items.some((item) => item.flags.length > 0),
  };
}
