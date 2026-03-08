/**
 * Pure utilities for cook guide processing.
 *
 * No I/O. All functions are stateless.
 */

import type { Recipe } from '../../../types/contract';
import type { CookingStep } from '../types';

const HASH_HEX_LENGTH = 16;

/**
 * Deterministic hash of a recipe's identity for cache versioning.
 * Not for security — just to detect stale guides.
 */
export function hashRecipe(recipe: Recipe): string {
  const data = JSON.stringify({
    id: recipe.id,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
  });

  let hash = 5381;
  for (let i = 0; i < data.length; i += 1) {
    hash = ((hash << 5) + hash) ^ data.charCodeAt(i);
  }

  const hex = (hash >>> 0).toString(16);
  return hex.padStart(HASH_HEX_LENGTH, '0').slice(0, HASH_HEX_LENGTH);
}

/**
 * Ensure every step has a persistent ID, backfilling missing ones.
 * Returns a new array; does not mutate input.
 */
export function ensureStepIds(steps: CookingStep[]): CookingStep[] {
  return steps.map((step, idx) => ({
    ...step,
    id: step.id || `step-${Date.now()}-${idx}`,
  }));
}
