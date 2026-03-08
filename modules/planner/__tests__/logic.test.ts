/**
 * Pure logic tests for the Planner module.
 *
 * No Firebase, no mocks, no side effects.
 */

import { describe, it, expect } from 'vitest';
import { getFriday, addDays, TEMPLATE_ID } from '../logic/dates';
import { findPlanForDate, getOrderedUserIds, sanitizePlan } from '../logic/plan-utils';
import type { Plan, KitchenSettings } from '../../../types/contract';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makePlan = (startDate: string, id = `plan-${startDate}`): Plan => ({
  id,
  startDate,
  days: Array.from({ length: 7 }, (_, i) => ({
    date: addDays(startDate, i),
    cookId: null,
    presentIds: ['user-1', 'user-2'],
    userNotes: {},
    mealNotes: '',
  })),
  createdAt: '2024-01-01T00:00:00.000Z',
  createdBy: 'user-1',
});

// ── getFriday ─────────────────────────────────────────────────────────────────

describe('getFriday', () => {
  it('returns the same date when given a Friday', () => {
    expect(getFriday('2024-01-05')).toBe('2024-01-05'); // Friday
  });

  it('normalises Saturday back to Friday', () => {
    expect(getFriday('2024-01-06')).toBe('2024-01-05');
  });

  it('normalises Sunday back to Friday', () => {
    expect(getFriday('2024-01-07')).toBe('2024-01-05');
  });

  it('normalises Monday back to Friday', () => {
    expect(getFriday('2024-01-08')).toBe('2024-01-05');
  });

  it('normalises Thursday back to Friday', () => {
    expect(getFriday('2024-01-11')).toBe('2024-01-05');
  });

  it('handles ISO datetime strings', () => {
    expect(getFriday('2024-01-08T12:00:00Z')).toBe('2024-01-05');
  });
});

// ── addDays ───────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2024-01-05', 6)).toBe('2024-01-11');
  });

  it('adding 0 days returns the same date', () => {
    expect(addDays('2024-01-05', 0)).toBe('2024-01-05');
  });

  it('handles month boundary', () => {
    expect(addDays('2024-01-29', 3)).toBe('2024-02-01');
  });
});

// ── TEMPLATE_ID ───────────────────────────────────────────────────────────────

describe('TEMPLATE_ID', () => {
  it('is the expected constant', () => {
    expect(TEMPLATE_ID).toBe('plan-template');
  });
});

// ── findPlanForDate ───────────────────────────────────────────────────────────

describe('findPlanForDate', () => {
  const plan = makePlan('2024-01-05'); // Fri 5 Jan — covers 5–11 Jan

  it('returns a plan when the date falls on the start date', () => {
    expect(findPlanForDate([plan], '2024-01-05')).toBe(plan);
  });

  it('returns a plan when the date falls mid-week', () => {
    expect(findPlanForDate([plan], '2024-01-08')).toBe(plan);
  });

  it('returns a plan when the date is the last day of the week', () => {
    expect(findPlanForDate([plan], '2024-01-11')).toBe(plan);
  });

  it('returns null for a date after the week ends', () => {
    expect(findPlanForDate([plan], '2024-01-12')).toBeNull();
  });

  it('returns null for a date before the week starts', () => {
    expect(findPlanForDate([plan], '2024-01-04')).toBeNull();
  });

  it('returns null for empty plans list', () => {
    expect(findPlanForDate([], '2024-01-05')).toBeNull();
  });

  it('skips template plans', () => {
    const template: Plan = {
      id: TEMPLATE_ID,
      startDate: 'template',
      days: Array.from({ length: 7 }, (_, i) => ({
        date: `day-${i}`,
        cookId: null,
        presentIds: [],
        userNotes: {},
        mealNotes: '',
      })),
      createdAt: '2024-01-01T00:00:00.000Z',
      createdBy: 'user-1',
    };
    expect(findPlanForDate([template], '2024-01-05')).toBeNull();
  });

  it('finds the correct plan among multiple', () => {
    const plan2 = makePlan('2024-01-12');
    expect(findPlanForDate([plan, plan2], '2024-01-14')).toBe(plan2);
    expect(findPlanForDate([plan, plan2], '2024-01-06')).toBe(plan);
  });
});

// ── getOrderedUserIds ─────────────────────────────────────────────────────────

describe('getOrderedUserIds', () => {
  it('returns empty array for null settings', () => {
    expect(getOrderedUserIds(null)).toEqual([]);
  });

  it('returns empty array when userOrder is missing', () => {
    const settings: KitchenSettings = { directives: '' };
    expect(getOrderedUserIds(settings)).toEqual([]);
  });

  it('returns empty array when userOrder is not an array', () => {
    const settings = { directives: '', userOrder: 'bad' as any };
    expect(getOrderedUserIds(settings)).toEqual([]);
  });

  it('returns the userOrder array when valid', () => {
    const settings: KitchenSettings = { directives: '', userOrder: ['user-2', 'user-1'] };
    expect(getOrderedUserIds(settings)).toEqual(['user-2', 'user-1']);
  });
});

// ── sanitizePlan ──────────────────────────────────────────────────────────────

describe('sanitizePlan', () => {
  const plan = makePlan('2024-01-05');

  it('keeps valid cookId and presentIds unchanged', () => {
    const result = sanitizePlan(plan, ['user-1', 'user-2']);
    expect(result.days[0].presentIds).toEqual(['user-1', 'user-2']);
    expect(result.days[0].cookId).toBeNull(); // fixture has null
  });

  it('nulls a cookId for a removed user', () => {
    const withCook: Plan = {
      ...plan,
      days: plan.days.map((d, i) => (i === 0 ? { ...d, cookId: 'user-2' } : d)),
    };
    const result = sanitizePlan(withCook, ['user-1']); // user-2 removed
    expect(result.days[0].cookId).toBeNull();
  });

  it('filters presentIds for removed users', () => {
    const result = sanitizePlan(plan, ['user-1']); // user-2 removed
    expect(result.days[0].presentIds).toEqual(['user-1']);
  });

  it('returns empty presentIds when all users are removed', () => {
    const result = sanitizePlan(plan, []);
    result.days.forEach((d) => expect(d.presentIds).toEqual([]));
  });

  it('does not mutate the original plan', () => {
    const original = JSON.stringify(plan);
    sanitizePlan(plan, ['user-1']);
    expect(JSON.stringify(plan)).toBe(original);
  });

  it('preserves other day fields unchanged', () => {
    const withNotes: Plan = {
      ...plan,
      days: plan.days.map((d, i) => (i === 0 ? { ...d, mealNotes: 'Pasta night' } : d)),
    };
    const result = sanitizePlan(withNotes, ['user-1', 'user-2']);
    expect(result.days[0].mealNotes).toBe('Pasta night');
  });
});
