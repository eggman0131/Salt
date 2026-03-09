/**
 * Pure merge logic tests
 *
 * Tests for modules/canon/logic/merge.ts
 * No Firebase, no async — all deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  patchIngredientArray,
  patchInstructionArray,
  ingredientArrayReferences,
  instructionArrayReferences,
  mergeItemSynonyms,
  isValidAisleMerge,
} from '../logic/merge';
import { UNCATEGORISED_AISLE_ID } from '../logic/aisles';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ing = (canonicalItemId?: string, extra: object = {}) => ({
  id: `ing-${Math.random().toString(36).slice(2)}`,
  raw: '2 cups flour',
  ingredientName: 'flour',
  quantity: 2,
  unit: 'cup',
  canonicalItemId,
  ...extra,
});

const step = (ingredients: ReturnType<typeof ing>[]) => ({
  id: `step-${Math.random().toString(36).slice(2)}`,
  text: 'Mix together',
  ingredients,
});

// ── patchIngredientArray ───────────────────────────────────────────────────────

describe('patchIngredientArray', () => {
  it('replaces matching canonicalItemId with toId', () => {
    const ingredients = [ing('item-A'), ing('item-B'), ing('item-C')];
    const { patched, changed } = patchIngredientArray(ingredients, 'item-B', 'item-A');
    expect(changed).toBe(true);
    expect(patched[1].canonicalItemId).toBe('item-A');
  });

  it('replaces all occurrences, not just the first', () => {
    const ingredients = [ing('item-A'), ing('item-B'), ing('item-B')];
    const { patched, changed } = patchIngredientArray(ingredients, 'item-B', 'item-A');
    expect(changed).toBe(true);
    expect(patched.filter(i => i.canonicalItemId === 'item-A')).toHaveLength(3);
    expect(patched.filter(i => i.canonicalItemId === 'item-B')).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const ingredients = [ing('item-A'), ing('item-B')];
    const original = ingredients.map(i => ({ ...i }));
    patchIngredientArray(ingredients, 'item-B', 'item-A');
    expect(ingredients).toEqual(original);
  });

  it('returns changed:false when no match found', () => {
    const ingredients = [ing('item-A'), ing('item-C')];
    const { changed } = patchIngredientArray(ingredients, 'item-B', 'item-A');
    expect(changed).toBe(false);
  });

  it('preserves all other fields on patched ingredients', () => {
    const original = ing('item-B', { quantity: 3, unit: 'g', raw: '3g butter' });
    const { patched } = patchIngredientArray([original], 'item-B', 'item-A');
    expect(patched[0]).toMatchObject({ quantity: 3, unit: 'g', raw: '3g butter' });
  });

  it('does not touch ingredients with no canonicalItemId', () => {
    const unlinked = ing(undefined);
    const linked = ing('item-B');
    const { patched, changed } = patchIngredientArray([unlinked, linked], 'item-B', 'item-A');
    expect(changed).toBe(true);
    expect(patched[0].canonicalItemId).toBeUndefined();
  });

  it('handles empty array', () => {
    const { patched, changed } = patchIngredientArray([], 'item-B', 'item-A');
    expect(changed).toBe(false);
    expect(patched).toHaveLength(0);
  });
});

// ── patchInstructionArray ──────────────────────────────────────────────────────

describe('patchInstructionArray', () => {
  it('replaces matching canonicalItemId in step ingredients', () => {
    const instructions = [step([ing('item-A'), ing('item-B')]), step([ing('item-C')])];
    const { patched, changed } = patchInstructionArray(instructions, 'item-B', 'item-A');
    expect(changed).toBe(true);
    expect((patched[0].ingredients ?? [])[1].canonicalItemId).toBe('item-A');
    expect((patched[1].ingredients ?? [])[0].canonicalItemId).toBe('item-C');
  });

  it('replaces across multiple steps', () => {
    const instructions = [
      step([ing('item-B')]),
      step([ing('item-B'), ing('item-C')]),
    ];
    const { patched, changed } = patchInstructionArray(instructions, 'item-B', 'item-A');
    expect(changed).toBe(true);
    expect((patched[0].ingredients ?? [])[0].canonicalItemId).toBe('item-A');
    expect((patched[1].ingredients ?? [])[0].canonicalItemId).toBe('item-A');
    expect((patched[1].ingredients ?? [])[1].canonicalItemId).toBe('item-C');
  });

  it('does not mutate original instructions', () => {
    const instructions = [step([ing('item-B')])];
    const originalId = instructions[0].ingredients[0].canonicalItemId;
    patchInstructionArray(instructions, 'item-B', 'item-A');
    expect(instructions[0].ingredients[0].canonicalItemId).toBe(originalId);
  });

  it('returns changed:false when no match found', () => {
    const instructions = [step([ing('item-A')])];
    const { changed } = patchInstructionArray(instructions, 'item-Z', 'item-A');
    expect(changed).toBe(false);
  });

  it('handles steps with no ingredients array', () => {
    const instructions = [{ id: 's1', text: 'Preheat oven' }];
    const { patched, changed } = patchInstructionArray(instructions as any, 'item-B', 'item-A');
    expect(changed).toBe(false);
    expect(patched).toHaveLength(1);
  });

  it('handles empty instructions array', () => {
    const { patched, changed } = patchInstructionArray([], 'item-B', 'item-A');
    expect(changed).toBe(false);
    expect(patched).toHaveLength(0);
  });
});

// ── ingredientArrayReferences ──────────────────────────────────────────────────

describe('ingredientArrayReferences', () => {
  it('returns true when the id is referenced', () => {
    const ingredients = [ing('item-A'), ing('item-B')];
    expect(ingredientArrayReferences(ingredients, 'item-B')).toBe(true);
  });

  it('returns false when the id is not referenced', () => {
    const ingredients = [ing('item-A'), ing('item-C')];
    expect(ingredientArrayReferences(ingredients, 'item-B')).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(ingredientArrayReferences([], 'item-A')).toBe(false);
  });
});

// ── instructionArrayReferences ─────────────────────────────────────────────────

describe('instructionArrayReferences', () => {
  it('returns true when id is referenced in a step', () => {
    const instructions = [step([ing('item-A')]), step([ing('item-B')])];
    expect(instructionArrayReferences(instructions, 'item-B')).toBe(true);
  });

  it('returns false when id is not in any step', () => {
    const instructions = [step([ing('item-A')]), step([ing('item-C')])];
    expect(instructionArrayReferences(instructions, 'item-B')).toBe(false);
  });

  it('returns false for steps without ingredients', () => {
    const instructions = [{ id: 's1', text: 'Preheat' }];
    expect(instructionArrayReferences(instructions as any, 'item-A')).toBe(false);
  });
});

// ── mergeItemSynonyms ──────────────────────────────────────────────────────────

describe('mergeItemSynonyms', () => {
  it('unions two distinct synonym arrays', () => {
    const result = mergeItemSynonyms(['onion', 'brown onion'], ['spanish onion', 'white onion']);
    expect(result).toEqual(expect.arrayContaining(['onion', 'brown onion', 'spanish onion', 'white onion']));
    expect(result).toHaveLength(4);
  });

  it('deduplicates synonyms that appear in both arrays', () => {
    const result = mergeItemSynonyms(['onion', 'shallot'], ['shallot', 'white onion']);
    expect(result.filter(s => s === 'shallot')).toHaveLength(1);
  });

  it('trims whitespace from synonyms', () => {
    const result = mergeItemSynonyms(['  onion  '], ['brown onion ']);
    expect(result).toContain('onion');
    expect(result).toContain('brown onion');
  });

  it('discards empty strings', () => {
    const result = mergeItemSynonyms(['onion', ''], ['', 'shallot']);
    expect(result).not.toContain('');
    expect(result).toHaveLength(2);
  });

  it('handles both arrays being empty', () => {
    expect(mergeItemSynonyms([], [])).toEqual([]);
  });

  it('handles one empty array', () => {
    const result = mergeItemSynonyms(['onion', 'shallot'], []);
    expect(result).toEqual(['onion', 'shallot']);
  });

  it('does not mutate either input array', () => {
    const a = ['onion'];
    const b = ['shallot'];
    mergeItemSynonyms(a, b);
    expect(a).toEqual(['onion']);
    expect(b).toEqual(['shallot']);
  });
});

// ── isValidAisleMerge ──────────────────────────────────────────────────────────

describe('isValidAisleMerge', () => {
  it('returns true for two normal aisles', () => {
    expect(isValidAisleMerge('produce', 'dairy-eggs')).toBe(true);
  });

  it('returns true when primary is uncategorised (it survives)', () => {
    expect(isValidAisleMerge(UNCATEGORISED_AISLE_ID, 'dairy-eggs')).toBe(true);
  });

  it('returns false when secondary would be uncategorised', () => {
    expect(isValidAisleMerge('produce', UNCATEGORISED_AISLE_ID)).toBe(false);
  });

  it('returns false when primary and secondary are the same id', () => {
    expect(isValidAisleMerge('produce', 'produce')).toBe(false);
  });
});
