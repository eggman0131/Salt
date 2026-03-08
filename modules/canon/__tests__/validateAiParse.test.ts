/**
 * AI Parse Validation Tests
 *
 * Test deterministic validation and repair logic.
 */

import { describe, it, expect } from 'vitest';
import { validateAiParseResults } from '../logic/validateAiParse';
import { AiSingleParseResult } from '../types';

describe('validateAiParseResults', () => {
  const validAisles = ['produce', 'dairy-eggs', 'meat-fish', 'uncategorised'];
  const validUnits = ['g', 'kg', 'ml', 'l', 'tbsp', 'tsp'];

  it('should pass valid results unchanged', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: '200g chicken',
        itemName: 'Chicken',
        quantity: 200,
        recipeUnitId: 'g',
        aisleId: 'meat-fish',
        preparations: ['diced'],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.totalCount).toBe(1);
    expect(batch.successCount).toBe(1);
    expect(batch.hasErrors).toBe(false);
    expect(batch.hasReviewFlags).toBe(false);
    expect(batch.results[0].reviewFlags).toEqual([]);
  });

  it('should repair invalid aisleId to uncategorised', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: '1 apple',
        itemName: 'Apple',
        quantity: 1,
        recipeUnitId: null,
        aisleId: 'invalid-aisle',
        preparations: [],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.results[0].aisleId).toBe('uncategorised');
    expect(batch.results[0].reviewFlags).toContain('invalid-aisle-id-repaired');
    expect(batch.hasReviewFlags).toBe(true);
  });

  it('should repair invalid unitId to null', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: '1 cup milk',
        itemName: 'Milk',
        quantity: 1,
        recipeUnitId: 'invalid-unit',
        aisleId: 'dairy-eggs',
        preparations: [],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.results[0].recipeUnitId).toBe(null);
    expect(batch.results[0].reviewFlags).toContain('invalid-unit-id-repaired');
  });

  it('should flag uncategorised aisle without suggestedAisleName', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: '100g spinach',
        itemName: 'Spinach',
        quantity: 100,
        recipeUnitId: 'g',
        aisleId: 'uncategorised',
        preparations: [],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.results[0].reviewFlags).toContain('missing-aisle-suggestion');
  });

  it('should not flag uncategorised with suggestedAisleName', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: '100g spinach',
        itemName: 'Spinach',
        quantity: 100,
        recipeUnitId: 'g',
        aisleId: 'uncategorised',
        suggestedAisleName: 'Produce',
        preparations: [],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.results[0].reviewFlags).not.toContain('missing-aisle-suggestion');
  });

  it('should repair missing preparations and notes arrays', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: '200g chicken',
        itemName: 'Chicken',
        quantity: 200,
        recipeUnitId: 'g',
        aisleId: 'meat-fish',
        preparations: undefined as any,
        notes: null as any,
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.results[0].preparations).toEqual([]);
    expect(batch.results[0].notes).toEqual([]);
    expect(batch.results[0].reviewFlags).toContain('data-repaired');
  });

  it('should detect out-of-range indices', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 5, // Out of range for array of length 1
        originalLine: '200g chicken',
        itemName: 'Chicken',
        quantity: 200,
        recipeUnitId: 'g',
        aisleId: 'meat-fish',
        preparations: [],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.hasErrors).toBe(true);
    expect(batch.errors).toBeDefined();
    expect(batch.errors![0]).toContain('out of range');
  });

  it('should detect duplicate indices', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: '200g chicken',
        itemName: 'Chicken',
        quantity: 200,
        recipeUnitId: 'g',
        aisleId: 'meat-fish',
        preparations: [],
        notes: [],
      },
      {
        index: 0, // Duplicate
        originalLine: '100g flour',
        itemName: 'Flour',
        quantity: 100,
        recipeUnitId: 'g',
        aisleId: 'pantry',
        preparations: [],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.hasErrors).toBe(true);
    expect(batch.errors).toBeDefined();
    expect(batch.errors?.[0]).toContain('duplicate index');
  });

  it('should sort results by index', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 2,
        originalLine: '200g chicken',
        itemName: 'Chicken',
        quantity: 200,
        recipeUnitId: 'g',
        aisleId: 'meat-fish',
        preparations: [],
        notes: [],
      },
      {
        index: 0,
        originalLine: '1 apple',
        itemName: 'Apple',
        quantity: 1,
        recipeUnitId: null,
        aisleId: 'produce',
        preparations: [],
        notes: [],
      },
      {
        index: 1,
        originalLine: '200ml milk',
        itemName: 'Milk',
        quantity: 200,
        recipeUnitId: 'ml',
        aisleId: 'dairy-eggs',
        preparations: [],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.results[0].index).toBe(0);
    expect(batch.results[1].index).toBe(1);
    expect(batch.results[2].index).toBe(2);
  });

  it('should handle multiple repair flags on single result', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: 'something',
        itemName: 'Test',
        quantity: 1,
        recipeUnitId: 'invalid-unit',
        aisleId: 'invalid-aisle',
        preparations: undefined as any,
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);
    const flags = batch.results[0].reviewFlags;

    expect(flags).toContain('invalid-aisle-id-repaired');
    expect(flags).toContain('invalid-unit-id-repaired');
    expect(flags).toContain('data-repaired');
    expect(flags).toContain('missing-aisle-suggestion');
  });

  it('should aggregate review flags across batch', () => {
    const results: AiSingleParseResult[] = [
      {
        index: 0,
        originalLine: 'valid item',
        itemName: 'Valid',
        quantity: 100,
        recipeUnitId: 'g',
        aisleId: 'produce',
        preparations: [],
        notes: [],
      },
      {
        index: 1,
        originalLine: 'invalid aisle',
        itemName: 'Invalid',
        quantity: 1,
        recipeUnitId: null,
        aisleId: 'bad-aisle',
        preparations: [],
        notes: [],
      },
    ];

    const batch = validateAiParseResults(results, validAisles, validUnits);

    expect(batch.hasReviewFlags).toBe(true);
    expect(batch.results[0].reviewFlags).toHaveLength(0);
    expect(batch.results[1].reviewFlags.length).toBeGreaterThan(0);
  });
});
