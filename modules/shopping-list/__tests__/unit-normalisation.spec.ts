import { describe, it, expect } from 'vitest';
import {
  normaliseToBase,
  canReconcile,
  getUnitCategory,
  formatQty,
} from '../logic/unit-normalisation';

describe('getUnitCategory', () => {
  it('classifies weight units', () => {
    expect(getUnitCategory('g')).toBe('weight');
    expect(getUnitCategory('kg')).toBe('weight');
    expect(getUnitCategory('G')).toBe('weight');
  });

  it('classifies volume units', () => {
    expect(getUnitCategory('ml')).toBe('volume');
    expect(getUnitCategory('l')).toBe('volume');
    expect(getUnitCategory('tsp')).toBe('volume');
    expect(getUnitCategory('tbsp')).toBe('volume');
  });

  it('classifies count units', () => {
    expect(getUnitCategory('whole')).toBe('count');
    expect(getUnitCategory('')).toBe('count');
    expect(getUnitCategory('clove')).toBe('count');
    expect(getUnitCategory('cloves')).toBe('count');
    expect(getUnitCategory('tin')).toBe('count');
    expect(getUnitCategory('pack')).toBe('count');
  });

  it('classifies unknown as colloquial', () => {
    expect(getUnitCategory('knob')).toBe('colloquial');
    expect(getUnitCategory('handful')).toBe('colloquial');
    expect(getUnitCategory('pinch')).toBe('colloquial');
    expect(getUnitCategory('glug')).toBe('colloquial');
  });
});

describe('normaliseToBase', () => {
  it('converts kg to grams', () => {
    const result = normaliseToBase(1.5, 'kg');
    expect(result).toEqual({ qty: 1500, baseUnit: 'g' });
  });

  it('keeps grams as grams', () => {
    const result = normaliseToBase(250, 'g');
    expect(result).toEqual({ qty: 250, baseUnit: 'g' });
  });

  it('converts l to ml', () => {
    const result = normaliseToBase(0.5, 'l');
    expect(result).toEqual({ qty: 500, baseUnit: 'ml' });
  });

  it('converts tsp to ml', () => {
    const result = normaliseToBase(2, 'tsp');
    expect(result).toEqual({ qty: 10, baseUnit: 'ml' });
  });

  it('converts tbsp to ml', () => {
    const result = normaliseToBase(3, 'tbsp');
    expect(result).toEqual({ qty: 45, baseUnit: 'ml' });
  });

  it('keeps count units as-is', () => {
    const result = normaliseToBase(2, 'cloves');
    expect(result).toEqual({ qty: 2, baseUnit: 'cloves' });
  });

  it('keeps colloquial units as-is', () => {
    const result = normaliseToBase(1, 'knob');
    expect(result).toEqual({ qty: 1, baseUnit: 'knob' });
  });

  it('handles empty unit string', () => {
    const result = normaliseToBase(3, '');
    expect(result).toEqual({ qty: 3, baseUnit: 'whole' });
  });
});

describe('canReconcile', () => {
  it('reconciles weight units', () => {
    expect(canReconcile('g', 'kg')).toBe(true);
    expect(canReconcile('kg', 'g')).toBe(true);
  });

  it('reconciles volume units', () => {
    expect(canReconcile('ml', 'l')).toBe(true);
    expect(canReconcile('tsp', 'tbsp')).toBe(true);
    expect(canReconcile('ml', 'tbsp')).toBe(true);
  });

  it('reconciles count units', () => {
    expect(canReconcile('clove', 'cloves')).toBe(true);
    expect(canReconcile('tin', 'tins')).toBe(true);
  });

  it('does not reconcile weight with volume', () => {
    expect(canReconcile('g', 'ml')).toBe(false);
    expect(canReconcile('kg', 'l')).toBe(false);
  });

  it('does not reconcile weight with count', () => {
    expect(canReconcile('g', 'cloves')).toBe(false);
  });

  it('does not reconcile different colloquial units', () => {
    expect(canReconcile('knob', 'handful')).toBe(false);
  });

  it('reconciles same colloquial unit', () => {
    expect(canReconcile('knob', 'knob')).toBe(true);
  });
});

describe('formatQty', () => {
  it('formats whole numbers without decimal', () => {
    expect(formatQty(4)).toBe('4');
    expect(formatQty(100)).toBe('100');
  });

  it('formats fractional numbers to 1dp', () => {
    expect(formatQty(1.5)).toBe('1.5');
    expect(formatQty(0.333)).toBe('0.3');
  });
});
