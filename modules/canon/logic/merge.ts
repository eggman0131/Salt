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

// ── Split: targeted ingredient reassignment ───────────────────────────────────

type IngredientLike = { id?: string; canonicalItemId?: string; [key: string]: unknown };
type StepLike = { ingredients?: IngredientLike[]; [key: string]: unknown };

/**
 * Reassign a single ingredient (identified by its own `id`) to a new canon item.
 * Used for split operations where only selected references should move.
 * Returns a new array; does not mutate the input.
 */
export function reassignIngredientById(
  ingredients: IngredientLike[],
  ingredientId: string,
  newCanonItemId: string
): { patched: IngredientLike[]; changed: boolean } {
  let changed = false;
  const patched = ingredients.map(ing => {
    if (ing.id === ingredientId) {
      changed = true;
      return { ...ing, canonicalItemId: newCanonItemId };
    }
    return ing;
  });
  return { patched, changed };
}

/**
 * Reassign a set of ingredients (by their own `id`s) across a flat ingredients array.
 * Returns a new array; does not mutate the input.
 */
export function reassignIngredientsByIds(
  ingredients: IngredientLike[],
  ingredientIds: Set<string>,
  newCanonItemId: string
): { patched: IngredientLike[]; changed: boolean } {
  let changed = false;
  const patched = ingredients.map(ing => {
    if (ing.id && ingredientIds.has(ing.id)) {
      changed = true;
      return { ...ing, canonicalItemId: newCanonItemId };
    }
    return ing;
  });
  return { patched, changed };
}

/**
 * Reassign a set of ingredients (by their own `id`s) across a recipe instructions array.
 * Returns a new array; does not mutate the input.
 */
export function reassignInstructionIngredientsByIds(
  instructions: StepLike[],
  ingredientIds: Set<string>,
  newCanonItemId: string
): { patched: StepLike[]; changed: boolean } {
  let changed = false;
  const patched = instructions.map(step => {
    if (!step.ingredients?.length) return step;
    const result = reassignIngredientsByIds(step.ingredients, ingredientIds, newCanonItemId);
    if (result.changed) {
      changed = true;
      return { ...step, ingredients: result.patched };
    }
    return step;
  });
  return { patched, changed };
}

/**
 * Collect all ingredient references from a recipe doc (flat + embedded in instructions)
 * that match a given canonicalItemId. Returns an array of ingredient objects with
 * the ingredient's own `id` field.
 */
export function collectIngredientRefs(
  flatIngredients: IngredientLike[],
  instructions: StepLike[],
  canonItemId: string
): IngredientLike[] {
  const results: IngredientLike[] = [];
  for (const ing of flatIngredients) {
    if (ing.canonicalItemId === canonItemId) results.push(ing);
  }
  for (const step of instructions) {
    for (const ing of step.ingredients ?? []) {
      if (ing.canonicalItemId === canonItemId) results.push(ing);
    }
  }
  return results;
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
