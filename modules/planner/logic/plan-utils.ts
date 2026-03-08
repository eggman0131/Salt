/**
 * Pure plan utilities for the Planner module.
 *
 * No I/O. All functions are stateless.
 */

import type { Plan, KitchenSettings } from '../../../types/contract';

/**
 * Find the plan whose 7-day window contains `date`.
 * Template plans are excluded.
 */
export function findPlanForDate(plans: Plan[], date: string): Plan | null {
  const targetTime = new Date(`${date}T00:00:00Z`).getTime();
  return (
    plans.find((p) => {
      if (p.startDate === 'template') return false;
      const startTime = new Date(`${p.startDate}T00:00:00Z`).getTime();
      return targetTime >= startTime && targetTime < startTime + 7 * 24 * 60 * 60 * 1000;
    }) ?? null
  );
}

/**
 * Safely extract the ordered user ID list from kitchen settings.
 */
export function getOrderedUserIds(settings: KitchenSettings | null): string[] {
  if (!settings?.userOrder || !Array.isArray(settings.userOrder)) return [];
  return settings.userOrder;
}

/**
 * Remove any cookId / presentIds that reference user IDs not in `validUserIds`.
 * Returns a new Plan object; does not mutate the input.
 */
export function sanitizePlan(plan: Plan, validUserIds: string[]): Plan {
  const valid = new Set(validUserIds);
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      cookId: day.cookId && valid.has(day.cookId) ? day.cookId : null,
      presentIds: day.presentIds.filter((id) => valid.has(id)),
    })),
  };
}
