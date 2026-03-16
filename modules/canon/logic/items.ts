/**
 * Canon Items — Pure logic layer
 *
 * Re-exports the canonical item schema from types/contract.ts (single source of truth)
 * and provides deterministic helper functions for item operations.
 * No I/O, no side effects, fully testable.
 *
 * Architecture note:
 *   canonUnits collection = parse vocabulary (controlled unit names for AI prompts)
 *   CanonItem.unit         = conversion intelligence (per-ingredient density, weights, volumes)
 */

import { z } from 'zod';
import {
  CanonicalItemSchema,
  ExternalSourceLinkSchema,
} from '../../../types/contract';

// Re-export the canonical schema — module schema is now the contract schema.
// This eliminates the historical divergence between contract.ts and items.ts.
export const CanonItemSchema = CanonicalItemSchema;
export type CanonItem = z.infer<typeof CanonItemSchema>;

export { ExternalSourceLinkSchema };
export type ExternalSourceLink = z.infer<typeof ExternalSourceLinkSchema>;

/** Result of an item lookup */
export type ItemLookupResult =
  | { found: true; item: CanonItem }
  | { found: false };

/**
 * Normalize an item name: trim whitespace and collapse internal spaces.
 */
export function normalizeItemName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Sort items alphabetically by name (case-insensitive).
 */
export function sortItems(items: CanonItem[]): CanonItem[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name)
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
  const needle = normalizeItemName(name);
  const item = items.find(i => normalizeItemName(i.name) === needle);
  return item ? { found: true, item } : { found: false };
}

/**
 * Filter items that have not yet been approved (approved = false).
 * These are auto-created items that require human review.
 */
export function filterUnapprovedItems(items: CanonItem[]): CanonItem[] {
  return items.filter(item => !item.approved);
}

/**
 * Filter items by aisle ID (FK reference, not snapshot).
 */
export function filterItemsByAisle(items: CanonItem[], aisleId: string): CanonItem[] {
  return items.filter(item => item.aisleId === aisleId);
}

/**
 * Validate a raw item document against the canon item schema.
 * Returns a Zod SafeParseReturnType so callers can handle errors.
 */
export function validateItemDoc(doc: unknown) {
  return CanonItemSchema.safeParse(doc);
}
