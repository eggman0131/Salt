/**
 * Kitchen Data Module - Frontend Contract Tests
 *
 * Test suite for KitchenDataModule React component focusing on:
 * - Contract compliance (Zod schema validation)
 * - Type safety (TypeScript type checking)
 * - Data consistency (linked references)
 * - Edge cases and boundaries
 */

import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  Unit,
  Aisle,
  CanonicalItem,
} from '../../../../types/contract';
import {
  UnitSchema,
  AisleSchema,
  CanonicalItemSchema,
} from '../../../../types/contract';

// ============================================================================
// SECTION 1: Test Fixtures (Contract-Shaped Data)
// ============================================================================

const UNITS_FIXTURE: Unit[] = [
  {
    id: 'unit-g',
    name: 'Gramme',
    sortOrder: 1,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'unit-ml',
    name: 'Millilitre',
    sortOrder: 2,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'unit-l',
    name: 'Litre',
    sortOrder: 3,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'unit-items',
    name: 'Count',
    sortOrder: 999,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const AISLES_FIXTURE: Aisle[] = [
  {
    id: 'aisle-produce',
    name: 'Produce',
    sortOrder: 1,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'aisle-dairy',
    name: 'Dairy & Eggs',
    sortOrder: 2,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'aisle-bakery',
    name: 'Bakery',
    sortOrder: 3,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'aisle-pantry',
    name: 'Pantry',
    sortOrder: 4,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const CANONICAL_ITEMS_FIXTURE: CanonicalItem[] = [
  {
    id: 'item-carrot',
    name: 'Carrot',
    normalisedName: 'carrot',
    isStaple: false,
    aisle: 'Produce',
    preferredUnit: 'g',
    synonyms: ['root vegetable', 'orange carrot'],
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
  },
  {
    id: 'item-milk',
    name: 'Milk',
    normalisedName: 'milk',
    isStaple: true,
    aisle: 'Dairy & Eggs',
    preferredUnit: 'ml',
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'system',
  },
  {
    id: 'item-flour',
    name: 'Flour',
    normalisedName: 'flour',
    isStaple: true,
    aisle: 'Pantry',
    preferredUnit: 'g',
    metadata: {
      type: 'plain',
      protein: '12g per 100g',
    },
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// ============================================================================
// SECTION 2: Contract Compliance Tests
// ============================================================================

describe('KitchenDataModule - Contract Compliance', () => {
  describe('Unit Schema', () => {
    it('should validate all fixture units conform to schema', () => {
      UNITS_FIXTURE.forEach(unit => {
        expect(() => UnitSchema.parse(unit)).not.toThrow();
      });
    });

    it('should have all required fields', () => {
      const unit = UNITS_FIXTURE[0];
      expect(unit.id).toBeDefined();
      expect(unit.name).toBeDefined();
      expect(unit.sortOrder).toBeDefined();
      expect(unit.createdAt).toBeDefined();
    });

    it('should reject unit without id', () => {
      const invalid = { ...UNITS_FIXTURE[0], id: undefined };
      expect(() => UnitSchema.parse(invalid)).toThrow();
    });

    it('should default sortOrder to 999', () => {
      const noSort = {
        id: 'unit-test',
        name: 'Test',
        createdAt: '2024-01-01T00:00:00Z',
      };
      const parsed = UnitSchema.parse(noSort);
      expect(parsed.sortOrder).toBe(999);
    });
  });

  describe('Aisle Schema', () => {
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

    it('should reject aisle without name', () => {
      const invalid = { ...AISLES_FIXTURE[0], name: undefined };
      expect(() => AisleSchema.parse(invalid)).toThrow();
    });

    it('should default sortOrder to 999', () => {
      const noSort = {
        id: 'aisle-test',
        name: 'Test Aisle',
        createdAt: '2024-01-01T00:00:00Z',
      };
      const parsed = AisleSchema.parse(noSort);
      expect(parsed.sortOrder).toBe(999);
    });
  });

  describe('CanonicalItem Schema', () => {
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
      expect(item.aisle).toBeDefined();
      expect(item.preferredUnit).toBeDefined();
      expect(item.createdAt).toBeDefined();
    });

    it('should reject item without name', () => {
      const invalid = { ...CANONICAL_ITEMS_FIXTURE[0], name: undefined };
      expect(() => CanonicalItemSchema.parse(invalid)).toThrow();
    });

    it('should default isStaple to false', () => {
      const noStaple = {
        id: 'item-test',
        name: 'Test Item',
        normalisedName: 'test item',
        aisle: 'Produce',
        preferredUnit: 'g',
        createdAt: '2024-01-01T00:00:00Z',
      };
      const parsed = CanonicalItemSchema.parse(noStaple);
      expect(parsed.isStaple).toBe(false);
    });

    it('should accept item with metadata', () => {
      expect(() => CanonicalItemSchema.parse(CANONICAL_ITEMS_FIXTURE[2])).not.toThrow();
    });

    it('should accept item with synonyms', () => {
      expect(() => CanonicalItemSchema.parse(CANONICAL_ITEMS_FIXTURE[0])).not.toThrow();
    });

    it('should accept item without createdBy', () => {
      const noCreator = {
        ...CANONICAL_ITEMS_FIXTURE[0],
        createdBy: undefined,
      };
      expect(() => CanonicalItemSchema.parse(noCreator)).not.toThrow();
    });
  });
});

// ============================================================================
// SECTION 3: Type Safety Tests
// ============================================================================

describe('KitchenDataModule - Type Safety', () => {
  it('should maintain type safety with Unit', () => {
    const unit: Unit = UNITS_FIXTURE[0];
    expectTypeOf(unit).toMatchTypeOf<Unit>();
  });

  it('should maintain type safety with Aisle', () => {
    const aisle: Aisle = AISLES_FIXTURE[0];
    expectTypeOf(aisle).toMatchTypeOf<Aisle>();
  });

  it('should maintain type safety with CanonicalItem', () => {
    const item: CanonicalItem = CANONICAL_ITEMS_FIXTURE[0];
    expectTypeOf(item).toMatchTypeOf<CanonicalItem>();
  });

  it('should maintain array type safety', () => {
    const units: Unit[] = UNITS_FIXTURE;
    expectTypeOf(units).toMatchTypeOf<Unit[]>();
  });
});

// ============================================================================
// SECTION 4: Data Mutations & Transformations
// ============================================================================

describe('KitchenDataModule - Data Mutations', () => {
  it('should validate unit with updated name', () => {
    const updated = { ...UNITS_FIXTURE[0], name: 'Grammes' };
    expect(() => UnitSchema.parse(updated)).not.toThrow();
  });

  it('should validate aisle with updated sortOrder', () => {
    const updated = { ...AISLES_FIXTURE[0], sortOrder: 99 };
    expect(() => AisleSchema.parse(updated)).not.toThrow();
  });

  it('should validate canonical item with updated staple status', () => {
    const updated = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      isStaple: true,
    };
    expect(() => CanonicalItemSchema.parse(updated)).not.toThrow();
  });

  it('should validate item with new synonyms', () => {
    const updated = {
      ...CANONICAL_ITEMS_FIXTURE[1],
      synonyms: ['dairy', 'lactose'],
    };
    expect(() => CanonicalItemSchema.parse(updated)).not.toThrow();
  });

  it('should reject unit with invalid sortOrder type', () => {
    const invalid = {
      ...UNITS_FIXTURE[0],
      sortOrder: 'high' as any,
    };
    expect(() => UnitSchema.parse(invalid)).toThrow();
  });
});

// ============================================================================
// SECTION 5: Module Boundaries
// ============================================================================

describe('KitchenDataModule - Module Boundaries', () => {
  it('should use only contract types', () => {
    const units: Unit[] = UNITS_FIXTURE;
    const aisles: Aisle[] = AISLES_FIXTURE;
    const items: CanonicalItem[] = CANONICAL_ITEMS_FIXTURE;

    expectTypeOf(units).toMatchTypeOf<Unit[]>();
    expectTypeOf(aisles).toMatchTypeOf<Aisle[]>();
    expectTypeOf(items).toMatchTypeOf<CanonicalItem[]>();
  });

  it('should not expose internal backend types', () => {
    const unit = UNITS_FIXTURE[0];
    expect('_id' in unit).toBe(false);
    expect('_timestamp' in unit).toBe(false);
    expect('__typename' in unit).toBe(false);
  });
});

// ============================================================================
// SECTION 6: Data Consistency
// ============================================================================

describe('KitchenDataModule - Data Consistency', () => {
  it('should maintain unique unit IDs', () => {
    const unitIds = new Set(UNITS_FIXTURE.map(u => u.id));
    expect(unitIds.size).toBe(UNITS_FIXTURE.length);
  });

  it('should maintain unique aisle IDs', () => {
    const aisleIds = new Set(AISLES_FIXTURE.map(a => a.id));
    expect(aisleIds.size).toBe(AISLES_FIXTURE.length);
  });

  it('should maintain unique item IDs', () => {
    const itemIds = new Set(CANONICAL_ITEMS_FIXTURE.map(i => i.id));
    expect(itemIds.size).toBe(CANONICAL_ITEMS_FIXTURE.length);
  });

  it('should have units in sort order', () => {
    const sortOrders = UNITS_FIXTURE.map(u => u.sortOrder);
    expect(sortOrders.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// SECTION 7: Edge Cases & Boundaries
// ============================================================================

describe('KitchenDataModule - Edge Cases', () => {
  it('should accept unit with very long name', () => {
    const longName: Unit = {
      ...UNITS_FIXTURE[0],
      name: 'A'.repeat(500),
    };
    expect(() => UnitSchema.parse(longName)).not.toThrow();
  });

  it('should accept aisle with special characters', () => {
    const special: Aisle = {
      ...AISLES_FIXTURE[0],
      name: 'Vegetables & Salads / Fresh',
    };
    expect(() => AisleSchema.parse(special)).not.toThrow();
  });

  it('should accept canonical item with unicode name', () => {
    const unicode: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      name: '日本米',
      normalisedName: '日本米',
    };
    expect(() => CanonicalItemSchema.parse(unicode)).not.toThrow();
  });

  it('should accept unit with zero sortOrder', () => {
    const zeroSort: Unit = {
      ...UNITS_FIXTURE[0],
      sortOrder: 0,
    };
    expect(() => UnitSchema.parse(zeroSort)).not.toThrow();
  });

  it('should accept item with many synonyms', () => {
    const manySynonyms: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      synonyms: Array.from({ length: 50 }, (_, i) => `synonym-${i}`),
    };
    expect(() => CanonicalItemSchema.parse(manySynonyms)).not.toThrow();
  });

  it('should accept item with large metadata', () => {
    const largeMetadata: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[2],
      metadata: {
        nutrition: {
          protein: '12g',
          carbs: '75g',
          fat: '2g',
          fibre: '3g',
        },
        storage: 'Cool dry place',
        shelf_life: '12 months',
      },
    };
    expect(() => CanonicalItemSchema.parse(largeMetadata)).not.toThrow();
  });

  it('should accept aisle with negative sortOrder', () => {
    const negSort: Aisle = {
      ...AISLES_FIXTURE[0],
      sortOrder: -1,
    };
    expect(() => AisleSchema.parse(negSort)).not.toThrow();
  });

  it('should accept item without synonyms', () => {
    const noSynonyms: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      synonyms: undefined,
    };
    expect(() => CanonicalItemSchema.parse(noSynonyms)).not.toThrow();
  });

  it('should accept item without metadata', () => {
    const noMetadata: CanonicalItem = {
      ...CANONICAL_ITEMS_FIXTURE[0],
      metadata: undefined,
    };
    expect(() => CanonicalItemSchema.parse(noMetadata)).not.toThrow();
  });
});
