/**
 * Recipe Ingredient Parser (PR7 - Issue 90)
 * 
 * Integrates canon's AI parse pipeline for structured ingredient parsing.
 * Parse-only phase: no canon item linking or creation.
 * 
 * Architecture:
 * - Calls canon module's public API (modules_new/canon/api.ts)
 * - Maps canon parse results to RecipeIngredient schema
 * - Stores structured parse data with review flags
 */

import { RecipeIngredient } from '../../../types/contract';
import {
  callAiParseIngredients,
  validateAiParseResults,
  getCanonAisles,
  getCanonUnits,
} from '../../../modules_new/canon/api';
import type { ValidatedParseResult } from '../../../modules_new/canon/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parse raw ingredient lines into structured RecipeIngredient objects.
 * 
 * Uses canon's AI parse pipeline to extract:
 * - quantity, unit, ingredientName, preparation, qualifiers
 * 
 * Does NOT link to canonical items (that's PR8).
 * 
 * @param rawLines - Array of unparsed ingredient strings
 * @returns Array of structured RecipeIngredient objects with parse metadata
 */
export async function parseRecipeIngredients(
  rawLines: string[]
): Promise<RecipeIngredient[]> {
  if (rawLines.length === 0) {
    return [];
  }

  // Fetch aisles and units for parse constraints
  const [aisles, units] = await Promise.all([
    getCanonAisles(),
    getCanonUnits(),
  ]);

  // Build aisle and unit description maps for AI prompt
  const aisleDescriptions: Record<string, string> = {};
  aisles.forEach(aisle => {
    aisleDescriptions[aisle.id] = aisle.name;
  });

  const unitDescriptions: Record<string, string> = {};
  units.forEach(unit => {
    unitDescriptions[unit.id] = unit.name;
  });

  // Call canon's AI parse
  const parseResult = await callAiParseIngredients(
    rawLines,
    aisleDescriptions,
    unitDescriptions
  );

  if (!parseResult.success || !parseResult.data) {
    throw new Error(parseResult.error || 'AI parse failed');
  }

  // Validate and repair parse results
  const validAisleIds = aisles.map(a => a.id);
  const validUnitIds = units.map(u => u.id);
  
  const validated = validateAiParseResults(
    parseResult.data,
    validAisleIds,
    validUnitIds
  );

  // Build unit lookup for name resolution
  const unitById = new Map(units.map(u => [u.id, u]));

  // Map ValidatedParseResult to RecipeIngredient
  const ingredients: RecipeIngredient[] = validated.results.map(result =>
    mapParseResultToRecipeIngredient(result, unitById)
  );

  return ingredients;
}

/**
 * Map a validated parse result to RecipeIngredient schema.
 * 
 * Mapping:
 * - originalLine → raw
 * - itemName → ingredientName
 * - quantity → quantity
 * - recipeUnitId → unit (resolved to unit name)
 * - aisleId → suggestedAisleId (parser hint for PR8 matching/canon creation)
 * - preparations[0] → preparation (single string, first item)
 * - notes → qualifiers
 * - reviewFlags → parseReviewFlags
 */
function mapParseResultToRecipeIngredient(
  result: ValidatedParseResult,
  unitById: Map<string, { id: string; name: string }>
): RecipeIngredient {
  // Resolve unit ID to unit name
  let unitName: string | null = null;
  if (result.recipeUnitId) {
    const unit = unitById.get(result.recipeUnitId);
    unitName = unit ? unit.name : null;
  }

  return {
    id: uuidv4(),
    raw: result.originalLine,
    quantity: result.quantity,
    unit: unitName,
    ingredientName: result.itemName,
    suggestedAisleId: result.aisleId,
    qualifiers: result.notes.length > 0 ? result.notes : undefined,
    preparation: result.preparations.length > 0 ? result.preparations[0] : undefined,
    parseReviewFlags: result.reviewFlags.length > 0 ? result.reviewFlags : undefined,
    parsedAt: new Date().toISOString(),
  };
}
