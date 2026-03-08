/**
 * Pure logic tests for the recipes module.
 *
 * No Firebase, no mocks, no side effects.
 * These run instantly and are completely deterministic.
 */

import { describe, it, expect } from 'vitest';
import { buildManualEditSummary, createHistoryEntry } from '../logic/recipe-updates';
import { sanitizeJson, pruneHistory, normalizeInstructions, normalizeRecipeData } from '../logic/normalize-recipe';
import { normalizeConversationTurns, normalizeGenerationContext, normalizeRepairOptions } from '../logic/ai-inputs';
import type { Recipe } from '../../../types/contract';

// ── Shared fixture ──────────────────────────────────────────────────────────

const baseRecipe: Recipe = {
  id: 'r1',
  title: 'Test Recipe',
  description: 'A test description',
  ingredients: [],
  instructions: [],
  equipmentNeeded: [],
  prepTime: '10m',
  cookTime: '20m',
  totalTime: '30m',
  servings: '2',
  complexity: 'Intermediate',
  createdAt: '2024-01-01T00:00:00.000Z',
  createdBy: 'user1',
};

// ── buildManualEditSummary ──────────────────────────────────────────────────

describe('buildManualEditSummary', () => {
  it('returns fallback message when nothing changed', () => {
    const result = buildManualEditSummary(baseRecipe, baseRecipe);
    expect(result).toBe('Manually edited recipe');
  });

  it('detects title change', () => {
    const after = { ...baseRecipe, title: 'New Title' };
    expect(buildManualEditSummary(baseRecipe, after)).toContain('title');
  });

  it('detects description change', () => {
    const after = { ...baseRecipe, description: 'Updated description' };
    expect(buildManualEditSummary(baseRecipe, after)).toContain('description');
  });

  it('detects ingredients added', () => {
    const ing = { id: 'i1', raw: 'flour', quantity: 100, unit: 'g', ingredientName: 'flour' };
    const after = { ...baseRecipe, ingredients: [ing, { ...ing, id: 'i2' }] };
    const before = { ...baseRecipe, ingredients: [ing] };
    expect(buildManualEditSummary(before, after)).toContain('ingredients (+1)');
  });

  it('detects ingredients removed', () => {
    const ing = { id: 'i1', raw: 'flour', quantity: 100, unit: 'g', ingredientName: 'flour' };
    const before = { ...baseRecipe, ingredients: [ing, { ...ing, id: 'i2' }] };
    const after = { ...baseRecipe, ingredients: [ing] };
    expect(buildManualEditSummary(before, after)).toContain('ingredients (-1)');
  });

  it('detects ingredients modified (same count)', () => {
    const ing1 = { id: 'i1', raw: 'flour', quantity: 100, unit: 'g', ingredientName: 'flour' };
    const ing2 = { id: 'i1', raw: 'flour', quantity: 200, unit: 'g', ingredientName: 'flour' };
    const before = { ...baseRecipe, ingredients: [ing1] };
    const after = { ...baseRecipe, ingredients: [ing2] };
    const result = buildManualEditSummary(before, after);
    expect(result).toContain('ingredients');
    expect(result).not.toContain('+');
    expect(result).not.toContain('-');
  });

  it('detects steps added', () => {
    const step = { id: 's1', text: 'Mix', ingredients: [], technicalWarnings: [] };
    const before = { ...baseRecipe, instructions: [step] };
    const after = { ...baseRecipe, instructions: [step, { ...step, id: 's2', text: 'Bake' }] };
    expect(buildManualEditSummary(before, after)).toContain('steps (+1)');
  });

  it('detects steps removed', () => {
    const step = { id: 's1', text: 'Mix', ingredients: [], technicalWarnings: [] };
    const before = { ...baseRecipe, instructions: [step, { ...step, id: 's2' }] };
    const after = { ...baseRecipe, instructions: [step] };
    expect(buildManualEditSummary(before, after)).toContain('steps (-1)');
  });

  it('detects category change', () => {
    const before = { ...baseRecipe, categoryIds: ['cat-1'] };
    const after = { ...baseRecipe, categoryIds: ['cat-2'] };
    expect(buildManualEditSummary(before, after)).toContain('categories');
  });

  it('reports multiple changed fields', () => {
    const after = { ...baseRecipe, title: 'New Title', description: 'New desc' };
    const result = buildManualEditSummary(baseRecipe, after);
    expect(result).toContain('title');
    expect(result).toContain('description');
  });
});

// ── createHistoryEntry ─────────────────────────────────────────────────────

describe('createHistoryEntry', () => {
  it('returns an entry with the correct shape', () => {
    const entry = createHistoryEntry(baseRecipe, 'Edited title', 'alice');
    expect(entry.changeDescription).toBe('Edited title');
    expect(entry.userName).toBe('alice');
    expect(typeof entry.timestamp).toBe('string');
    expect(entry.snapshot).toBeDefined();
  });

  it('strips history from the snapshot', () => {
    const recipeWithHistory = {
      ...baseRecipe,
      history: [{ timestamp: 't', changeDescription: 'old', snapshot: baseRecipe }],
    };
    const entry = createHistoryEntry(recipeWithHistory, 'Edit', 'alice');
    expect((entry.snapshot as any).history).toBeUndefined();
  });

  it('does not mutate the original recipe', () => {
    const recipeWithHistory = {
      ...baseRecipe,
      history: [{ timestamp: 't', changeDescription: 'old', snapshot: baseRecipe }],
    };
    createHistoryEntry(recipeWithHistory, 'Edit', 'alice');
    expect(recipeWithHistory.history).toHaveLength(1);
  });
});

// ── sanitizeJson ───────────────────────────────────────────────────────────

describe('sanitizeJson', () => {
  it('returns a plain JSON array unchanged', () => {
    expect(sanitizeJson('["a", "b"]')).toBe('["a", "b"]');
  });

  it('returns a plain JSON object unchanged', () => {
    expect(sanitizeJson('{"id": 1}')).toBe('{"id": 1}');
  });

  it('strips preamble before a JSON object', () => {
    expect(sanitizeJson('Here is the result: {"id": 1}')).toBe('{"id": 1}');
  });

  it('strips markdown fences around a JSON array', () => {
    const input = '```json\n["a", "b"]\n```';
    expect(sanitizeJson(input)).toBe('["a", "b"]');
  });

  it('prefers array over object when array starts first', () => {
    // Unusual but possible: "[{"key": "val"}]"
    const input = '[{"key": "val"}]';
    const result = sanitizeJson(input);
    expect(result.startsWith('[')).toBe(true);
  });

  it('trims and returns text with no JSON as-is', () => {
    expect(sanitizeJson('  no json here  ')).toBe('no json here');
  });
});

// ── pruneHistory ───────────────────────────────────────────────────────────

describe('pruneHistory', () => {
  const turn = (role: string, i: number) => ({ role, text: `msg ${i}` });

  it('returns history unchanged when within limit', () => {
    const history = [turn('user', 1), turn('ai', 2)];
    expect(pruneHistory(history, 5)).toHaveLength(2);
  });

  it('prunes to the most recent maxTurns * 2 messages', () => {
    const history = Array.from({ length: 40 }, (_, i) =>
      turn(i % 2 === 0 ? 'user' : 'ai', i)
    );
    const result = pruneHistory(history, 15);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it('ensures pruned history always starts with a user turn', () => {
    // Build a history where after slicing the first message would be 'ai'
    const history = [
      turn('user', 0),
      turn('ai', 1),
      turn('ai', 2), // two consecutive ai turns (edge case)
      turn('user', 3),
      turn('ai', 4),
    ];
    const result = pruneHistory(history, 1); // maxTurns=1 → maxMessages=2
    expect(result[0].role).toBe('user');
  });
});

// ── normalizeInstructions ──────────────────────────────────────────────────

describe('normalizeInstructions', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeInstructions([])).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(normalizeInstructions(null as any)).toEqual([]);
  });

  it('converts string instructions to objects with generated IDs', () => {
    const result = normalizeInstructions(['Boil water', 'Add pasta']);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Boil water');
    expect(result[0].id).toMatch(/^step-/);
    expect(result[0].ingredients).toEqual([]);
    expect(result[0].technicalWarnings).toEqual([]);
  });

  it('preserves existing id and text on already-structured objects', () => {
    const input = [{ id: 'step-abc', text: 'Stir', ingredients: [], technicalWarnings: [] }];
    const result = normalizeInstructions(input);
    expect(result[0].id).toBe('step-abc');
    expect(result[0].text).toBe('Stir');
  });

  it('preserves ingredients and technicalWarnings from structured objects', () => {
    const ing = { id: 'i1', raw: 'flour', quantity: null, unit: null, ingredientName: 'flour' };
    const input = [{ id: 'step-abc', text: 'Mix', ingredients: [ing], technicalWarnings: ['Hot!'] }];
    const result = normalizeInstructions(input);
    expect(result[0].ingredients).toEqual([ing]);
    expect(result[0].technicalWarnings).toEqual(['Hot!']);
  });
});

// ── normalizeRecipeData ────────────────────────────────────────────────────

describe('normalizeRecipeData', () => {
  it('uses alias fields when canonical fields are missing', () => {
    const raw = { recipeName: 'Pasta', summary: 'Quick pasta dish' };
    const result = normalizeRecipeData(raw);
    expect(result.title).toBe('Pasta');
    expect(result.description).toBe('Quick pasta dish');
  });

  it('defaults title to "Untitled Recipe" when no alias exists', () => {
    const result = normalizeRecipeData({});
    expect(result.title).toBe('Untitled Recipe');
  });

  it('uses ingredientList alias for ingredients', () => {
    const raw = { ingredientList: ['flour', 'butter'] };
    const result = normalizeRecipeData(raw);
    expect(Array.isArray(result.ingredients)).toBe(true);
  });

  it('splits string instructions by newline', () => {
    const raw = { title: 'T', instructions: 'Step 1\nStep 2\nStep 3' };
    const result = normalizeRecipeData(raw);
    expect(Array.isArray(result.instructions)).toBe(true);
    expect((result.instructions as any[]).length).toBe(3);
  });

  it('unwraps array-wrapped raw input', () => {
    const raw = [{ title: 'Wrapped Recipe' }];
    const result = normalizeRecipeData(raw);
    expect(result.title).toBe('Wrapped Recipe');
  });

  it('does not overwrite fields that are already present', () => {
    const raw = { title: 'My Recipe', recipeName: 'Should not override' };
    const result = normalizeRecipeData(raw);
    expect(result.title).toBe('My Recipe');
  });
});

// ── normalizeConversationTurns ─────────────────────────────────────────────

describe('normalizeConversationTurns', () => {
  it('returns empty array for undefined', () => {
    expect(normalizeConversationTurns(undefined)).toEqual([]);
  });

  it('filters out null/undefined turns', () => {
    const turns = [null, { role: 'user' as const, text: 'hello' }, undefined] as any;
    const result = normalizeConversationTurns(turns);
    expect(result).toHaveLength(1);
  });

  it('filters out turns with invalid roles', () => {
    const turns = [
      { role: 'system' as any, text: 'ignore me' },
      { role: 'user' as const, text: 'keep me' },
    ];
    const result = normalizeConversationTurns(turns);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  it('filters out turns with empty or whitespace-only text', () => {
    const turns = [
      { role: 'user' as const, text: '   ' },
      { role: 'ai' as const, text: 'a response' },
    ];
    const result = normalizeConversationTurns(turns);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('a response');
  });

  it('preserves valid turns in order', () => {
    const turns = [
      { role: 'user' as const, text: 'first' },
      { role: 'ai' as const, text: 'second' },
    ];
    expect(normalizeConversationTurns(turns)).toEqual(turns);
  });
});

// ── normalizeGenerationContext ─────────────────────────────────────────────

describe('normalizeGenerationContext', () => {
  it('returns undefined for undefined input', () => {
    expect(normalizeGenerationContext(undefined)).toBeUndefined();
  });

  it('normalizes history within the context', () => {
    const context = {
      currentRecipe: baseRecipe,
      history: [
        { role: 'user' as const, text: 'make pasta' },
        { role: 'ai' as const, text: '   ' }, // should be filtered
      ],
    };
    const result = normalizeGenerationContext(context);
    expect(result?.history).toHaveLength(1);
    expect(result?.currentRecipe).toBe(baseRecipe);
  });
});

// ── normalizeRepairOptions ─────────────────────────────────────────────────

describe('normalizeRepairOptions', () => {
  it('coerces truthy values to true', () => {
    const result = normalizeRepairOptions({ categorize: 1 as any, relinkIngredients: 'yes' as any });
    expect(result.categorize).toBe(true);
    expect(result.relinkIngredients).toBe(true);
  });

  it('coerces falsy values to false', () => {
    const result = normalizeRepairOptions({ categorize: undefined, relinkIngredients: null as any });
    expect(result.categorize).toBe(false);
    expect(result.relinkIngredients).toBe(false);
  });

  it('preserves boolean true values', () => {
    const result = normalizeRepairOptions({ categorize: true, relinkIngredients: true });
    expect(result).toEqual({ categorize: true, relinkIngredients: true });
  });
});
