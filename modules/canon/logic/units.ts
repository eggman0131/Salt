/**
 * Canon Units — Pure logic layer
 *
 * Zod schema (mirrors UnitSchema from contract, owned by this module) and
 * deterministic helper functions. No I/O, no side effects, fully testable.
 */

import { z } from 'zod';
import { Unit } from '../../../types/contract';
import { UnitsByCategory, UnitLookupResult } from '../types';

/** Zod schema for a canon unit document */
export const CanonUnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  plural: z.string().nullable().default(null),
  category: z.enum(['weight', 'volume', 'count', 'colloquial']),
  sortOrder: z.number().default(999),
  createdAt: z.string().optional(),
});

export type CanonUnit = z.infer<typeof CanonUnitSchema>;

/**
 * Sort units by sortOrder ascending.
 * Ties are broken alphabetically by name.
 */
export function sortUnits(units: Unit[]): Unit[] {
  return [...units].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Find a unit by its exact ID.
 * Returns a typed lookup result rather than undefined.
 */
export function findUnitById(units: Unit[], id: string): UnitLookupResult {
  const unit = units.find(u => u.id === id);
  return unit ? { found: true, unit } : { found: false };
}

/**
 * Group units by their category.
 * Each category array is sorted by sortOrder.
 */
export function groupUnitsByCategory(units: Unit[]): UnitsByCategory {
  const groups: UnitsByCategory = {
    weight: [],
    volume: [],
    count: [],
    colloquial: [],
  };

  for (const unit of units) {
    if (unit.category in groups) {
      groups[unit.category].push(unit);
    }
  }

  for (const key of Object.keys(groups) as (keyof UnitsByCategory)[]) {
    groups[key] = sortUnits(groups[key]);
  }

  return groups;
}

/**
 * Validate a raw unit document against the module schema.
 * Returns a Zod SafeParseReturnType so callers can handle errors.
 */
export function validateUnitDoc(doc: unknown) {
  return CanonUnitSchema.safeParse(doc);
}
