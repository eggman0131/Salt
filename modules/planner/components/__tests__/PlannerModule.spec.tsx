/**
 * Planner Module - Frontend Contract Tests
 *
 * Test suite for PlannerModule React component focusing on:
 * - Contract compliance (Zod schema validation)
 * - Type safety (TypeScript type checking)
 * - Data consistency (linked references)
 * - Edge cases and boundaries
 */

import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  Plan,
  DayPlan,
} from '../../../../types/contract';
import {
  PlanSchema,
  DayPlanSchema,
} from '../../../../types/contract';

// ============================================================================
// SECTION 1: Test Fixtures (Contract-Shaped Data)
// ============================================================================

const DAY_PLANS_FIXTURE: DayPlan[] = [
  {
    date: '2024-02-16',
    cookId: 'user-1',
    presentIds: ['user-1', 'user-2'],
    userNotes: {
      'user-1': 'Early dinner please',
      'user-2': 'Vegetarian option needed',
    },
    mealNotes: 'Casual family gathering',
  },
  {
    date: '2024-02-17',
    cookId: null,
    presentIds: ['user-1'],
    userNotes: {
      'user-1': 'Quick meal',
    },
    mealNotes: 'Solo meal, simple prep',
  },
  {
    date: '2024-02-18',
    cookId: 'user-2',
    presentIds: ['user-1', 'user-2', 'user-3'],
    userNotes: {},
    mealNotes: 'Formal dinner planned',
  },
];

const PLAN_FIXTURE: Plan = {
  id: 'plan-1',
  startDate: '2024-02-16',
  days: DAY_PLANS_FIXTURE,
  createdAt: '2024-02-01T00:00:00Z',
  createdBy: 'user-1',
};

// ============================================================================
// SECTION 2: Contract Compliance Tests
// ============================================================================

describe('PlannerModule - Contract Compliance', () => {
  describe('Plan Schema', () => {
    it('should validate plan fixture conforms to schema', () => {
      expect(() => PlanSchema.parse(PLAN_FIXTURE)).not.toThrow();
    });

    it('should have all required fields', () => {
      const plan = PLAN_FIXTURE;
      expect(plan.id).toBeDefined();
      expect(plan.startDate).toBeDefined();
      expect(plan.days).toBeDefined();
      expect(plan.createdAt).toBeDefined();
      expect(plan.createdBy).toBeDefined();
    });

    it('should reject plan without id', () => {
      const invalid = { ...PLAN_FIXTURE, id: undefined };
      expect(() => PlanSchema.parse(invalid)).toThrow();
    });

    it('should reject plan without startDate', () => {
      const invalid = { ...PLAN_FIXTURE, startDate: undefined };
      expect(() => PlanSchema.parse(invalid)).toThrow();
    });

    it('should accept plan with empty days array', () => {
      const emptyDays = { ...PLAN_FIXTURE, days: [] };
      expect(() => PlanSchema.parse(emptyDays)).not.toThrow();
    });

    it('should accept plan with many days', () => {
      const manyDays: Plan = {
        ...PLAN_FIXTURE,
        days: Array.from({ length: 365 }, (_, i) => ({
          date: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
          cookId: i % 2 === 0 ? 'user-1' : null,
          presentIds: ['user-1'],
          userNotes: {},
          mealNotes: `Day ${i}`,
        })),
      };
      expect(() => PlanSchema.parse(manyDays)).not.toThrow();
    });
  });

  describe('DayPlan Schema', () => {
    it('should validate all fixture days conform to schema', () => {
      DAY_PLANS_FIXTURE.forEach(day => {
        expect(() => DayPlanSchema.parse(day)).not.toThrow();
      });
    });

    it('should have all required fields', () => {
      const day = DAY_PLANS_FIXTURE[0];
      expect(day.date).toBeDefined();
      expect(day.cookId).toBeDefined();
      expect(day.presentIds).toBeDefined();
      expect(day.userNotes).toBeDefined();
      expect(day.mealNotes).toBeDefined();
    });

    it('should reject day without date', () => {
      const invalid = { ...DAY_PLANS_FIXTURE[0], date: undefined };
      expect(() => DayPlanSchema.parse(invalid)).toThrow();
    });

    it('should accept day with null cookId', () => {
      expect(() => DayPlanSchema.parse(DAY_PLANS_FIXTURE[1])).not.toThrow();
    });

    it('should accept day with empty presentIds', () => {
      const noPresent: DayPlan = {
        ...DAY_PLANS_FIXTURE[0],
        presentIds: [],
      };
      expect(() => DayPlanSchema.parse(noPresent)).not.toThrow();
    });

    it('should accept day with empty userNotes', () => {
      const noNotes: DayPlan = {
        ...DAY_PLANS_FIXTURE[0],
        userNotes: {},
      };
      expect(() => DayPlanSchema.parse(noNotes)).not.toThrow();
    });

    it('should accept day with empty mealNotes', () => {
      const emptyMeal: DayPlan = {
        ...DAY_PLANS_FIXTURE[0],
        mealNotes: '',
      };
      expect(() => DayPlanSchema.parse(emptyMeal)).not.toThrow();
    });

    it('should accept day with many user notes', () => {
      const manyNotes: DayPlan = {
        ...DAY_PLANS_FIXTURE[0],
        userNotes: {
          'user-1': 'Note 1',
          'user-2': 'Note 2',
          'user-3': 'Note 3',
          'user-4': 'Note 4',
        },
      };
      expect(() => DayPlanSchema.parse(manyNotes)).not.toThrow();
    });
  });
});

// ============================================================================
// SECTION 3: Type Safety Tests
// ============================================================================

describe('PlannerModule - Type Safety', () => {
  it('should maintain type safety with Plan', () => {
    const plan: Plan = PLAN_FIXTURE;
    expectTypeOf(plan).toMatchTypeOf<Plan>();
  });

  it('should maintain type safety with DayPlan', () => {
    const day: DayPlan = DAY_PLANS_FIXTURE[0];
    expectTypeOf(day).toMatchTypeOf<DayPlan>();
  });

  it('should maintain array type safety', () => {
    const plans: Plan[] = [PLAN_FIXTURE];
    expectTypeOf(plans).toMatchTypeOf<Plan[]>();
  });

  it('should maintain day array type safety', () => {
    const days: DayPlan[] = DAY_PLANS_FIXTURE;
    expectTypeOf(days).toMatchTypeOf<DayPlan[]>();
  });
});

// ============================================================================
// SECTION 4: Data Mutations & Transformations
// ============================================================================

describe('PlannerModule - Data Mutations', () => {
  it('should validate plan with updated days', () => {
    const updated: Plan = {
      ...PLAN_FIXTURE,
      days: [DAY_PLANS_FIXTURE[0]],
    };
    expect(() => PlanSchema.parse(updated)).not.toThrow();
  });

  it('should validate day with updated cookId', () => {
    const updated: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      cookId: 'user-2',
    };
    expect(() => DayPlanSchema.parse(updated)).not.toThrow();
  });

  it('should validate day with updated mealNotes', () => {
    const updated: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      mealNotes: 'Updated meal notes',
    };
    expect(() => DayPlanSchema.parse(updated)).not.toThrow();
  });

  it('should validate day with updated presentIds', () => {
    const updated: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      presentIds: ['user-1', 'user-3', 'user-4'],
    };
    expect(() => DayPlanSchema.parse(updated)).not.toThrow();
  });

  it('should reject day with invalid date type', () => {
    const invalid = {
      ...DAY_PLANS_FIXTURE[0],
      date: 12345 as any,
    };
    expect(() => DayPlanSchema.parse(invalid)).toThrow();
  });

  it('should reject plan with invalid days type', () => {
    const invalid = {
      ...PLAN_FIXTURE,
      days: 'not an array' as any,
    };
    expect(() => PlanSchema.parse(invalid)).toThrow();
  });
});

// ============================================================================
// SECTION 5: Module Boundaries
// ============================================================================

describe('PlannerModule - Module Boundaries', () => {
  it('should use only contract types', () => {
    const plan: Plan = PLAN_FIXTURE;
    const days: DayPlan[] = DAY_PLANS_FIXTURE;

    expectTypeOf(plan).toMatchTypeOf<Plan>();
    expectTypeOf(days).toMatchTypeOf<DayPlan[]>();
  });

  it('should not expose internal backend types', () => {
    const plan = PLAN_FIXTURE;
    expect('_id' in plan).toBe(false);
    expect('_timestamp' in plan).toBe(false);
    expect('__typename' in plan).toBe(false);
  });
});

// ============================================================================
// SECTION 6: Data Consistency
// ============================================================================

describe('PlannerModule - Data Consistency', () => {
  it('should maintain consistent dates in plan', () => {
    const plan = PLAN_FIXTURE;
    expect(plan.days.length).toBeGreaterThan(0);
  });

  it('should have unique dates within plan', () => {
    const dates = new Set(PLAN_FIXTURE.days.map(d => d.date));
    expect(dates.size).toBe(PLAN_FIXTURE.days.length);
  });

  it('should start date align with first day', () => {
    if (PLAN_FIXTURE.days.length > 0) {
      expect(PLAN_FIXTURE.startDate).toBe(PLAN_FIXTURE.days[0].date);
    }
  });
});

// ============================================================================
// SECTION 7: Edge Cases & Boundaries
// ============================================================================

describe('PlannerModule - Edge Cases', () => {
  it('should accept plan with single day', () => {
    const oneDay: Plan = {
      ...PLAN_FIXTURE,
      days: [DAY_PLANS_FIXTURE[0]],
    };
    expect(() => PlanSchema.parse(oneDay)).not.toThrow();
  });

  it('should accept day with very long mealNotes', () => {
    const longNotes: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      mealNotes: 'A'.repeat(5000),
    };
    expect(() => DayPlanSchema.parse(longNotes)).not.toThrow();
  });

  it('should accept day with special characters in notes', () => {
    const special: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      mealNotes: 'Crème Brûlée & Soufflé',
      userNotes: {
        'user-1': 'Prefer jalapeños & cilantro',
      },
    };
    expect(() => DayPlanSchema.parse(special)).not.toThrow();
  });

  it('should accept day with unicode in notes', () => {
    const unicode: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      mealNotes: '日本料理 - Japanese menu',
    };
    expect(() => DayPlanSchema.parse(unicode)).not.toThrow();
  });

  it('should accept day with many present users', () => {
    const manyPresent: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      presentIds: Array.from({ length: 50 }, (_, i) => `user-${i}`),
    };
    expect(() => DayPlanSchema.parse(manyPresent)).not.toThrow();
  });

  it('should accept day with null cookId and present users', () => {
    const noCook: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      cookId: null,
    };
    expect(() => DayPlanSchema.parse(noCook)).not.toThrow();
  });

  it('should accept year spanning plan', () => {
    const yearPlan: Plan = {
      ...PLAN_FIXTURE,
      startDate: '2024-01-01',
      days: Array.from({ length: 366 }, (_, i) => {
        const date = new Date(2024, 0, 1 + i);
        return {
          date: date.toISOString().split('T')[0],
          cookId: i % 3 === 0 ? 'user-1' : null,
          presentIds: ['user-1'],
          userNotes: {},
          mealNotes: '',
        };
      }),
    };
    expect(() => PlanSchema.parse(yearPlan)).not.toThrow();
  });

  it('should accept plan with duplicate present IDs', () => {
    const dupPresent: DayPlan = {
      ...DAY_PLANS_FIXTURE[0],
      presentIds: ['user-1', 'user-1', 'user-2'],
    };
    expect(() => DayPlanSchema.parse(dupPresent)).not.toThrow();
  });
});
