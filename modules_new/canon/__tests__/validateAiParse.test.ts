/**
 * Canon Module – validateAiParse Tests
 *
 * Tests for the pure deterministic validation and repair logic in
 * logic/validateAiParse.ts.
 */

import { describe, it, expect } from 'vitest';
import { validateAiParseResults } from '../logic/validateAiParse';
import { UNCATEGORISED_AISLE } from '../types';
import type {
  AiIngredientParseResult,
  AisleRef,
  UnitRef,
} from '../types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const AISLES: AisleRef[] = [
  { id: 'produce', name: 'Produce' },
  { id: 'dairy', name: 'Dairy & Eggs' },
  { id: 'meat', name: 'Meat & Fish' },
  UNCATEGORISED_AISLE,
];

const UNITS: UnitRef[] = [
  { id: 'g', name: 'g', plural: null },
  { id: 'kg', name: 'kg', plural: null },
  { id: 'ml', name: 'ml', plural: null },
  { id: 'tsp', name: 'tsp', plural: 'tsps' },
];

function makeResult(
  overrides: Partial<AiIngredientParseResult> & { index: number },
): AiIngredientParseResult {
  return {
    quantity: null,
    recipeUnitId: null,
    preferredUnitId: null,
    canonicalName: 'Ingredient',
    aisleId: 'produce',
    suggestedAisleName: null,
    preparations: [],
    notes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Happy-path tests
// ---------------------------------------------------------------------------

describe('validateAiParseResults – happy path', () => {
  it('returns clean results when the AI response is fully valid', () => {
    const raw = [
      makeResult({ index: 0, aisleId: 'produce', recipeUnitId: 'g' }),
      makeResult({ index: 1, aisleId: 'dairy', recipeUnitId: null }),
    ];

    const { items, hasReviewFlags } = validateAiParseResults(
      raw,
      AISLES,
      UNITS,
      2,
    );

    expect(items).toHaveLength(2);
    expect(hasReviewFlags).toBe(false);
    items.forEach((item) => expect(item.flags).toHaveLength(0));
  });

  it('preserves all fields on a clean result', () => {
    const raw = [
      makeResult({
        index: 0,
        quantity: 200,
        recipeUnitId: 'g',
        preferredUnitId: 'kg',
        canonicalName: 'Chicken Breast',
        aisleId: 'meat',
        preparations: ['diced'],
        notes: ['free-range'],
      }),
    ];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    const { result } = items[0];
    expect(result.quantity).toBe(200);
    expect(result.recipeUnitId).toBe('g');
    expect(result.preferredUnitId).toBe('kg');
    expect(result.canonicalName).toBe('Chicken Breast');
    expect(result.aisleId).toBe('meat');
    expect(result.preparations).toEqual(['diced']);
    expect(result.notes).toEqual(['free-range']);
  });
});

// ---------------------------------------------------------------------------
// Invalid aisleId
// ---------------------------------------------------------------------------

describe('validateAiParseResults – invalid aisleId', () => {
  it('resets an unknown aisleId to "uncategorised" and raises INVALID_AISLE_ID', () => {
    const raw = [makeResult({ index: 0, aisleId: 'unknown-aisle' })];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(items[0].result.aisleId).toBe(UNCATEGORISED_AISLE.id);
    expect(items[0].flags.some((f) => f.code === 'INVALID_AISLE_ID')).toBe(true);
  });

  it('accepts "uncategorised" as a valid aisleId without flagging INVALID_AISLE_ID', () => {
    const raw = [
      makeResult({
        index: 0,
        aisleId: UNCATEGORISED_AISLE.id,
        suggestedAisleName: 'Herbs',
      }),
    ];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(items[0].result.aisleId).toBe(UNCATEGORISED_AISLE.id);
    expect(items[0].flags.some((f) => f.code === 'INVALID_AISLE_ID')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Missing suggestedAisleName
// ---------------------------------------------------------------------------

describe('validateAiParseResults – suggestedAisleName', () => {
  it('raises MISSING_SUGGESTED_AISLE_NAME when aisleId is "uncategorised" and suggestedAisleName is null', () => {
    const raw = [
      makeResult({
        index: 0,
        aisleId: UNCATEGORISED_AISLE.id,
        suggestedAisleName: null,
      }),
    ];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(
      items[0].flags.some((f) => f.code === 'MISSING_SUGGESTED_AISLE_NAME'),
    ).toBe(true);
  });

  it('does not raise MISSING_SUGGESTED_AISLE_NAME when suggestedAisleName is provided', () => {
    const raw = [
      makeResult({
        index: 0,
        aisleId: UNCATEGORISED_AISLE.id,
        suggestedAisleName: 'Herbs & Spices',
      }),
    ];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(
      items[0].flags.some((f) => f.code === 'MISSING_SUGGESTED_AISLE_NAME'),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invalid unit IDs
// ---------------------------------------------------------------------------

describe('validateAiParseResults – unit IDs', () => {
  it('resets an invalid recipeUnitId to null and raises INVALID_RECIPE_UNIT_ID', () => {
    const raw = [makeResult({ index: 0, recipeUnitId: 'cups' })];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(items[0].result.recipeUnitId).toBeNull();
    expect(
      items[0].flags.some((f) => f.code === 'INVALID_RECIPE_UNIT_ID'),
    ).toBe(true);
  });

  it('resets an invalid preferredUnitId to null and raises INVALID_PREFERRED_UNIT_ID', () => {
    const raw = [makeResult({ index: 0, preferredUnitId: 'ounces' })];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(items[0].result.preferredUnitId).toBeNull();
    expect(
      items[0].flags.some((f) => f.code === 'INVALID_PREFERRED_UNIT_ID'),
    ).toBe(true);
  });

  it('accepts null unit IDs without flagging', () => {
    const raw = [
      makeResult({ index: 0, recipeUnitId: null, preferredUnitId: null }),
    ];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(items[0].result.recipeUnitId).toBeNull();
    expect(items[0].result.preferredUnitId).toBeNull();
    expect(items[0].flags).toHaveLength(0);
  });

  it('accepts valid unit IDs without flagging', () => {
    const raw = [
      makeResult({ index: 0, recipeUnitId: 'g', preferredUnitId: 'kg' }),
    ];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(items[0].result.recipeUnitId).toBe('g');
    expect(items[0].result.preferredUnitId).toBe('kg');
    expect(items[0].flags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Index coverage and uniqueness
// ---------------------------------------------------------------------------

describe('validateAiParseResults – index coverage', () => {
  it('synthesises a fallback result for a missing index and raises MISSING_INDEX', () => {
    // AI returned index 0 and 2 but skipped index 1
    const raw = [
      makeResult({ index: 0 }),
      makeResult({ index: 2 }),
    ];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 3);

    expect(items).toHaveLength(3);
    expect(items[1].flags.some((f) => f.code === 'MISSING_INDEX')).toBe(true);
    // Fallback should have empty canonicalName and uncategorised aisle
    expect(items[1].result.canonicalName).toBe('');
    expect(items[1].result.aisleId).toBe(UNCATEGORISED_AISLE.id);
  });

  it('flags duplicate indices and uses first occurrence', () => {
    const raw = [
      makeResult({ index: 0, canonicalName: 'First' }),
      makeResult({ index: 0, canonicalName: 'Duplicate' }),
    ];

    const { items } = validateAiParseResults(raw, AISLES, UNITS, 1);

    expect(items[0].result.canonicalName).toBe('First');
    expect(items[0].flags.some((f) => f.code === 'DUPLICATE_INDEX')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasReviewFlags
// ---------------------------------------------------------------------------

describe('validateAiParseResults – hasReviewFlags', () => {
  it('returns hasReviewFlags=false when all results are clean', () => {
    const raw = [makeResult({ index: 0 })];
    const { hasReviewFlags } = validateAiParseResults(raw, AISLES, UNITS, 1);
    expect(hasReviewFlags).toBe(false);
  });

  it('returns hasReviewFlags=true when any result has flags', () => {
    const raw = [
      makeResult({ index: 0 }),
      makeResult({ index: 1, aisleId: 'bad-aisle' }),
    ];
    const { hasReviewFlags } = validateAiParseResults(raw, AISLES, UNITS, 2);
    expect(hasReviewFlags).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('validateAiParseResults – empty input', () => {
  it('returns empty items and no flags for zero ingredients', () => {
    const { items, hasReviewFlags } = validateAiParseResults([], [], [], 0);
    expect(items).toHaveLength(0);
    expect(hasReviewFlags).toBe(false);
  });
});
