/**
 * AI Parse Data Layer (I/O)
 *
 * Handles Cloud Function calls and Firestore reads for ingredient parsing.
 * All functions are async and handle I/O.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/backend/firebase';
import { AiParseResponse, AiSingleParseResult } from '../types';
import { AiParseResponseSchema } from '../logic/aiParseSchemas';

/**
 * Call the AI parse Cloud Function.
 * 
 * Args:
 *   - lines: array of ingredient lines to parse
 *   - aisleDescriptions: map of aisle id → name (for schema description)
 *   - unitDescriptions: map of unit id → name
 * 
 * Returns: parsed results or error
 */
export async function callAiParseIngredients(
  lines: string[],
  aisleDescriptions: Record<string, string>,
  unitDescriptions: Record<string, string>
): Promise<{ success: boolean; data?: AiSingleParseResult[]; error?: string }> {
  try {
    const callable = httpsCallable<
      {
        ingredients: string[];
        aisleIds: string[];
        unitIds: string[];
        aisleNames: Record<string, string>;
        unitNames: Record<string, string>;
      },
      AiParseResponse
    >(functions, 'cloudGenerateContent');

    const response = await callable({
      ingredients: lines,
      aisleIds: Object.keys(aisleDescriptions),
      unitIds: Object.keys(unitDescriptions),
      aisleNames: aisleDescriptions,
      unitNames: unitDescriptions,
    });

    // Validate response against schema
    const validated = AiParseResponseSchema.safeParse(response);
    if (!validated.success) {
      return {
        success: false,
        error: `Invalid response schema: ${validated.error.message}`,
      };
    }

    if (!validated.data.success) {
      return {
        success: false,
        error: validated.data.message || 'AI parse failed',
      };
    }

    if (!validated.data.data?.results) {
      return {
        success: false,
        error: 'No results in AI response',
      };
    }

    // Ensure all results have required fields with defaults
    const results: AiSingleParseResult[] = validated.data.data.results.map(r => ({
      index: r.index,
      originalLine: r.originalLine,
      itemName: r.itemName,
      quantity: r.quantity ?? null,
      recipeUnitId: r.recipeUnitId ?? null,
      aisleId: r.aisleId,
      suggestedAisleName: r.suggestedAisleName,
      preparations: r.preparations ?? [],
      notes: r.notes ?? [],
    }));

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Cloud Function error: ${message}`,
    };
  }
}
