/**
 * Canon Aisles — Pure logic layer
 *
 * Zod schema (mirrors AisleSchema from contract, owned by this module) and
 * deterministic helper functions. No I/O, no side effects, fully testable.
 */

import { z } from 'zod';
import { Aisle } from '../../../types/contract';
import { AisleLookupResult } from '../types';

/** Zod schema for a canon aisle document */
export const CanonAisleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().default(999),
  createdAt: z.string().optional(),
});

export type CanonAisle = z.infer<typeof CanonAisleSchema>;

/** The well-known ID of the system fallback aisle */
export const UNCATEGORISED_AISLE_ID = 'uncategorised' as const;

/**
 * Sort aisles by sortOrder ascending.
 * Ties are broken alphabetically by name.
 */
export function sortAisles(aisles: Aisle[]): Aisle[] {
  return [...aisles].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Find an aisle by its exact ID.
 * Returns a typed lookup result rather than undefined.
 */
export function findAisleById(aisles: Aisle[], id: string): AisleLookupResult {
  const aisle = aisles.find(a => a.id === id);
  return aisle ? { found: true, aisle } : { found: false };
}

/**
 * Find an aisle by name (case-insensitive, whitespace-trimmed).
 * Returns the first match.
 */
export function findAisleByName(aisles: Aisle[], name: string): AisleLookupResult {
  const needle = name.toLowerCase().trim();
  const aisle = aisles.find(a => a.name.toLowerCase().trim() === needle);
  return aisle ? { found: true, aisle } : { found: false };
}

/**
 * Check whether the `uncategorised` system aisle is present in the list.
 */
export function hasUncategorisedAisle(aisles: Aisle[]): boolean {
  return aisles.some(a => a.id === UNCATEGORISED_AISLE_ID);
}

/**
 * Validate a raw aisle document against the module schema.
 * Returns a Zod SafeParseReturnType so callers can handle errors.
 */
export function validateAisleDoc(doc: unknown) {
  return CanonAisleSchema.safeParse(doc);
}
