/**
 * Pure date utilities for the Planner module.
 *
 * No I/O. All functions are stateless.
 */

export const TEMPLATE_ID = 'plan-template';

/**
 * Normalise any date string to the Friday that starts its week.
 * Week is defined as Friday–Thursday to match the kitchen planning cycle.
 */
export function getFriday(dStr: string): string {
  const normalized = dStr.includes('T') ? dStr : `${dStr}T00:00:00Z`;
  const d = new Date(normalized);
  const day = d.getUTCDay();
  const daysToSubtract = (day + 2) % 7;
  d.setUTCDate(d.getUTCDate() - daysToSubtract);
  return d.toISOString().split('T')[0];
}

/**
 * Returns an ISO date string for a date offset by `days` from the given UTC date string.
 */
export function addDays(dStr: string, days: number): string {
  const d = new Date(`${dStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}
