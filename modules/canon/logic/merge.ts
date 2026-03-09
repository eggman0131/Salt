/**
 * Pure merge logic helpers
 *
 * All functions are deterministic and free of I/O — testable without Firebase.
 * Used by merge-provider.ts to perform the actual data transformations.
 */

import { UNCATEGORISED_AISLE_ID } from './aisles';

// ── Recipe ingredient patching ─────────────────────────────────────────────────

/**
 * Replace all occurrences of `fromId` with `toId` in a flat ingredients array.
 * Returns a new array; does not mutate the input.
 */
export function patchIngredientArray(
  ingredients: Array<{ canonicalItemId?: string; [key: string]: unknown }>,
  fromId: string,
  toId: string
): { patched: Array<{ canonicalItemId?: string; [key: string]: unknown }>; changed: boolean } {
  let changed = false;
  const patched = ingredients.map(ing => {
    if (ing.canonicalItemId === fromId) {
      changed = true;
      return { ...ing, canonicalItemId: toId };
    }
    return ing;
  });
  return { patched, changed };
}

/**
 * Replace all occurrences of `fromId` with `toId` inside a recipe instructions array.
 * Each instruction may have its own embedded `ingredients` array.
 * Returns a new array; does not mutate the input.
 */
export function patchInstructionArray(
  instructions: Array<{ ingredients?: Array<{ canonicalItemId?: string; [key: string]: unknown }>; [key: string]: unknown }>,
  fromId: string,
  toId: string
): { patched: typeof instructions; changed: boolean } {
  let changed = false;
  const patched = instructions.map(step => {
    if (!step.ingredients?.length) return step;
    const result = patchIngredientArray(step.ingredients, fromId, toId);
    if (result.changed) {
      changed = true;
      return { ...step, ingredients: result.patched };
    }
    return step;
  });
  return { patched, changed };
}

/**
 * Returns true if any ingredient in the flat array references `id`.
 */
export function ingredientArrayReferences(
  ingredients: Array<{ canonicalItemId?: string }>,
  id: string
): boolean {
  return ingredients.some(ing => ing.canonicalItemId === id);
}

/**
 * Returns true if any instruction's embedded ingredients reference `id`.
 */
export function instructionArrayReferences(
  instructions: Array<{ ingredients?: Array<{ canonicalItemId?: string }> }>,
  id: string
): boolean {
  return instructions.some(step =>
    step.ingredients?.some(ing => ing.canonicalItemId === id)
  );
}

// ── Synonym merging ────────────────────────────────────────────────────────────

/**
 * Union of two synonym arrays, trimmed and deduplicated.
 * Empty strings are discarded.
 */
export function mergeItemSynonyms(a: string[], b: string[]): string[] {
  return Array.from(
    new Set([...a, ...b].map(s => s.trim()).filter(Boolean))
  );
}

// ── Aisle merge guards ─────────────────────────────────────────────────────────

/**
 * Returns true if the proposed merge is valid — i.e. the secondary (to-be-deleted)
 * aisle is not the uncategorised system aisle.
 */
export function isValidAisleMerge(primaryId: string, secondaryId: string): boolean {
  // primary may be uncategorised (it survives), but secondary must not be
  return secondaryId !== UNCATEGORISED_AISLE_ID && primaryId !== secondaryId;
}
