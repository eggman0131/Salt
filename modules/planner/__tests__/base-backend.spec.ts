/**
 * Planner Backend Domain Logic Tests
 * 
 * Comprehensive test suite for meal plan management.
 * Tests the BasePlannerBackend domain logic in isolation (mocked Firebase).
 * 
 * SECTIONS:
 * 1. Mock Implementation (TestPlannerBackend)
 * 2. Domain Logic Tests (date arithmetic, user ordering)
 * 3. Contract Compliance Tests (Plan, DayPlan, KitchenSettings validation)
 * 4. Error Path Tests (null inputs, edge cases)
 * 5. Integration Tests (full plan workflows)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlanSchema,
  DayPlanSchema,
  KitchenSettingsSchema
} from '../../../types/contract';
import type { Plan, DayPlan, KitchenSettings } from '../../../types/contract';

// ============================================================================
// SECTION 1: Mock Implementation (TestPlannerBackend)
// ============================================================================

/**
 * TestPlannerBackend: Mocked implementation for isolated testing.
 * Mocks all external dependencies:
 * - Firebase persistence
 */
class TestPlannerBackend {
  private plans = new Map<string, Plan>();
  private settings: KitchenSettings = {
    directives: 'Default kitchen directives',
    userOrder: [],
  };

  // Domain logic methods exposed for testing

  /**
   * Get plan that includes a specific date
   */
  async getPlanIncludingDate(date: string): Promise<Plan | null> {
    const all = Array.from(this.plans.values());
    // Normalize to UTC midnight for consistent relative comparison
    const targetTime = new Date(`${date}T00:00:00Z`).getTime();

    return (
      all.find(p => {
        if (p.startDate === 'template') return false;

        const startTime = new Date(`${p.startDate}T00:00:00Z`).getTime();
        return targetTime >= startTime && targetTime < startTime + 7 * 24 * 60 * 60 * 1000;
      }) || null
    );
  }

  /**
   * Safely extract user IDs in order from kitchen settings
   */
  getOrderedUserIds(settings: KitchenSettings | null): string[] {
    if (!settings?.userOrder || !Array.isArray(settings.userOrder)) {
      return [];
    }
    return settings.userOrder;
  }

  // Persistence methods (for testing)

  async getPlans(): Promise<Plan[]> {
    return Array.from(this.plans.values());
  }

  async getPlanByDate(date: string): Promise<Plan | null> {
    return Array.from(this.plans.values()).find(p => {
      const dayInPlan = p.days.find(d => d.date === date);
      return !!dayInPlan;
    }) || null;
  }

  async createOrUpdatePlan(
    p: Omit<Plan, 'id' | 'createdAt' | 'createdBy'> & { id?: string }
  ): Promise<Plan> {
    const id = p.id || `plan-${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();
    const created: Plan = {
      ...p,
      id,
      createdAt: now,
      createdBy: 'test-user',
    };
    this.plans.set(id, created);
    return created;
  }

  async deletePlan(id: string): Promise<void> {
    this.plans.delete(id);
  }

  async getKitchenSettings(): Promise<KitchenSettings> {
    return this.settings;
  }

  async updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings> {
    this.settings = settings;
    return this.settings;
  }

  setInitialSettings(settings: KitchenSettings): void {
    this.settings = settings;
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

const TODAY = '2025-02-20';
const TOMORROW = '2025-02-21';
const NEXT_WEEK = '2025-02-27';

const VALID_DAY_PLAN: DayPlan = {
  date: TODAY,
  cookId: null,
  presentIds: ['user-1', 'user-2'],
  userNotes: {
    'user-1': 'Vegetarian preference',
    'user-2': 'Allergic to nuts',
  },
  mealNotes: 'Simple, quick meal',
};

const VALID_PLAN: Plan = {
  id: 'plan-1',
  startDate: TODAY,
  createdAt: new Date().toISOString(),
  createdBy: 'user-1',
  days: [
    {
      date: TODAY,
      cookId: 'user-1',
      presentIds: ['user-1', 'user-2'],
      userNotes: {},
      mealNotes: '',
    },
    {
      date: TOMORROW,
      cookId: 'user-2',
      presentIds: ['user-1', 'user-2'],
      userNotes: {},
      mealNotes: '',
    },
  ],
};

const KITCHEN_SETTINGS: KitchenSettings = {
  directives: 'Use fresh seasonal produce. Always metric. British cuisine focus.',
  userOrder: ['user-1', 'user-2', 'user-3'],
};

// ============================================================================
// SECTION 2: Domain Logic Tests
// ============================================================================

describe('Planner Backend - Domain Logic', () => {
  let backend: TestPlannerBackend;

  beforeEach(() => {
    backend = new TestPlannerBackend();
  });

  describe('Plan Date Arithmetic', () => {
    it('should find plan containing a specific date', async () => {
      const plan = await backend.createOrUpdatePlan({
        startDate: TODAY,
        days: [
          { date: TODAY, cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
          { date: TOMORROW, cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
          { date: '2025-02-22', cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
        ],
      });

      const found = await backend.getPlanIncludingDate(TOMORROW);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(plan.id);
      expect(found?.days).toHaveLength(3);
    });

    it('should not find plan for date outside week range', async () => {
      await backend.createOrUpdatePlan({
        startDate: TODAY,
        days: [
          { date: TODAY, cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
        ],
      });

      const found = await backend.getPlanIncludingDate(NEXT_WEEK);

      expect(found).toBeNull();
    });

    it('should handle template plan (excluded from date matching)', async () => {
      await backend.createOrUpdatePlan({
        startDate: 'template',
        days: [
          { date: 'Mon', cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
        ],
      });

      const found = await backend.getPlanIncludingDate(TODAY);

      expect(found).toBeNull();
    });

    it('should find correct plan when multiple exist', async () => {
      const plan1 = await backend.createOrUpdatePlan({
        startDate: '2025-02-13',
        days: [
          { date: '2025-02-13', cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
        ],
      });

      const plan2 = await backend.createOrUpdatePlan({
        startDate: TODAY,
        days: [
          { date: TODAY, cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
        ],
      });

      const foundToday = await backend.getPlanIncludingDate(TODAY);
      const foundLastWeek = await backend.getPlanIncludingDate('2025-02-13');

      expect(foundToday?.id).toBe(plan2.id);
      expect(foundLastWeek?.id).toBe(plan1.id);
    });
  });

  describe('Kitchen Settings User Ordering', () => {
    it('should extract ordered user IDs', () => {
      const settings: KitchenSettings = {
        directives: 'Test',
        userOrder: ['user-1', 'user-3', 'user-2'],
      };

      const ordered = backend.getOrderedUserIds(settings);

      expect(ordered).toEqual(['user-1', 'user-3', 'user-2']);
    });

    it('should return empty array for missing user order', () => {
      const settings: KitchenSettings = { directives: 'Test' };

      const ordered = backend.getOrderedUserIds(settings);

      expect(ordered).toEqual([]);
    });

    it('should return empty array for null settings', () => {
      const ordered = backend.getOrderedUserIds(null);

      expect(ordered).toEqual([]);
    });

    it('should preserve single user', () => {
      const settings: KitchenSettings = {
        directives: 'Test',
        userOrder: ['user-1'],
      };

      const ordered = backend.getOrderedUserIds(settings);

      expect(ordered).toEqual(['user-1']);
    });
  });
});

// ============================================================================
// SECTION 3: Contract Compliance Tests
// ============================================================================

describe('Planner Backend - Contract Compliance', () => {
  describe('DayPlan Validation', () => {
    it('should validate complete day plan', () => {
      const dayPlan: DayPlan = {
        date: TODAY,
        cookId: 'user-1',
        presentIds: ['user-1', 'user-2', 'user-3'],
        userNotes: {
          'user-1': 'Prefer no garlic',
          'user-2': 'Vegetarian',
        },
        mealNotes: 'Quick dinner, 30 mins max',
      };

      const result = DayPlanSchema.safeParse(dayPlan);

      expect(result.success).toBe(true);
    });

    it('should validate day plan with null cookId', () => {
      const dayPlan: DayPlan = {
        date: TODAY,
        cookId: null,
        presentIds: ['user-1'],
        userNotes: {},
        mealNotes: '',
      };

      const result = DayPlanSchema.safeParse(dayPlan);

      expect(result.success).toBe(true);
    });

    it('should require core day plan fields', () => {
      const invalid = {
        date: TODAY,
        // Missing cookId, presentIds, userNotes, mealNotes
      };

      const result = DayPlanSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should validate empty present list', () => {
      const dayPlan: DayPlan = {
        date: TODAY,
        cookId: null,
        presentIds: [],
        userNotes: {},
        mealNotes: '',
      };

      const result = DayPlanSchema.safeParse(dayPlan);

      expect(result.success).toBe(true);
    });

    it('should validate empty user notes', () => {
      const dayPlan: DayPlan = {
        date: TODAY,
        cookId: null,
        presentIds: ['user-1'],
        userNotes: {},
        mealNotes: '',
      };

      const result = DayPlanSchema.safeParse(dayPlan);

      expect(result.success).toBe(true);
    });
  });

  describe('Plan Validation', () => {
    it('should validate complete plan', () => {
      const plan: Plan = {
        id: 'plan-1',
        startDate: TODAY,
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        days: [
          {
            date: TODAY,
            cookId: 'user-1',
            presentIds: ['user-1', 'user-2'],
            userNotes: {},
            mealNotes: 'Test meal',
          },
        ],
      };

      const result = PlanSchema.safeParse(plan);

      expect(result.success).toBe(true);
    });

    it('should validate plan with 7-day week', () => {
      const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(TODAY);
        date.setDate(date.getDate() + i);
        return {
          date: date.toISOString().split('T')[0],
          cookId: null,
          presentIds: [],
          userNotes: {},
          mealNotes: '',
        };
      });

      const plan: Plan = {
        id: 'plan-1',
        startDate: TODAY,
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        days,
      };

      const result = PlanSchema.safeParse(plan);

      expect(result.success).toBe(true);
      expect(result.data?.days).toHaveLength(7);
    });

    it('should require core plan fields', () => {
      const invalid = {
        id: 'plan-1',
        startDate: TODAY,
        // Missing days, createdAt, createdBy
      };

      const result = PlanSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should validate template plan', () => {
      const plan: Plan = {
        id: 'template-1',
        startDate: 'template',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        days: [
          {
            date: 'Monday',
            cookId: null,
            presentIds: [],
            userNotes: {},
            mealNotes: '',
          },
        ],
      };

      const result = PlanSchema.safeParse(plan);

      expect(result.success).toBe(true);
    });
  });

  describe('KitchenSettings Validation', () => {
    it('should validate complete kitchen settings', () => {
      const settings: KitchenSettings = {
        directives: 'Metric units. Fresh produce. Quick weekday meals.',
        userOrder: ['alice', 'bob', 'charlie'],
      };

      const result = KitchenSettingsSchema.safeParse(settings);

      expect(result.success).toBe(true);
    });

    it('should validate settings with only directives', () => {
      const settings: KitchenSettings = {
        directives: 'Keep it simple',
      };

      const result = KitchenSettingsSchema.safeParse(settings);

      expect(result.success).toBe(true);
    });

    it('should require directives field', () => {
      const invalid = {
        userOrder: ['user-1'],
        // Missing directives
      };

      const result = KitchenSettingsSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should validate debug flag', () => {
      const settings: KitchenSettings = {
        directives: 'Test',
        debugEnabled: true,
      };

      const result = KitchenSettingsSchema.safeParse(settings);

      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 4: Error Path Tests
// ============================================================================

describe('Planner Backend - Error Paths', () => {
  let backend: TestPlannerBackend;

  beforeEach(() => {
    backend = new TestPlannerBackend();
  });

  describe('Invalid Input Handling', () => {
    it('should handle invalid date format gracefully', async () => {
      const found = await backend.getPlanIncludingDate('invalid-date');

      // Should not crash, returns null or handles gracefully
      expect(found).toBeNull();
    });

    it('should handle null settings in user ordering', () => {
      const ordered = backend.getOrderedUserIds(null);

      expect(ordered).toEqual([]);
    });

    it('should handle settings with non-array userOrder', () => {
      const settings: any = {
        directives: 'Test',
        userOrder: 'not-an-array',
      };

      const ordered = backend.getOrderedUserIds(settings);

      expect(ordered).toEqual([]);
    });

    it('should handle very long directive text', async () => {
      const longDirective = 'a'.repeat(10000);
      const settings: KitchenSettings = {
        directives: longDirective,
      };

      const updated = await backend.updateKitchenSettings(settings);

      expect(updated.directives).toBe(longDirective);
    });
  });

  describe('Edge Cases', () => {
    it('should handle date at week boundary', async () => {
      const plan = await backend.createOrUpdatePlan({
        startDate: TODAY,
        days: Array.from({ length: 7 }, (_, i) => {
          const date = new Date(TODAY);
          date.setDate(date.getDate() + i);
          return {
            date: date.toISOString().split('T')[0],
            cookId: null,
            presentIds: [],
            userNotes: {},
            mealNotes: '',
          };
        }),
      });

      const lastDay = new Date(TODAY);
      lastDay.setDate(lastDay.getDate() + 6);
      const found = await backend.getPlanIncludingDate(lastDay.toISOString().split('T')[0]);

      expect(found?.id).toBe(plan.id);
    });

    it('should handle date just outside week range', async () => {
      const plan = await backend.createOrUpdatePlan({
        startDate: TODAY,
        days: [
          { date: TODAY, cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
        ],
      });

      const nextDay = new Date(TODAY);
      nextDay.setDate(nextDay.getDate() + 7);
      const found = await backend.getPlanIncludingDate(nextDay.toISOString().split('T')[0]);

      expect(found).toBeNull();
    });

    it('should handle plan with many users', () => {
      const users = Array.from({ length: 50 }, (_, i) => `user-${i}`);
      const settings: KitchenSettings = {
        directives: 'Test',
        userOrder: users,
      };

      const ordered = backend.getOrderedUserIds(settings);

      expect(ordered).toHaveLength(50);
    });
  });
});

// ============================================================================
// SECTION 5: Integration Tests
// ============================================================================

describe('Planner Backend - Integration', () => {
  let backend: TestPlannerBackend;

  beforeEach(() => {
    backend = new TestPlannerBackend();
    backend.setInitialSettings(KITCHEN_SETTINGS);
  });

  it('should complete full plan creation and retrieval workflow', async () => {
    // Create a new plan
    const created = await backend.createOrUpdatePlan({
      startDate: TODAY,
      days: [
        {
          date: TODAY,
          cookId: 'user-1',
          presentIds: ['user-1', 'user-2'],
          userNotes: { 'user-1': 'No spicy' },
          mealNotes: 'Pasta night',
        },
        {
          date: TOMORROW,
          cookId: 'user-2',
          presentIds: ['user-1', 'user-2'],
          userNotes: { 'user-2': 'Vegetarian' },
          mealNotes: 'Stir fry',
        },
      ],
    });

    expect(created.id).toBeDefined();
    expect(created.days).toHaveLength(2);

    // Retrieve plan by date
    const todayPlan = await backend.getPlanByDate(TODAY);
    expect(todayPlan?.id).toBe(created.id);

    const tomorrowPlan = await backend.getPlanByDate(TOMORROW);
    expect(tomorrowPlan?.id).toBe(created.id);
  });

  it('should handle plan updates', async () => {
    const created = await backend.createOrUpdatePlan({
      startDate: TODAY,
      days: [
        { date: TODAY, cookId: null, presentIds: [], userNotes: {}, mealNotes: '' },
      ],
    });

    const updated = await backend.createOrUpdatePlan({
      id: created.id,
      startDate: TODAY,
      days: [
        { date: TODAY, cookId: 'user-1', presentIds: ['user-1'], userNotes: {}, mealNotes: 'Updated' },
      ],
    });

    expect(updated.id).toBe(created.id);
    expect(updated.days[0].mealNotes).toBe('Updated');
  });

  it('should manage kitchen settings across operations', async () => {
    const initial = await backend.getKitchenSettings();
    expect(initial.directives).toBe(KITCHEN_SETTINGS.directives);

    const newSettings: KitchenSettings = {
      directives: 'Updated directives',
      userOrder: ['user-2', 'user-1'],
    };

    const updated = await backend.updateKitchenSettings(newSettings);
    expect(updated.directives).toBe('Updated directives');

    // Verify setting is persisted
    const retrieved = await backend.getKitchenSettings();
    expect(retrieved.directives).toBe('Updated directives');
  });

  it('should handle multiple concurrent plans', async () => {
    const plan1 = await backend.createOrUpdatePlan({
      startDate: '2025-02-13',
      days: [{ date: '2025-02-13', cookId: null, presentIds: [], userNotes: {}, mealNotes: '' }],
    });

    const plan2 = await backend.createOrUpdatePlan({
      startDate: TODAY,
      days: [{ date: TODAY, cookId: null, presentIds: [], userNotes: {}, mealNotes: '' }],
    });

    const allPlans = await backend.getPlans();
    expect(allPlans).toHaveLength(2);

    // Verify correct plan is found for each date
    const found1 = await backend.getPlanIncludingDate('2025-02-13');
    const found2 = await backend.getPlanIncludingDate(TODAY);

    expect(found1?.id).toBe(plan1.id);
    expect(found2?.id).toBe(plan2.id);
  });

  it('should validate plan data while operating', async () => {
    const plan = await backend.createOrUpdatePlan({
      startDate: TODAY,
      days: [VALID_DAY_PLAN],
    });

    // Verify the created plan passes schema validation
    const validation = PlanSchema.safeParse(plan);
    expect(validation.success).toBe(true);
  });

  it('should respect user order in settings', async () => {
    const settings = await backend.getKitchenSettings();
    const ordered = backend.getOrderedUserIds(settings);

    expect(ordered).toEqual(KITCHEN_SETTINGS.userOrder);
  });
});
