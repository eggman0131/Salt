/**
 * Canon Items — Pure logic layer
 *
 * Zod schema and deterministic helper functions for canonical items.
 * No I/O, no side effects, fully testable.
 */

import { z } from 'zod';

/** Zod schema for a canon item document */
export const CanonItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aisleId: z.string().min(1),
  preferredUnitId: z.string().min(1),
  needsReview: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type CanonItem = z.infer<typeof CanonItemSchema>;

/** Result of an item lookup */
export type ItemLookupResult =
  | { found: true; item: CanonItem }
  | { found: false };

/**
 * Normalize an item name: trim whitespace and collapse internal spaces.
 */
export function normalizeItemName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Sort items alphabetically by name (case-insensitive).
 */
export function sortItems(items: CanonItem[]): CanonItem[] {
  return [...items].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );
}

/**
 * Find an item by its exact ID.
 * Returns a typed lookup result rather than undefined.
 */
export function findItemById(items: CanonItem[], id: string): ItemLookupResult {
  const item = items.find(i => i.id === id);
  return item ? { found: true, item } : { found: false };
}

/**
 * Find an item by name (case-insensitive, normalized).
 * Returns the first match.
 */
export function findItemByName(items: CanonItem[], name: string): ItemLookupResult {
  const needle = normalizeItemName(name).toLowerCase();
  const item = items.find(i => normalizeItemName(i.name).toLowerCase() === needle);
  return item ? { found: true, item } : { found: false };
}

/**
 * Filter items that need review (needsReview = true).
 */
export function filterItemsNeedingReview(items: CanonItem[]): CanonItem[] {
  return items.filter(item => item.needsReview);
}

/**
 * Filter items by aisle ID.
 */
export function filterItemsByAisle(items: CanonItem[], aisleId: string): CanonItem[] {
  return items.filter(item => item.aisleId === aisleId);
}

/**
 * Validate a raw item document against the module schema.
 * Returns a Zod SafeParseReturnType so callers can handle errors.
 */
export function validateItemDoc(doc: unknown) {
  return CanonItemSchema.safeParse(doc);
}
