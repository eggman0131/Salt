/**
 * Canon Module — Pure logic tests
 *
 * No Firebase, no mocks, no side effects.
 * All tests are deterministic and run instantly.
 */

import { describe, it, expect } from 'vitest';
import {
  sortAisles,
  findAisleById,
  findAisleByName,
  hasUncategorisedAisle,
  validateAisleDoc,
  UNCATEGORISED_AISLE_ID,
  CanonAisleSchema,
} from '../logic/aisles';
import {
  sortUnits,
  findUnitById,
  groupUnitsByCategory,
  validateUnitDoc,
  CanonUnitSchema,
} from '../logic/units';
import {
  sortItems,
  findItemById,
  findItemByName,
  normalizeItemName,
  filterUnapprovedItems,
  filterItemsByAisle,
  validateItemDoc,
  CanonItem,
} from '../logic/items';
import { Aisle, Unit } from '../../../types/contract';

const DEFAULT_UNIT: CanonItem['unit'] = { canonical_unit: 'g', density_g_per_ml: null };
const DEFAULT_AISLE: CanonItem['aisle'] = { tier1: 'produce', tier2: 'fresh', tier3: 'food' };
const BASE_ITEM = { normalisedName: '', synonyms: [] as string[], itemType: 'ingredient' as const, allergens: [] as string[], barcodes: [] as string[], externalSources: [] as CanonItem['externalSources'] };

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AISLES: Aisle[] = [
  { id: 'pantry', name: 'Pantry', tier2: 'ambient', tier3: 'food', sortOrder: 50, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'produce', name: 'Produce', tier2: 'fresh', tier3: 'food', sortOrder: 10, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'frozen', name: 'Frozen', tier2: 'frozen', tier3: 'food', sortOrder: 60, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'uncategorised', name: 'Uncategorised', tier2: 'system', tier3: 'system', sortOrder: 999, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', tier2: 'fresh', tier3: 'food', sortOrder: 30, createdAt: '2024-01-01T00:00:00.000Z' },
];

const UNITS: Unit[] = [
  { id: 'g', name: 'g', plural: null, category: 'weight', sortOrder: 1 },
  { id: 'kg', name: 'kg', plural: null, category: 'weight', sortOrder: 2 },
  { id: 'ml', name: 'ml', plural: null, category: 'volume', sortOrder: 4 },
  { id: 'tsp', name: 'tsp', plural: 'tsps', category: 'volume', sortOrder: 6 },
  { id: 'clove', name: 'clove', plural: 'cloves', category: 'count', sortOrder: 8 },
  { id: 'pinch', name: 'pinch', plural: null, category: 'colloquial', sortOrder: 26 },
  { id: 'handful', name: 'handful', plural: 'handfuls', category: 'colloquial', sortOrder: 28 },
];

const ITEMS: CanonItem[] = [
  { ...BASE_ITEM, id: 'item-carrot', name: 'Carrot', normalisedName: 'carrot', aisleId: 'produce', aisle: DEFAULT_AISLE, unit: DEFAULT_UNIT, approved: true, isStaple: false, createdAt: '2024-01-01T00:00:00.000Z' },
  { ...BASE_ITEM, id: 'item-onion', name: 'Onion', normalisedName: 'onion', aisleId: 'produce', aisle: DEFAULT_AISLE, unit: DEFAULT_UNIT, approved: false, isStaple: false, createdAt: '2024-01-01T00:00:00.000Z' },
  { ...BASE_ITEM, id: 'item-butter', name: 'Butter', normalisedName: 'butter', aisleId: 'dairy-eggs', aisle: { tier1: 'dairy & eggs', tier2: 'chilled', tier3: 'food' }, unit: DEFAULT_UNIT, approved: true, isStaple: false, createdAt: '2024-01-01T00:00:00.000Z' },
  { ...BASE_ITEM, id: 'item-salt', name: 'Salt', normalisedName: 'salt', aisleId: 'pantry', aisle: { tier1: 'pantry', tier2: 'ambient', tier3: 'food' }, unit: DEFAULT_UNIT, approved: false, isStaple: false, createdAt: '2024-01-01T00:00:00.000Z' },
  { ...BASE_ITEM, id: 'item-apple', name: 'Apple', normalisedName: 'apple', aisleId: 'produce', aisle: DEFAULT_AISLE, unit: DEFAULT_UNIT, approved: true, isStaple: false, createdAt: '2024-01-01T00:00:00.000Z' },
];

// ── sortAisles ────────────────────────────────────────────────────────────────

describe('sortAisles', () => {
  it('sorts aisles by sortOrder ascending', () => {
    const sorted = sortAisles(AISLES);
    expect(sorted.map(a => a.id)).toEqual([
      'produce',
      'dairy-eggs',
      'pantry',
      'frozen',
      'uncategorised',
    ]);
  });

  it('breaks ties alphabetically by name', () => {
    const tied: Aisle[] = [
      { id: 'b', name: 'Bakery', tier2: 'ambient', tier3: 'food', sortOrder: 10, createdAt: '' },
      { id: 'a', name: 'Alcohol', tier2: 'ambient', tier3: 'drink', sortOrder: 10, createdAt: '' },
    ];
    const sorted = sortAisles(tied);
    expect(sorted[0].name).toBe('Alcohol');
    expect(sorted[1].name).toBe('Bakery');
  });

  it('does not mutate the original array', () => {
    const original = [...AISLES];
    sortAisles(AISLES);
    expect(AISLES).toEqual(original);
  });
});

// ── findAisleById ─────────────────────────────────────────────────────────────

describe('findAisleById', () => {
  it('returns found:true with the aisle when id exists', () => {
    const result = findAisleById(AISLES, 'pantry');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.aisle.name).toBe('Pantry');
    }
  });

  it('returns found:false for an unknown id', () => {
    const result = findAisleById(AISLES, 'nonexistent');
    expect(result.found).toBe(false);
  });

  it('finds the uncategorised aisle', () => {
    const result = findAisleById(AISLES, UNCATEGORISED_AISLE_ID);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.aisle.id).toBe('uncategorised');
    }
  });
});

// ── findAisleByName ───────────────────────────────────────────────────────────

describe('findAisleByName', () => {
  it('finds an aisle by exact name', () => {
    const result = findAisleByName(AISLES, 'Pantry');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.aisle.id).toBe('pantry');
    }
  });

  it('is case-insensitive', () => {
    const result = findAisleByName(AISLES, 'PRODUCE');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.aisle.id).toBe('produce');
    }
  });

  it('trims whitespace', () => {
    const result = findAisleByName(AISLES, '  Frozen  ');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.aisle.id).toBe('frozen');
    }
  });

  it('returns found:false for an unknown name', () => {
    const result = findAisleByName(AISLES, 'Confectionery');
    expect(result.found).toBe(false);
  });
});

// ── hasUncategorisedAisle ─────────────────────────────────────────────────────

describe('hasUncategorisedAisle', () => {
  it('returns true when uncategorised is present', () => {
    expect(hasUncategorisedAisle(AISLES)).toBe(true);
  });

  it('returns false when uncategorised is absent', () => {
    const withoutSystem = AISLES.filter(a => a.id !== 'uncategorised');
    expect(hasUncategorisedAisle(withoutSystem)).toBe(false);
  });

  it('returns false for an empty list', () => {
    expect(hasUncategorisedAisle([])).toBe(false);
  });
});

// ── validateAisleDoc ──────────────────────────────────────────────────────────

describe('validateAisleDoc', () => {
  it('accepts a valid aisle document', () => {
    const doc = { id: 'produce', name: 'Produce', tier2: 'fresh', tier3: 'food', sortOrder: 10, createdAt: '2024-01-01T00:00:00.000Z' };
    const result = validateAisleDoc(doc);
    expect(result.success).toBe(true);
  });

  it('rejects a document with a missing name', () => {
    const doc = { id: 'produce', tier2: 'fresh', tier3: 'food', sortOrder: 10, createdAt: '2024-01-01T00:00:00.000Z' };
    const result = validateAisleDoc(doc);
    expect(result.success).toBe(false);
  });

  it('rejects a document with an empty id', () => {
    const doc = { id: '', name: 'Produce', tier2: 'fresh', tier3: 'food', sortOrder: 10, createdAt: '2024-01-01T00:00:00.000Z' };
    const result = validateAisleDoc(doc);
    expect(result.success).toBe(false);
  });

  it('applies the default sortOrder when omitted', () => {
    const doc = { id: 'produce', name: 'Produce', tier2: 'fresh', tier3: 'food' };
    const result = validateAisleDoc(doc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(999);
    }
  });

  it('accepts a document without createdAt', () => {
    const doc = { id: 'produce', name: 'Produce', tier2: 'fresh', tier3: 'food', sortOrder: 10 };
    const result = validateAisleDoc(doc);
    expect(result.success).toBe(true);
  });
});

// ── CanonAisleSchema constant ─────────────────────────────────────────────────

describe('UNCATEGORISED_AISLE_ID', () => {
  it('equals "uncategorised"', () => {
    expect(UNCATEGORISED_AISLE_ID).toBe('uncategorised');
  });
});

// ── sortUnits ─────────────────────────────────────────────────────────────────

describe('sortUnits', () => {
  it('sorts units by sortOrder ascending', () => {
    const sorted = sortUnits(UNITS);
    expect(sorted[0].id).toBe('g');
    expect(sorted[1].id).toBe('kg');
    expect(sorted[2].id).toBe('ml');
  });

  it('does not mutate the original array', () => {
    const original = [...UNITS];
    sortUnits(UNITS);
    expect(UNITS).toEqual(original);
  });
});

// ── findUnitById ──────────────────────────────────────────────────────────────

describe('findUnitById', () => {
  it('returns found:true with the unit when id exists', () => {
    const result = findUnitById(UNITS, 'tsp');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.unit.plural).toBe('tsps');
    }
  });

  it('returns found:false for an unknown id', () => {
    const result = findUnitById(UNITS, 'cup');
    expect(result.found).toBe(false);
  });
});

// ── groupUnitsByCategory ──────────────────────────────────────────────────────

describe('groupUnitsByCategory', () => {
  it('groups units into the four categories', () => {
    const grouped = groupUnitsByCategory(UNITS);
    expect(grouped.weight.map(u => u.id)).toEqual(['g', 'kg']);
    expect(grouped.volume.map(u => u.id)).toEqual(['ml', 'tsp']);
    expect(grouped.count.map(u => u.id)).toEqual(['clove']);
    expect(grouped.colloquial.map(u => u.id)).toEqual(['pinch', 'handful']);
  });

  it('returns empty arrays for categories with no units', () => {
    const grouped = groupUnitsByCategory([]);
    expect(grouped.weight).toEqual([]);
    expect(grouped.volume).toEqual([]);
    expect(grouped.count).toEqual([]);
    expect(grouped.colloquial).toEqual([]);
  });

  it('sorts each category by sortOrder', () => {
    const unordered: Unit[] = [
      { id: 'kg', name: 'kg', plural: null, category: 'weight', sortOrder: 2 },
      { id: 'g', name: 'g', plural: null, category: 'weight', sortOrder: 1 },
    ];
    const grouped = groupUnitsByCategory(unordered);
    expect(grouped.weight[0].id).toBe('g');
  });
});

// ── validateUnitDoc ───────────────────────────────────────────────────────────

describe('validateUnitDoc', () => {
  it('accepts a valid unit document', () => {
    const doc = { id: 'g', name: 'g', plural: null, category: 'weight', sortOrder: 1 };
    const result = validateUnitDoc(doc);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid category value', () => {
    const doc = { id: 'cup', name: 'cup', plural: 'cups', category: 'imperial', sortOrder: 99 };
    const result = validateUnitDoc(doc);
    expect(result.success).toBe(false);
  });

  it('rejects a document with an empty name', () => {
    const doc = { id: 'g', name: '', plural: null, category: 'weight', sortOrder: 1 };
    const result = validateUnitDoc(doc);
    expect(result.success).toBe(false);
  });

  it('applies the default sortOrder when omitted', () => {
    const doc = { id: 'g', name: 'g', plural: null, category: 'weight' };
    const result = validateUnitDoc(doc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(999);
    }
  });

  it('applies the default plural (null) when omitted', () => {
    const doc = { id: 'g', name: 'g', category: 'weight', sortOrder: 1 };
    const result = validateUnitDoc(doc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plural).toBeNull();
    }
  });
});

// ── CanonUnitSchema ───────────────────────────────────────────────────────────

describe('CanonUnitSchema', () => {
  it('parses a complete unit', () => {
    const raw = { id: 'clove', name: 'clove', plural: 'cloves', category: 'count', sortOrder: 8 };
    const parsed = CanonUnitSchema.parse(raw);
    expect(parsed.id).toBe('clove');
    expect(parsed.plural).toBe('cloves');
  });
});

// ── CanonAisleSchema ──────────────────────────────────────────────────────────

describe('CanonAisleSchema', () => {
  it('parses a complete aisle', () => {
    const raw = { id: 'produce', name: 'Produce', tier2: 'fresh', tier3: 'food', sortOrder: 10, createdAt: '2024-01-01T00:00:00.000Z' };
    const parsed = CanonAisleSchema.parse(raw);
    expect(parsed.id).toBe('produce');
    expect(parsed.name).toBe('Produce');
  });
});

// ── normalizeItemName ─────────────────────────────────────────────────────────

describe('normalizeItemName', () => {
  it('trims leading and trailing whitespace and lowercases', () => {
    expect(normalizeItemName('  Carrot  ')).toBe('carrot');
  });

  it('collapses internal whitespace to a single space and lowercases', () => {
    expect(normalizeItemName('Cherry  Tomato')).toBe('cherry tomato');
  });

  it('returns an empty string for an all-whitespace input', () => {
    expect(normalizeItemName('   ')).toBe('');
  });

  it('lowercases a clean name', () => {
    expect(normalizeItemName('Butter')).toBe('butter');
  });
});

// ── sortItems ─────────────────────────────────────────────────────────────────

describe('sortItems', () => {
  it('sorts items alphabetically by name (case-insensitive)', () => {
    const sorted = sortItems(ITEMS);
    expect(sorted.map(i => i.id)).toEqual([
      'item-apple',
      'item-butter',
      'item-carrot',
      'item-onion',
      'item-salt',
    ]);
  });

  it('does not mutate the original array', () => {
    const original = [...ITEMS];
    sortItems(ITEMS);
    expect(ITEMS).toEqual(original);
  });
});

// ── findItemById ──────────────────────────────────────────────────────────────

describe('findItemById', () => {
  it('returns found:true with the item when id exists', () => {
    const result = findItemById(ITEMS, 'item-carrot');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.item.name).toBe('Carrot');
    }
  });

  it('returns found:false for an unknown id', () => {
    const result = findItemById(ITEMS, 'item-nonexistent');
    expect(result.found).toBe(false);
  });
});

// ── findItemByName ────────────────────────────────────────────────────────────

describe('findItemByName', () => {
  it('finds an item by exact name', () => {
    const result = findItemByName(ITEMS, 'Onion');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.item.id).toBe('item-onion');
    }
  });

  it('is case-insensitive', () => {
    const result = findItemByName(ITEMS, 'BUTTER');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.item.id).toBe('item-butter');
    }
  });

  it('trims and normalizes whitespace', () => {
    const result = findItemByName(ITEMS, '  Carrot  ');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.item.id).toBe('item-carrot');
    }
  });

  it('returns found:false for an unknown name', () => {
    const result = findItemByName(ITEMS, 'Truffle');
    expect(result.found).toBe(false);
  });
});

// ── filterUnapprovedItems ─────────────────────────────────────────────────────

describe('filterUnapprovedItems', () => {
  it('returns only items where approved is false', () => {
    const result = filterUnapprovedItems(ITEMS);
    expect(result.map(i => i.id)).toEqual(['item-onion', 'item-salt']);
  });

  it('returns an empty array when all items are approved', () => {
    const allApproved = ITEMS.map(i => ({ ...i, approved: true }));
    expect(filterUnapprovedItems(allApproved)).toEqual([]);
  });
});

// ── filterItemsByAisle ────────────────────────────────────────────────────────

describe('filterItemsByAisle', () => {
  it('returns only items in the specified aisle', () => {
    const result = filterItemsByAisle(ITEMS, 'produce');
    expect(result.map(i => i.id)).toEqual(['item-carrot', 'item-onion', 'item-apple']);
  });

  it('returns an empty array for an aisle with no items', () => {
    expect(filterItemsByAisle(ITEMS, 'frozen')).toEqual([]);
  });
});

// ── validateItemDoc ───────────────────────────────────────────────────────────

describe('validateItemDoc', () => {
  it('accepts a valid v3 item document', () => {
    const doc = {
      id: 'item-carrot',
      name: 'Carrot',
      normalisedName: 'carrot',
      aisleId: 'produce',
      aisle: { tier1: 'produce', tier2: 'fresh', tier3: 'food' },
      unit: { canonical_unit: 'g', density_g_per_ml: null },
      approved: true,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateItemDoc(doc);
    expect(result.success).toBe(true);
  });

  it('applies the default approved (true) when omitted', () => {
    const doc = {
      id: 'item-carrot',
      name: 'Carrot',
      normalisedName: 'carrot',
      aisleId: 'produce',
      aisle: { tier1: 'produce', tier2: 'fresh', tier3: 'food' },
      unit: { canonical_unit: 'g', density_g_per_ml: null },
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateItemDoc(doc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approved).toBe(true);
    }
  });

  it('rejects a document with an empty name', () => {
    const doc = {
      id: 'item-carrot',
      name: '',
      normalisedName: '',
      aisleId: 'produce',
      aisle: { tier1: 'produce', tier2: 'fresh', tier3: 'food' },
      unit: { canonical_unit: 'g', density_g_per_ml: null },
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateItemDoc(doc);
    expect(result.success).toBe(false);
  });

  it('rejects a document missing required fields', () => {
    const doc = { id: 'item-carrot', name: 'Carrot' };
    const result = validateItemDoc(doc);
    expect(result.success).toBe(false);
  });
});
