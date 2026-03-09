/**
 * Contribution aggregation — pure functions, no I/O.
 *
 * Sums contributions into a totalBaseQty + baseUnit.
 * Reconcilable units (same category) are summed.
 * Irreconcilable units are returned separately.
 */

import type { ShoppingListContribution } from '../types';
import { normaliseToBase, canReconcile } from './unit-normalisation';

export interface AggregationResult {
  totalBaseQty: number;
  baseUnit: string;
  unreconciled: ShoppingListContribution[];  // contributions that couldn't be summed
}

/**
 * Sum all contributions for a single shopping list item.
 *
 * Groups contributions by reconcilable unit category.
 * Returns the dominant group (largest total) as totalBaseQty/baseUnit.
 * Any contributions that can't be reconciled with the dominant group
 * are returned in `unreconciled`.
 */
export function sumContributions(
  contributions: ShoppingListContribution[]
): AggregationResult {
  if (contributions.length === 0) {
    return { totalBaseQty: 0, baseUnit: '', unreconciled: [] };
  }

  // Filter to contributions that have a quantity
  const withQty = contributions.filter((c) => c.qty != null && c.unit != null);
  const withoutQty = contributions.filter((c) => c.qty == null || c.unit == null);

  if (withQty.length === 0) {
    // No quantified contributions — just return 0 with no unit
    return { totalBaseQty: 0, baseUnit: '', unreconciled: withoutQty };
  }

  // Normalise all contributions
  const normalised = withQty.map((c) => ({
    contribution: c,
    ...normaliseToBase(c.qty!, c.unit!),
  }));

  // Group by baseUnit — find the most common base unit (dominant group)
  const groups: Record<string, typeof normalised> = {};
  for (const n of normalised) {
    if (!groups[n.baseUnit]) groups[n.baseUnit] = [];
    groups[n.baseUnit].push(n);
  }

  // Check if weight and volume groups can't mix — they stay separate
  // Pick the group with the most contributions as dominant
  const sortedGroups = Object.entries(groups).sort(
    ([, a], [, b]) => b.length - a.length
  );
  const [dominantUnit, dominantGroup] = sortedGroups[0];

  // Anything not in the dominant group is unreconciled
  const unreconciled: ShoppingListContribution[] = [
    ...withoutQty,
    ...sortedGroups
      .slice(1)
      .flatMap(([, group]) => group.map((n) => n.contribution)),
  ];

  // Sum the dominant group
  const totalBaseQty = dominantGroup.reduce((sum, n) => sum + n.qty, 0);

  return {
    totalBaseQty: Math.round(totalBaseQty * 100) / 100, // round to 2dp
    baseUnit: dominantUnit,
    unreconciled,
  };
}

/**
 * Check whether a set of contributions has any irreconcilable unit mismatches.
 */
export function hasUnitMismatch(contributions: ShoppingListContribution[]): boolean {
  const result = sumContributions(contributions);
  return result.unreconciled.length > 0;
}
