/**
 * Canon Module – AI Parse Data Layer
 *
 * Calls the existing `cloudGenerateContent` Cloud Function to run Gemini
 * batch ingredient parsing and aisle categorisation.
 *
 * I/O only – no business logic here.
 */

import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters } from '@google/genai';
import { functions, auth } from '../../../shared/backend/firebase';
import { AiParseResponseSchema } from '../logic/aiParseSchemas';
import { buildAiResponseSchemaDescription } from '../logic/aiParseSchemas';
import type { AisleRef, UnitRef, AiIngredientParseResult } from '../types';

// ---------------------------------------------------------------------------
// Model identifier
// ---------------------------------------------------------------------------

const FLASH_3_MODEL = 'gemini-3-flash-preview';

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildParsePrompt(
  lines: string[],
  aisles: AisleRef[],
  units: UnitRef[],
): string {
  const aisleList = aisles
    .map((a) => `  { "id": "${a.id}", "name": "${a.name}" }`)
    .join(',\n');

  const unitList = units
    .map(
      (u) =>
        `  { "id": "${u.id}", "name": "${u.name}", "plural": ${u.plural === null ? 'null' : `"${u.plural}"`} }`,
    )
    .join(',\n');

  const ingredientList = lines
    .map((line, i) => `  ${i}: "${line}"`)
    .join('\n');

  return `You are a culinary data parser. Parse each ingredient line and return structured data.

## Ingredient lines (index: line)
${ingredientList}

## Allowed aisles
[
${aisleList}
]

## Allowed units
[
${unitList}
]

## Instructions
- Return a JSON array with exactly ${lines.length} objects, one per ingredient, index-aligned.
- Each object must follow this schema:
${buildAiResponseSchemaDescription()}
- aisleId must be one of the allowed aisle IDs, or "uncategorised".
- When aisleId is "uncategorised", provide suggestedAisleName; otherwise set it to null.
- recipeUnitId and preferredUnitId must be unit IDs from the allowed list, or null.
- preparations and notes must be arrays (may be empty).
- Return only valid JSON — no markdown fences, no commentary.`;
}

// ---------------------------------------------------------------------------
// Response shape for cloudGenerateContent callable
// ---------------------------------------------------------------------------

interface CloudGenerateContentPart {
  text?: string;
}

interface CloudGenerateContentContent {
  parts?: CloudGenerateContentPart[];
}

interface CloudGenerateContentCandidate {
  content?: CloudGenerateContentContent;
}

interface CloudGenerateContentData {
  candidates?: CloudGenerateContentCandidate[];
}

// ---------------------------------------------------------------------------
// Cloud function caller
// ---------------------------------------------------------------------------

async function callCloudGenerateContent(
  params: GenerateContentParameters,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated. Cannot call AI service.');
  }

  const idToken = await user.getIdToken(true);
  const callable = httpsCallable(functions, 'cloudGenerateContent');
  const result = await callable({ idToken, params });
  const data = result.data as CloudGenerateContentData;

  // Extract text from first candidate
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      'AI service returned an empty response. Please try again.',
    );
  }
  return text;
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

function extractJsonFromText(text: string): unknown {
  // Strip optional markdown code fences
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  return JSON.parse(stripped);
}

// ---------------------------------------------------------------------------
// Public data function
// ---------------------------------------------------------------------------

/**
 * Calls the Gemini AI via the existing `cloudGenerateContent` Cloud Function
 * to batch-parse ingredient lines.
 *
 * Returns raw (unvalidated) parse results.  Pass them through
 * `validateAiParseResults` in the logic layer before using.
 *
 * @param lines   - Raw ingredient lines from a recipe.
 * @param aisles  - Aisle refs (id + name) to pass to the AI.
 * @param units   - Unit refs (id + name + plural) to pass to the AI.
 */
export async function aiParseIngredients(
  lines: string[],
  aisles: AisleRef[],
  units: UnitRef[],
): Promise<AiIngredientParseResult[]> {
  if (lines.length === 0) return [];

  const prompt = buildParsePrompt(lines, aisles, units);

  const params: GenerateContentParameters = {
    model: FLASH_3_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };

  const rawText = await callCloudGenerateContent(params);
  const parsed = extractJsonFromText(rawText);

  // Validate against schema – throws if malformed
  const validated = AiParseResponseSchema.parse(parsed);
  return validated as AiIngredientParseResult[];
}
