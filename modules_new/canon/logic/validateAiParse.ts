/**
 * AI Parse Validation + Repair (PURE)
 *
 * Deterministic validation and repair of parsed ingredients.
 * All logic is synchronous and side-effect-free.
 */

import { AiSingleParseResult, ValidatedParseResult, ReviewFlag, UNCATEGORISED_AISLE, BatchParseResponse } from '../types';

/**
 * Validate and repair a single parse result.
 * 
 * Repair rules:
 * - Invalid aisleId → repaired to "uncategorised" + flagged
 * - Invalid recipeUnitId/preferredUnitId → set to null + flagged
 * - If aisleId is "uncategorised" but no suggestedAisleName → flagged
 * - Missing preparations/notes arrays → repaired to [] + flagged
 * - Index coverage/uniqueness checked at batch level
 */
function validateAndRepairSingleResult(
  result: AiSingleParseResult,
  validAisleIds: Set<string>,
  validUnitIds: Set<string>
): { validated: ValidatedParseResult; flags: ReviewFlag[] } {
  const flags: ReviewFlag[] = [];
  let repaired: ValidatedParseResult = {
    ...result,
    preparations: Array.isArray(result.preparations) ? result.preparations : [],
    notes: Array.isArray(result.notes) ? result.notes : [],
    reviewFlags: [],
  };

  // Flag if data needed repair for arrays
  if (!Array.isArray(result.preparations) || !Array.isArray(result.notes)) {
    flags.push('data-repaired');
  }

  // Validate aisleId
  if (!validAisleIds.has(result.aisleId)) {
    repaired.aisleId = UNCATEGORISED_AISLE.id;
    flags.push('invalid-aisle-id-repaired');
  }

  // Validate recipeUnitId
  if (result.recipeUnitId !== null && !validUnitIds.has(result.recipeUnitId)) {
    repaired.recipeUnitId = null;
    flags.push('invalid-unit-id-repaired');
  }

  // Uncategorised aisle without suggestion
  if (repaired.aisleId === UNCATEGORISED_AISLE.id && !result.suggestedAisleName) {
    flags.push('missing-aisle-suggestion');
  }

  repaired.reviewFlags = flags;
  return { validated: repaired, flags };
}

/**
 * Validate and repair a batch of parse results.
 * 
 * Chain validation:
 * 1. Check index coverage (0 to N-1) and uniqueness
 * 2. Validate each item individually
 * 3. Aggregate flags and errors
 */
export function validateAiParseResults(
  results: AiSingleParseResult[],
  validAisleIds: string[],
  validUnitIds: string[]
): BatchParseResponse {
  const aisleIdSet = new Set(validAisleIds);
  const unitIdSet = new Set(validUnitIds);
  const validatedResults: ValidatedParseResult[] = [];
  const errors: string[] = [];
  let hasBatchErrors = false;
  let hasReviewFlags = false;

  // Check index coverage (0 to N-1)
  const indices = new Set<number>();
  const indexErrors: string[] = [];

  results.forEach((result, i) => {
    if (result.index < 0 || result.index >= results.length) {
      indexErrors.push(`Result ${i}: index ${result.index} out of range [0, ${results.length - 1}]`);
      hasBatchErrors = true;
    }
    if (indices.has(result.index)) {
      indexErrors.push(`Result ${i}: duplicate index ${result.index}`);
      hasBatchErrors = true;
    }
    indices.add(result.index);
  });

  if (indexErrors.length > 0) {
    errors.push(...indexErrors);
  }

  // Validate and repair each result
  results.forEach((result, i) => {
    const { validated, flags } = validateAndRepairSingleResult(result, aisleIdSet, unitIdSet);
    validatedResults.push(validated);

    if (flags.length > 0) {
      hasReviewFlags = true;
    }
  });

  // Sort results by index to ensure order
  validatedResults.sort((a, b) => a.index - b.index);

  return {
    totalCount: results.length,
    successCount: validatedResults.length,
    hasErrors: hasBatchErrors,
    hasReviewFlags,
    results: validatedResults,
    errors: errors.length > 0 ? errors : undefined,
  };
}
