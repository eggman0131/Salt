import { describe, it, expect } from 'vitest';
import { sumContributions, hasUnitMismatch } from '../logic/aggregation';
import type { ShoppingListContribution } from '../types';

const now = new Date().toISOString();

function makeContrib(
  rawText: string,
  qty?: number,
  unit?: string,
  sourceType: 'recipe' | 'manual' = 'recipe'
): ShoppingListContribution {
  return {
    sourceType,
    recipeId: sourceType === 'recipe' ? 'rec-1' : undefined,
    recipeTitle: sourceType === 'recipe' ? 'Test Recipe' : undefined,
    rawText,
    qty,
    unit,
    addedBy: 'user-1',
    addedAt: now,
  };
}

describe('sumContributions', () => {
  it('returns zero for empty array', () => {
    const result = sumContributions([]);
    expect(result.totalBaseQty).toBe(0);
    expect(result.baseUnit).toBe('');
    expect(result.unreconciled).toHaveLength(0);
  });

  it('sums same weight units (grams)', () => {
    const contribs = [
      makeContrib('200g butter', 200, 'g'),
      makeContrib('100g butter', 100, 'g'),
    ];
    const result = sumContributions(contribs);
    expect(result.totalBaseQty).toBe(300);
    expect(result.baseUnit).toBe('g');
    expect(result.unreconciled).toHaveLength(0);
  });

  it('sums mixed weight units (g + kg)', () => {
    const contribs = [
      makeContrib('500g flour', 500, 'g'),
      makeContrib('0.5kg flour', 0.5, 'kg'),
    ];
    const result = sumContributions(contribs);
    expect(result.totalBaseQty).toBe(1000); // 500g + 500g
    expect(result.baseUnit).toBe('g');
  });

  it('sums volume units (ml + tsp)', () => {
    const contribs = [
      makeContrib('100ml milk', 100, 'ml'),
      makeContrib('2 tsp vanilla', 2, 'tsp'),
    ];
    const result = sumContributions(contribs);
    expect(result.totalBaseQty).toBe(110); // 100ml + 10ml
    expect(result.baseUnit).toBe('ml');
  });

  it('keeps count units as-is', () => {
    const contribs = [
      makeContrib('2 onions', 2, 'whole'),
      makeContrib('1 onion', 1, 'whole'),
    ];
    const result = sumContributions(contribs);
    expect(result.totalBaseQty).toBe(3);
    expect(result.baseUnit).toBe('whole');
  });

  it('returns unreconciled for irreconcilable units', () => {
    const contribs = [
      makeContrib('50g butter', 50, 'g'),
      makeContrib('1 knob butter', 1, 'knob'),
    ];
    const result = sumContributions(contribs);
    // Dominant group (grams) is used; knob is unreconciled
    expect(result.totalBaseQty).toBe(50);
    expect(result.baseUnit).toBe('g');
    expect(result.unreconciled).toHaveLength(1);
    expect(result.unreconciled[0].rawText).toBe('1 knob butter');
  });

  it('handles contributions without qty', () => {
    const contribs = [
      makeContrib('salt to taste', undefined, undefined),
      makeContrib('200g flour', 200, 'g'),
    ];
    const result = sumContributions(contribs);
    expect(result.totalBaseQty).toBe(200);
    expect(result.baseUnit).toBe('g');
    expect(result.unreconciled).toHaveLength(1); // salt to taste
  });

  it('rounds to 2 decimal places', () => {
    const contribs = [
      makeContrib('1 tsp oil', 1, 'tsp'), // 5ml
      makeContrib('0.5 tsp oil', 0.5, 'tsp'), // 2.5ml
    ];
    const result = sumContributions(contribs);
    expect(result.totalBaseQty).toBe(7.5);
  });
});

describe('hasUnitMismatch', () => {
  it('returns false when all units reconcile', () => {
    const contribs = [
      makeContrib('100g', 100, 'g'),
      makeContrib('200g', 200, 'g'),
    ];
    expect(hasUnitMismatch(contribs)).toBe(false);
  });

  it('returns true when units cannot be reconciled', () => {
    const contribs = [
      makeContrib('50g butter', 50, 'g'),
      makeContrib('1 knob', 1, 'knob'),
    ];
    expect(hasUnitMismatch(contribs)).toBe(true);
  });

  it('returns false for empty contributions', () => {
    expect(hasUnitMismatch([])).toBe(false);
  });
});
