/**
 * Canon Module – Public API
 *
 * Exposes pure, synchronous functions only.
 * All I/O lives in data/; all business logic lives in logic/.
 *
 * This file may only call this module's logic/.
 */

export { validateAiParseResults } from './logic/validateAiParse';
export { buildAiResponseSchemaDescription } from './logic/aiParseSchemas';
export {
  AiSingleParseResultSchema,
  AiParseResponseSchema,
} from './logic/aiParseSchemas';
export type { AiSingleParseResult, AiParseResponse } from './logic/aiParseSchemas';

export { UNCATEGORISED_AISLE } from './types';
export type {
  AisleRef,
  UnitRef,
  PreParsedIngredient,
  AiIngredientParseResult,
  ReviewFlag,
  ReviewFlagCode,
  ValidatedParseResult,
  BatchParseResponse,
} from './types';
