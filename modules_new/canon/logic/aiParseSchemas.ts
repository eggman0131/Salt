/**
 * Canon Module – AI Parse Zod Schemas
 *
 * Defines the Zod schemas that describe the AI's expected JSON response for
 * batch ingredient parsing and aisle categorisation.
 *
 * These schemas are used:
 * 1. In data/aiParseIngredients.ts to parse the AI's raw JSON response.
 * 2. As documentation of the contract sent in the AI prompt.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Single ingredient parse result from AI
// ---------------------------------------------------------------------------

/**
 * Schema for one ingredient parse result returned by the AI.
 * The AI must return an array of these, index-aligned with the input.
 */
export const AiSingleParseResultSchema = z.object({
  /** Zero-based index matching the input ingredient array position. */
  index: z.number().int().nonnegative(),
  /** Numeric quantity; null when the ingredient is unquantified. */
  quantity: z.number().nullable(),
  /**
   * Unit ID from the canon units table (must be one of the IDs provided in
   * the prompt).  Null when no unit is present or the AI cannot map it.
   */
  recipeUnitId: z.string().nullable(),
  /**
   * Preferred storage/purchase unit ID (must be one of the IDs provided in
   * the prompt).  Required but may be null.
   */
  preferredUnitId: z.string().nullable(),
  /** Canonical name of the ingredient, title-cased. */
  canonicalName: z.string().min(1),
  /**
   * Aisle ID from the allowed aisle list provided in the prompt, or the
   * literal string "uncategorised" when no aisle matches.
   */
  aisleId: z.string().min(1),
  /**
   * Human-readable aisle suggestion when aisleId is "uncategorised".
   * Null when the AI has no suggestion or when aisleId is a known aisle.
   */
  suggestedAisleName: z.string().nullable(),
  /** List of preparation methods (may be empty). */
  preparations: z.array(z.string()),
  /** List of additional notes (may be empty). */
  notes: z.array(z.string()),
});

export type AiSingleParseResult = z.infer<typeof AiSingleParseResultSchema>;

// ---------------------------------------------------------------------------
// Full AI response – array of parse results
// ---------------------------------------------------------------------------

/**
 * Schema for the complete AI response: an array of parse results, one per
 * input ingredient line.
 */
export const AiParseResponseSchema = z.array(AiSingleParseResultSchema);

export type AiParseResponse = z.infer<typeof AiParseResponseSchema>;

// ---------------------------------------------------------------------------
// Prompt helper – build the JSON schema description for the AI prompt
// ---------------------------------------------------------------------------

/**
 * Returns a JSON string describing the expected response schema for inclusion
 * in the AI prompt.
 */
export function buildAiResponseSchemaDescription(): string {
  return JSON.stringify(
    {
      type: 'array',
      description:
        'One object per input ingredient, index-aligned with the input array.',
      items: {
        index: 'number – zero-based position in the input array',
        quantity: 'number | null',
        recipeUnitId: 'string | null – must be a unit ID from the provided list, or null',
        preferredUnitId: 'string | null – must be a unit ID from the provided list, or null',
        canonicalName: 'string – canonical ingredient name, title-cased',
        aisleId:
          'string – must be an aisle ID from the provided list, or "uncategorised"',
        suggestedAisleName:
          'string | null – required when aisleId is "uncategorised", otherwise null',
        preparations: 'string[] – list of preparation methods, may be empty',
        notes: 'string[] – list of additional notes, may be empty',
      },
    },
    null,
    2,
  );
}
