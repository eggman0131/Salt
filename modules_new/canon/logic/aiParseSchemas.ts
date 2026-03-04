/**
 * AI Parse Schemas (PURE)
 *
 * Zod schemas for ingredient parse requests and responses.
 * All synchronous, no I/O or side effects.
 */

import { z } from 'zod';

/**
 * Single ingredient parse result from AI
 */
export const AiSingleParseResultSchema = z.object({
  index: z.number().int().nonnegative(),
  originalLine: z.string(),
  itemName: z.string(),
  quantity: z.number().nullable().default(null),
  recipeUnitId: z.string().nullable().default(null),
  aisleId: z.string(),
  suggestedAisleName: z.string().optional(),
  preparations: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

/**
 * Schema for AI response from Cloud Function
 */
export const AiParseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      results: z.array(AiSingleParseResultSchema),
    })
    .optional(),
});

/**
 * Build a schema description for prompt injection.
 * Returns a string suitable for inclusion in system prompt.
 *
 * Example:
 *   const desc = buildParseSchemaDescription(aisles, units);
 *   // Use in prompt: "Return JSON matching: " + desc
 */
export function buildParseSchemaDescription(
  aisleIds: string[],
  unitIds: string[]
): string {
  return `{
  "results": [
    {
      "index": <0-based position in input>,
      "originalLine": <exact input line>,
      "itemName": <parsed ingredient name>,
      "quantity": <numeric amount or null>,
      "recipeUnitId": <one of [${unitIds.join(', ')}] or null>,
      "aisleId": <one of [${aisleIds.join(', ')}] — MUST be valid>,
      "suggestedAisleName": <if aisleId="uncategorised", suggest best aisle name else omit>,
      "preparations": [<array of prep methods, e.g. "chopped", "diced">],
      "notes": [<array of free-text notes e.g. "organic", "fresh">]
    }
  ]
}`;
}
