/**
 * AI Parse Data Layer (I/O)
 *
 * Handles Cloud Function calls and Firestore reads for ingredient parsing.
 * All functions are async and handle I/O.
 */

import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../../shared/backend/firebase';
import { AiParseResponse, AiSingleParseResult } from '../types';
import { AiParseResponseSchema, buildParseSchemaDescription } from '../logic/aiParseSchemas';
import type { GenerateContentResponse } from '@google/genai';

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
    // Get authentication token
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const idToken = await user.getIdToken(true);

    // Build schema description for the prompt
    const aisleIds = Object.keys(aisleDescriptions);
    const unitIds = Object.keys(unitDescriptions);
    const schemaDescription = buildParseSchemaDescription(aisleIds, unitIds);

    // Build aisle reference list for the prompt
    const aislesList = aisleIds
      .map(id => `- ${id}: ${aisleDescriptions[id]}`)
      .join('\n');

    // Build unit reference list for the prompt
    const unitsList = unitIds
      .map(id => `- ${id}: ${unitDescriptions[id]}`)
      .join('\n');

    // Build ingredient list for the prompt
    const ingredientsList = lines
      .map((line, idx) => `${idx}. ${line}`)
      .join('\n');

    // Construct the prompt
    const prompt = `Parse the following ingredient lines into structured JSON.

AVAILABLE AISLES:
${aislesList}

AVAILABLE UNITS:
${unitsList}

INGREDIENT LINES:
${ingredientsList}

Return JSON matching this exact structure:
${schemaDescription}

Rules:
- index must match the 0-based position in the input list
- originalLine must be the exact input
- itemName should be the core ingredient (e.g., "tomatoes", "chicken breast")
- quantity should be a number if parseable, or null
- recipeUnitId must be one of the provided unit IDs or null
- aisleId MUST be one of the provided aisle IDs - use "uncategorised" if unsure
- If aisleId is "uncategorised", provide suggestedAisleName
- preparations are actions like "chopped", "diced", "drained"
- notes are qualifiers like "organic", "fresh", "free-range"

Return ONLY the JSON, no markdown formatting.`;

    // Call the Cloud Function with proper structure
    const callable = httpsCallable<
      { idToken: string; params: any },
      GenerateContentResponse
    >(functions, 'cloudGenerateContent');

    const result = await callable({
      idToken,
      params: {
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config: {
          systemInstruction: 'You are a kitchen ingredient parser. Parse ingredient lines into structured JSON format with canonical references.',
          responseMimeType: 'application/json',
        },
      },
    });

    // Extract text from Gemini response
    const responseData = result.data as GenerateContentResponse;
    const text = responseData.candidates?.[0]?.content?.parts
      ?.filter(part => part.text)
      .map(part => part.text)
      .join('') || '{}';

    // Parse JSON response
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(text);
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }

    // Wrap in expected format if needed
    const response = parsedJson.results
      ? { success: true, data: parsedJson }
      : { success: false, message: 'Invalid response format' };

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
