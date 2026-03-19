/**
 * Canon Module - Contract Compliance Tests
 *
 * Test suite for Canon domain types focusing on:
 * - Contract compliance (Zod schema validation)
 * - Type safety (TypeScript type checking)
 * - Data consistency (field relationships)
 * - Edge cases and boundaries
 */

import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  CanonicalItem,
  Aisle,
  Unit,
} from '../../../types/contract';
import {
  CanonicalItemSchema,
  AisleSchema,
  UnitSchema,
} from '../../../types/contract';
import type { CofIDItem } from '../types';
import { CofIDItemSchema } from '../types';

// ============================================================================
// SECTION 1: Test Fixtures (Contract-Shaped Data)
// ============================================================================

const AISLES_FIXTURE: Aisle[] = [
  {
    id: 'aisle-produce',
    name: 'Produce',
    tier2: 'fresh',
    tier3: 'food',
    sortOrder: 10,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'aisle-dairy',
    name: 'Dairy & Eggs',
    tier2: 'fresh',
    tier3: 'food',
    sortOrder: 20,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'aisle-baking',
    name: 'Baking & Cooking Ingredients',
    tier2: 'ambient',
    tier3: 'food',
    sortOrder: 30,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

const UNITS_FIXTURE: Unit[] = [
  {
    id: 'unit-g',
    name: 'g',
    plural: null,
    category: 'weight',
    sortOrder: 10,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'unit-kg',
    name: 'kg',
    plural: null,
    category: 'weight',
    sortOrder: 20,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'unit-clove',
    name: 'clove',
    plural: 'cloves',
    category: 'count',
    sortOrder: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

const DEFAULT_UNIT = { canonical_unit: 'g' as const, density_g_per_ml: null };
const DEFAULT_AISLE = { tier1: 'produce', tier2: 'fresh', tier3: 'food' };

const CANONICAL_ITEMS_FIXTURE: CanonicalItem[] = [
  {
    id: 'canon-tomato',
    name: 'Tomato',
    normalisedName: 'tomato',
    isStaple: false,
    aisleId: 'produce',
    aisle: DEFAULT_AISLE,
    unit: DEFAULT_UNIT,
    synonyms: ['Tomatoes', 'Cherry tomatoes'],
    itemType: 'ingredient',
    allergens: [],
    barcodes: [],
    externalSources: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    approved: true,
  },
  {
    id: 'canon-onion',
    name: 'Onion',
    normalisedName: 'onion',
    isStaple: true,
    aisleId: 'produce',
    aisle: DEFAULT_AISLE,
    unit: DEFAULT_UNIT,
    synonyms: ['Onions', 'Red onion', 'White onion'],
    itemType: 'ingredient',
    allergens: [],
    barcodes: [],
    externalSources: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    approved: true,
  },
];

const COFID_ITEMS_FIXTURE: CofIDItem[] = [
  {
    id: 'cofid-12345',
    name: 'Tomato, raw',
    group: 'B',
    nutrients: {
      energy_kcal: 18,
      protein_g: 0.9,
      fat_g: 0.2,
    },
    importedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cofid-67890',
    name: 'Onion, raw',
    group: 'B',
    nutrients: {
      energy_kcal: 40,
      protein_g: 1.1,
      fat_g: 0.1,
    },
    importedAt: '2024-01-01T00:00:00.000Z',
  },
];

// ============================================================================
// SECTION 2: Aisle Schema Tests
// ============================================================================

describe('Canon Module - Aisle Schema', () => {
  it('should validate all fixture aisles conform to schema', () => {
    AISLES_FIXTURE.forEach(aisle => {
      expect(() => AisleSchema.parse(aisle)).not.toThrow();
    });
  });

  it('should have all required fields', () => {
    const aisle = AISLES_FIXTURE[0];
    expect(aisle.id).toBeDefined();
    expect(aisle.name).toBeDefined();
    expect(aisle.sortOrder).toBeDefined();
    expect(aisle.createdAt).toBeDefined();
  });

  it('should reject aisle without id', () => {
    const invalid = { ...AISLES_FIXTURE[0], id: undefined };
    expect(() => AisleSchema.parse(invalid)).toThrow();
  });

  it('should reject aisle without name', () => {
    const invalid = { ...AISLES_FIXTURE[0], name: undefined };
    expect(() => AisleSchema.parse(invalid)).toThrow();
  });

  it('should reject aisle without createdAt', () => {
    const invalid = { ...AISLES_FIXTURE[0], createdAt: undefined };
    expect(() => AisleSchema.parse(invalid)).toThrow();
  });

  it('should accept aisle without sortOrder (default 999)', () => {
    const noOrder = { ...AISLES_FIXTURE[0], sortOrder: undefined };
    const parsed = AisleSchema.parse(noOrder);
    expect(parsed.sortOrder).toBe(999);
  });

  it('should maintain type safety', () => {
    const aisle: Aisle = AISLES_FIXTURE[0];
    expectTypeOf(aisle).toMatchTypeOf<Aisle>();
  });
});

// ============================================================================
// SECTION 3: Unit Schema Tests
// ============================================================================

describe('Canon Module - Unit Schema', () => {
  it('should validate all fixture units conform to schema', () => {
    UNITS_FIXTURE.forEach(unit => {
      expect(() => UnitSchema.parse(unit)).not.toThrow();
    });
  });

  it('should have all required fields', () => {
    const unit = UNITS_FIXTURE[0];
    expect(unit.id).toBeDefined();
    expect(unit.name).toBeDefined();
    expect(unit.category).toBeDefined();
  });

  it('should reject unit without id', () => {
    const invalid = { ...UNITS_FIXTURE[0], id: undefined };
    expect(() => UnitSchema.parse(invalid)).toThrow();
  });

  it('should reject unit without name', () => {
    const invalid = { ...UNITS_FIXTURE[0], name: undefined };
    expect(() => UnitSchema.parse(invalid)).toThrow();
  });

  it('should reject unit without category', () => {
    const invalid = { ...UNITS_FIXTURE[0], category: undefined };
    expect(() => UnitSchema.parse(invalid)).toThrow();
  });

  it('should accept valid unit categories', () => {
    const categories = ['weight', 'volume', 'count', 'colloquial'] as const;
    categories.forEach(category => {
      const unit: Unit = {
        ...UNITS_FIXTURE[0],
        category,
      };
      expect(() => UnitSchema.parse(unit)).not.toThrow();
    });
  });

  it('should reject invalid unit category', () => {
    const invalid = {
      ...UNITS_FIXTURE[0],
      category: 'invalid-category',
    };
    expect(() => UnitSchema.parse(invalid)).toThrow();
  });

  it('should accept unit with null plural', () => {
    const unit: Unit = {
      ...UNITS_FIXTURE[0],
      plural: null,
    };
    expect(() => UnitSchema.parse(unit)).not.toThrow();
  });

  it('should accept unit with string plural', () => {
    const unit: Unit = UNITS_FIXTURE[2]; // clove → cloves
    expect(unit.plural).toBe('cloves');
    expect(() => UnitSchema.parse(unit)).not.toThrow();
  });

  it('should accept unit without sortOrder (default 999)', () => {
    const noOrder = { ...UNITS_FIXTURE[0], sortOrder: undefined };
    const parsed = UnitSchema.parse(noOrder);
    expect(parsed.sortOrder).toBe(999);
  });

  it('should maintain type safety', () => {
    const unit: Unit = UNITS_FIXTURE[0];
    expectTypeOf(unit).toMatchTypeOf<Unit>();
  });
});

// ============================================================================
// SECTION 4: CanonicalItem Schema Tests
// ============================================================================

describe('Canon Module - CanonicalItem Schema', () => {
  it('should validate all fixture items conform to schema', () => {
    CANONICAL_ITEMS_FIXTURE.forEach(item => {
      expect(() => CanonicalItemSchema.parse(item)).not.toThrow();
    });
  });

  it('should have all required fields', () => {
    const item = CANONICAL_ITEMS_FIXTURE[0];
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.normalisedName).toBeDefined();
    expect(item.aisleId).toBeDefined();
    expect(item.aisle).toBeDefined();
    expect(item.unit).toBeDefined();
    expect(item.createdAt).toBeDefined();
  });

  it('should reject item without id', () => {
    const invalid = { ...CANONICAL_ITEMS_FIXTURE[0], id: undefined };
    expect(() => CanonicalItemSchema.parse(invalid)).toThrow();
  });

  it('should reject item without name', () => {
    const invalid = { ...CANONICAL_ITEMS_FIXTURE[0], name: undefined };
    expect(() => CanonicalItemSchema.parse(invalid)).toThrow();
  });

  it('should reject item without normalisedName', () => {
    const invalid = { ...CANONICAL_ITEMS_FIXTURE[0], normalisedName: undefined };
    expect(() => CanonicalItemSchema.parse(invalid)).toThrow();
  });

  it('should reject item without aisle', () => {
    const invalid = { ...CANONICAL_ITEMS_FIXTURE[0], aisle: undefined };
    expect(() => CanonicalItemSchema.parse(invalid)).toThrow();
  });

  it('should reject item without unit', () => {
    const invalid = { ...CANONICAL_ITEMS_FIXTURE[0], unit: undefined };
    expect(() => CanonicalItemSchema.parse(invalid)).toThrow();
  });

  it('should reject item without createdAt', () => {
    const invalid = { ...CANONICAL_ITEMS_FIXTURE[0], createdAt: undefined };
    expect(() => CanonicalItemSchema.parse(invalid)).toThrow();
  });

  it('should accept item with isStaple true/false', () => {
    const staple: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      isStaple: true,
    };
    const nonStaple: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      isStaple: false,
    };
    expect(() => CanonicalItemSchema.parse(staple)).not.toThrow();
    expect(() => CanonicalItemSchema.parse(nonStaple)).not.toThrow();
  });

  it('should accept item without isStaple (default false)', () => {
    const noStaple = { ...CANONICAL_ITEMS_FIXTURE[0], isStaple: undefined };
    const parsed = CanonicalItemSchema.parse(noStaple);
    expect(parsed.isStaple).toBe(false);
  });

  it('should accept item with synonyms array', () => {
    const item: CanonicalItem = CANONICAL_ITEMS_FIXTURE[0];
    expect(item.synonyms).toBeDefined();
    expect(Array.isArray(item.synonyms)).toBe(true);
    expect(() => CanonicalItemSchema.parse(item)).not.toThrow();
  });

  it('should accept item without synonyms', () => {
    const noSynonyms = { ...CANONICAL_ITEMS_FIXTURE[0], synonyms: undefined };
    expect(() => CanonicalItemSchema.parse(noSynonyms)).not.toThrow();
  });

  it('should accept item with approved true/false', () => {
    const approved: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      approved: true,
    };
    const unapproved: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      approved: false,
    };
    expect(() => CanonicalItemSchema.parse(approved)).not.toThrow();
    expect(() => CanonicalItemSchema.parse(unapproved)).not.toThrow();
  });

  it('should accept item with embedding data', () => {
    const withEmbedding: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'text-embedding-005',
      embeddedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(() => CanonicalItemSchema.parse(withEmbedding)).not.toThrow();
  });

  it('should accept item with matching audit trail', () => {
    const withAudit: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      matchingAudit: {
        stage: 'semantic_analysis',
        decisionAction: 'use_existing_canon',
        decisionSource: 'algorithm',
        matchedSource: 'canon',
        finalCandidateId: 'canon-123',
        reason: 'High semantic similarity',
        recordedAt: '2024-01-01T00:00:00.000Z',
        topScore: 0.95,
        scoreGap: 0.15,
      },
    };
    expect(() => CanonicalItemSchema.parse(withAudit)).not.toThrow();
  });

  it('should accept item with near misses in audit trail', () => {
    const withNearMisses: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      matchingAudit: {
        stage: 'semantic_analysis',
        decisionAction: 'use_existing_canon',
        decisionSource: 'algorithm',
        matchedSource: 'canon',
        finalCandidateId: 'canon-123',
        reason: 'High semantic similarity',
        recordedAt: '2024-01-01T00:00:00.000Z',
        nearMisses: [
          {
            candidateId: 'cofid-456',
            candidateName: 'Similar Item',
            source: 'cofid',
            score: 0.82,
            reason: 'Lower score',
          },
        ],
      },
    };
    expect(() => CanonicalItemSchema.parse(withNearMisses)).not.toThrow();
  });

  it('should maintain type safety', () => {
    const item: CanonicalItem = CANONICAL_ITEMS_FIXTURE[0];
    expectTypeOf(item).toMatchTypeOf<CanonicalItem>();
  });
});

// ============================================================================
// SECTION 5: CofIDItem Schema Tests
// ============================================================================

describe('Canon Module - CofIDItem Schema', () => {
  it('should validate all fixture CofID items conform to schema', () => {
    COFID_ITEMS_FIXTURE.forEach(item => {
      expect(() => CofIDItemSchema.parse(item)).not.toThrow();
    });
  });

  it('should have all required fields', () => {
    const item = COFID_ITEMS_FIXTURE[0];
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.group).toBeDefined();
    expect(item.importedAt).toBeDefined();
  });

  it('should reject CofID item without id', () => {
    const invalid = { ...COFID_ITEMS_FIXTURE[0], id: undefined };
    expect(() => CofIDItemSchema.parse(invalid)).toThrow();
  });

  it('should reject CofID item without name', () => {
    const invalid = { ...COFID_ITEMS_FIXTURE[0], name: undefined };
    expect(() => CofIDItemSchema.parse(invalid)).toThrow();
  });

  it('should reject CofID item without group', () => {
    const invalid = { ...COFID_ITEMS_FIXTURE[0], group: undefined };
    expect(() => CofIDItemSchema.parse(invalid)).toThrow();
  });

  it('should reject CofID item without importedAt', () => {
    const invalid = { ...COFID_ITEMS_FIXTURE[0], importedAt: undefined };
    expect(() => CofIDItemSchema.parse(invalid)).toThrow();
  });

  it('should accept CofID item with nutrients', () => {
    const item: CofIDItem = COFID_ITEMS_FIXTURE[0];
    expect(item.nutrients).toBeDefined();
    expect(typeof item.nutrients).toBe('object');
    expect(() => CofIDItemSchema.parse(item)).not.toThrow();
  });

  it('should accept CofID item without nutrients', () => {
    const noNutrients = { ...COFID_ITEMS_FIXTURE[0], nutrients: undefined };
    expect(() => CofIDItemSchema.parse(noNutrients)).not.toThrow();
  });

  it('should maintain type safety', () => {
    const item: CofIDItem = COFID_ITEMS_FIXTURE[0];
    expectTypeOf(item).toMatchTypeOf<CofIDItem>();
  });
});

// ============================================================================
// SECTION 7: Data Consistency Tests
// ============================================================================

describe('Canon Module - Data Consistency', () => {
  it('should have unique IDs within aisle collection', () => {
    const ids = new Set(AISLES_FIXTURE.map(a => a.id));
    expect(ids.size).toBe(AISLES_FIXTURE.length);
  });

  it('should have unique IDs within unit collection', () => {
    const ids = new Set(UNITS_FIXTURE.map(u => u.id));
    expect(ids.size).toBe(UNITS_FIXTURE.length);
  });

  it('should have unique IDs within canonical item collection', () => {
    const ids = new Set(CANONICAL_ITEMS_FIXTURE.map(i => i.id));
    expect(ids.size).toBe(CANONICAL_ITEMS_FIXTURE.length);
  });


  it('should have normalised names in lowercase', () => {
    CANONICAL_ITEMS_FIXTURE.forEach(item => {
      expect(item.normalisedName).toBe(item.normalisedName.toLowerCase());
    });
  });

  it('should have staple onion and non-staple tomato', () => {
    const onion = CANONICAL_ITEMS_FIXTURE.find(i => i.name === 'Onion');
    const tomato = CANONICAL_ITEMS_FIXTURE.find(i => i.name === 'Tomato');
    expect(onion?.isStaple).toBe(true);
    expect(tomato?.isStaple).toBe(false);
  });
});

// ============================================================================
// SECTION 8: Edge Cases & Boundaries
// ============================================================================

describe('Canon Module - Edge Cases', () => {
  it('should handle empty synonyms array', () => {
    const item: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      synonyms: [],
    };
    expect(() => CanonicalItemSchema.parse(item)).not.toThrow();
  });

  it('should handle long aisle names', () => {
    const aisle: Aisle = {
      ...AISLES_FIXTURE[0],
      name: 'A'.repeat(100),
    };
    expect(() => AisleSchema.parse(aisle)).not.toThrow();
  });

  it('should handle long unit names', () => {
    const unit: Unit = {
      ...UNITS_FIXTURE[0],
      name: 'tablespoon',
      plural: 'tablespoons',
    };
    expect(() => UnitSchema.parse(unit)).not.toThrow();
  });

  it('should handle negative sortOrder', () => {
    const aisle: Aisle = {
      ...AISLES_FIXTURE[0],
      sortOrder: -1,
    };
    expect(() => AisleSchema.parse(aisle)).not.toThrow();
  });

  it('should handle zero sortOrder', () => {
    const unit: Unit = {
      ...UNITS_FIXTURE[0],
      sortOrder: 0,
    };
    expect(() => UnitSchema.parse(unit)).not.toThrow();
  });

  it('should handle very large sortOrder', () => {
    const aisle: Aisle = {
      ...AISLES_FIXTURE[0],
      sortOrder: 999999,
    };
    expect(() => AisleSchema.parse(aisle)).not.toThrow();
  });

  it('should handle empty metadata object', () => {
    const item: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      metadata: {},
    };
    expect(() => CanonicalItemSchema.parse(item)).not.toThrow();
  });

  it('should handle metadata with notes and confidence', () => {
    const item: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      metadata: {
        notes: 'Commonly used in salads',
        confidence: 0.95,
      },
    };
    expect(() => CanonicalItemSchema.parse(item)).not.toThrow();
  });
});

// ============================================================================
// SECTION 9: Module Boundaries
// ============================================================================

describe('Canon Module - Module Boundaries', () => {
  it('should use only contract types', () => {
    const item: CanonicalItem = CANONICAL_ITEMS_FIXTURE[0];
    const aisle: Aisle = AISLES_FIXTURE[0];
    const unit: Unit = UNITS_FIXTURE[0];

    expectTypeOf(item).toMatchTypeOf<CanonicalItem>();
    expectTypeOf(aisle).toMatchTypeOf<Aisle>();
    expectTypeOf(unit).toMatchTypeOf<Unit>();
  });

  it('should not expose internal implementation details', () => {
    const item = CANONICAL_ITEMS_FIXTURE[0];
    
    // No private fields like _id, _firebaseRef, etc.
    expect('_id' in item).toBe(false);
    expect('_firebaseRef' in item).toBe(false);
    expect('__typename' in item).toBe(false);
  });

  it('should maintain immutability of contract types', () => {
    const item = CANONICAL_ITEMS_FIXTURE[0];
    const copied = { ...item };
    
    expect(copied).toEqual(item);
    expect(copied).not.toBe(item); // Different object reference
  });
});
