/**
 * Inventory Module - Frontend Contract Tests
 *
 * Test suite for InventoryModule React component focusing on:
 * - Contract compliance (Zod schema validation)
 * - Type safety (TypeScript type checking)
 * - Data consistency (linked references)
 * - Edge cases and boundaries
 */

import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  Equipment,
  Accessory,
} from '../../../../types/contract';
import {
  EquipmentSchema,
  AccessorySchema,
} from '../../../../types/contract';

// ============================================================================
// SECTION 1: Test Fixtures (Contract-Shaped Data)
// ============================================================================

const ACCESSORIES_FIXTURE: Accessory[] = [
  {
    id: 'acc-1',
    name: 'Mixing Bowl',
    description: 'Large stainless steel bowl',
    owned: true,
    type: 'standard',
  },
  {
    id: 'acc-2',
    name: 'Paddle Attachment',
    description: 'For stand mixer',
    owned: true,
    type: 'standard',
  },
  {
    id: 'acc-3',
    name: 'Food Grinder',
    description: 'Optional meat grinder attachment',
    owned: false,
    type: 'optional',
  },
];

const EQUIPMENT_FIXTURE: Equipment[] = [
  {
    id: 'equip-1',
    name: 'KitchenAid Stand Mixer',
    brand: 'KitchenAid',
    modelName: 'KSM150',
    description: 'Professional stand mixer for bread and pastries',
    type: 'Mixer',
    class: 'Appliance',
    accessories: ACCESSORIES_FIXTURE.slice(0, 2),
    status: 'Available',
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'equip-2',
    name: 'Le Creuset Cast Iron',
    brand: 'Le Creuset',
    modelName: 'Signature Casserole',
    description: 'Enamelled cast iron casserole',
    type: 'Casserole',
    class: 'Cookware',
    accessories: [],
    status: 'In Use',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'equip-3',
    name: 'Zyliss Garlic Press',
    brand: 'Zyliss',
    modelName: 'Soft-Touch',
    description: 'Hand-operated garlic press',
    type: 'Tool',
    class: 'Hand Tool',
    accessories: [],
    status: 'Available',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// ============================================================================
// SECTION 2: Contract Compliance Tests
// ============================================================================

describe('InventoryModule - Contract Compliance', () => {
  describe('Equipment Schema', () => {
    it('should validate all fixture equipment conform to schema', () => {
      EQUIPMENT_FIXTURE.forEach(equip => {
        expect(() => EquipmentSchema.parse(equip)).not.toThrow();
      });
    });

    it('should have all required fields', () => {
      const equip = EQUIPMENT_FIXTURE[0];
      expect(equip.id).toBeDefined();
      expect(equip.name).toBeDefined();
      expect(equip.brand).toBeDefined();
      expect(equip.modelName).toBeDefined();
      expect(equip.description).toBeDefined();
      expect(equip.type).toBeDefined();
      expect(equip.class).toBeDefined();
      expect(equip.accessories).toBeDefined();
      expect(equip.status).toBeDefined();
    });

    it('should reject equipment without name', () => {
      const invalid = { ...EQUIPMENT_FIXTURE[0], name: undefined };
      expect(() => EquipmentSchema.parse(invalid)).toThrow();
    });

    it('should reject equipment with invalid status', () => {
      const invalid = {
        ...EQUIPMENT_FIXTURE[0],
        status: 'Unknown' as any,
      };
      expect(() => EquipmentSchema.parse(invalid)).toThrow();
    });

    it('should accept equipment with valid statuses', () => {
      ['Available', 'In Use', 'Maintenance'].forEach(status => {
        const equip: Equipment = {
          ...EQUIPMENT_FIXTURE[0],
          status: status as any,
        };
        expect(() => EquipmentSchema.parse(equip)).not.toThrow();
      });
    });

    it('should accept equipment without createdBy', () => {
      const noCreated = {
        ...EQUIPMENT_FIXTURE[0],
        createdBy: undefined,
      };
      expect(() => EquipmentSchema.parse(noCreated)).not.toThrow();
    });

    it('should accept equipment without createdAt', () => {
      const noCreatedAt = {
        ...EQUIPMENT_FIXTURE[0],
        createdAt: undefined,
      };
      expect(() => EquipmentSchema.parse(noCreatedAt)).not.toThrow();
    });
  });

  describe('Accessory Schema', () => {
    it('should validate all fixture accessories conform to schema', () => {
      ACCESSORIES_FIXTURE.forEach(acc => {
        expect(() => AccessorySchema.parse(acc)).not.toThrow();
      });
    });

    it('should have all required fields', () => {
      const acc = ACCESSORIES_FIXTURE[0];
      expect(acc.id).toBeDefined();
      expect(acc.name).toBeDefined();
      expect(acc.owned).toBeDefined();
      expect(acc.type).toBeDefined();
    });

    it('should reject accessory without id', () => {
      const invalid = { ...ACCESSORIES_FIXTURE[0], id: undefined };
      expect(() => AccessorySchema.parse(invalid)).toThrow();
    });

    it('should reject accessory with invalid type', () => {
      const invalid = {
        ...ACCESSORIES_FIXTURE[0],
        type: 'premium' as any,
      };
      expect(() => AccessorySchema.parse(invalid)).toThrow();
    });

    it('should accept accessory with valid types', () => {
      ['standard', 'optional'].forEach(type => {
        const acc: Accessory = {
          ...ACCESSORIES_FIXTURE[0],
          type: type as any,
        };
        expect(() => AccessorySchema.parse(acc)).not.toThrow();
      });
    });

    it('should accept accessory without description', () => {
      const noDesc = {
        ...ACCESSORIES_FIXTURE[0],
        description: undefined,
      };
      expect(() => AccessorySchema.parse(noDesc)).not.toThrow();
    });
  });
});

// ============================================================================
// SECTION 3: Type Safety Tests
// ============================================================================

describe('InventoryModule - Type Safety', () => {
  it('should maintain type safety with Equipment', () => {
    const equip: Equipment = EQUIPMENT_FIXTURE[0];
    expectTypeOf(equip).toMatchTypeOf<Equipment>();
  });

  it('should maintain type safety with Accessory', () => {
    const acc: Accessory = ACCESSORIES_FIXTURE[0];
    expectTypeOf(acc).toMatchTypeOf<Accessory>();
  });

  it('should maintain array type safety', () => {
    const equipment: Equipment[] = EQUIPMENT_FIXTURE;
    expectTypeOf(equipment).toMatchTypeOf<Equipment[]>();
  });

  it('should maintain accessory array type safety', () => {
    const accessories: Accessory[] = ACCESSORIES_FIXTURE;
    expectTypeOf(accessories).toMatchTypeOf<Accessory[]>();
  });
});

// ============================================================================
// SECTION 4: Data Mutations & Transformations
// ============================================================================

describe('InventoryModule - Data Mutations', () => {
  it('should validate equipment with status change', () => {
    const updated: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      status: 'Maintenance',
    };
    expect(() => EquipmentSchema.parse(updated)).not.toThrow();
  });

  it('should validate equipment with updated accessories', () => {
    const updated: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      accessories: ACCESSORIES_FIXTURE,
    };
    expect(() => EquipmentSchema.parse(updated)).not.toThrow();
  });

  it('should validate accessory with ownership change', () => {
    const updated: Accessory = {
      ...ACCESSORIES_FIXTURE[2],
      owned: true,
    };
    expect(() => AccessorySchema.parse(updated)).not.toThrow();
  });

  it('should validate equipment with removed accessories', () => {
    const noAcc: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      accessories: [],
    };
    expect(() => EquipmentSchema.parse(noAcc)).not.toThrow();
  });

  it('should reject equipment with invalid status', () => {
    const invalid = {
      ...EQUIPMENT_FIXTURE[0],
      status: 'Broken' as any,
    };
    expect(() => EquipmentSchema.parse(invalid)).toThrow();
  });
});

// ============================================================================
// SECTION 5: Module Boundaries
// ============================================================================

describe('InventoryModule - Module Boundaries', () => {
  it('should use only contract types', () => {
    const equipment: Equipment[] = EQUIPMENT_FIXTURE;
    const accessories: Accessory[] = ACCESSORIES_FIXTURE;

    expectTypeOf(equipment).toMatchTypeOf<Equipment[]>();
    expectTypeOf(accessories).toMatchTypeOf<Accessory[]>();
  });

  it('should not expose internal backend types', () => {
    const equip = EQUIPMENT_FIXTURE[0];
    expect('_id' in equip).toBe(false);
    expect('_timestamp' in equip).toBe(false);
    expect('__typename' in equip).toBe(false);
  });
});

// ============================================================================
// SECTION 6: Data Consistency
// ============================================================================

describe('InventoryModule - Data Consistency', () => {
  it('should maintain unique equipment IDs', () => {
    const ids = new Set(EQUIPMENT_FIXTURE.map(e => e.id));
    expect(ids.size).toBe(EQUIPMENT_FIXTURE.length);
  });

  it('should maintain unique accessory IDs', () => {
    const ids = new Set(ACCESSORIES_FIXTURE.map(a => a.id));
    expect(ids.size).toBe(ACCESSORIES_FIXTURE.length);
  });

  it('should have valid accessories in equipment', () => {
    const allAccessoryIds = new Set(ACCESSORIES_FIXTURE.map(a => a.id));

    EQUIPMENT_FIXTURE.forEach(equip => {
      equip.accessories.forEach(acc => {
        expect(allAccessoryIds.has(acc.id)).toBe(true);
      });
    });
  });
});

// ============================================================================
// SECTION 7: Edge Cases & Boundaries
// ============================================================================

describe('InventoryModule - Edge Cases', () => {
  it('should accept equipment with very long name', () => {
    const longName: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      name: 'A'.repeat(500),
    };
    expect(() => EquipmentSchema.parse(longName)).not.toThrow();
  });

  it('should accept equipment with special characters', () => {
    const special: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      name: 'Cuisinart™ Food Processor & Mixer',
    };
    expect(() => EquipmentSchema.parse(special)).not.toThrow();
  });

  it('should accept equipment with unicode brand name', () => {
    const unicode: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      brand: '日本製',
      name: '日本製 キッチン',
    };
    expect(() => EquipmentSchema.parse(unicode)).not.toThrow();
  });

  it('should accept equipment with many accessories', () => {
    const manyAcc: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      accessories: Array.from({ length: 50 }, (_, i) => ({
        id: `acc-${i}`,
        name: `Accessory ${i}`,
        owned: i % 2 === 0,
        type: i % 3 === 0 ? 'optional' : 'standard',
      })),
    };
    expect(() => EquipmentSchema.parse(manyAcc)).not.toThrow();
  });

  it('should accept accessory with very long description', () => {
    const longDesc: Accessory = {
      ...ACCESSORIES_FIXTURE[0],
      description: 'A'.repeat(5000),
    };
    expect(() => AccessorySchema.parse(longDesc)).not.toThrow();
  });

  it('should accept equipment with empty description', () => {
    const noDesc: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      description: '',
    };
    expect(() => EquipmentSchema.parse(noDesc)).not.toThrow();
  });

  it('should accept equipment without createdAt', () => {
    const noCreatedAt: Equipment = {
      ...EQUIPMENT_FIXTURE[0],
      createdAt: undefined,
    };
    expect(() => EquipmentSchema.parse(noCreatedAt)).not.toThrow();
  });

  it('should accept all status values', () => {
    const statuses = ['Available', 'In Use', 'Maintenance'] as const;
    statuses.forEach(status => {
      const equip: Equipment = {
        ...EQUIPMENT_FIXTURE[0],
        status,
      };
      expect(() => EquipmentSchema.parse(equip)).not.toThrow();
    });
  });
});
