/**
 * Canon Module Public API
 *
 * Exposes read helpers (backed by Firestore) and CRUD for canon items.
 * Re-exports all pure deterministic helpers from the logic layer.
 *
 * Rule: UI imports ONLY from this file.
 */

import { Aisle, Unit } from '../../types/contract';
import {
  fetchCanonAisles,
  fetchCanonUnits,
  fetchCanonItems,
  fetchCanonItemById,
  createCanonItem,
  updateCanonItem,
  approveCanonItem,
  seedAisles,
  seedUnits,
} from './data/firebase-provider';
import { CanonItem } from './logic/items';

// ── Persistence-backed read helpers ──────────────────────────────────────────

/**
 * List all canon aisles, ordered by sortOrder.
 */
export async function getCanonAisles(): Promise<Aisle[]> {
  return fetchCanonAisles();
}

/**
 * List all canon units, ordered by sortOrder.
 */
export async function getCanonUnits(): Promise<Unit[]> {
  return fetchCanonUnits();
}

/**
 * List all canon items (unsorted — use sortItems for ordering).
 */
export async function getCanonItems(): Promise<CanonItem[]> {
  return fetchCanonItems();
}

/**
 * Get a single canon item by ID.
 */
export async function getCanonItemById(id: string): Promise<CanonItem | null> {
  return fetchCanonItemById(id);
}

/**
 * Create a new canon item.
 */
export async function addCanonItem(input: {
  name: string;
  aisleId: string;
  preferredUnitId: string;
  needsReview?: boolean;
}): Promise<CanonItem> {
  return createCanonItem(input);
}

/**
 * Update an existing canon item.
 */
export async function editCanonItem(
  id: string,
  updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId' | 'needsReview'>>
): Promise<void> {
  return updateCanonItem(id, updates);
}

/**
 * Approve a canon item (set needsReview = false).
 */
export async function approveItem(id: string): Promise<void> {
  return approveCanonItem(id);
}

// ── Pure logic helpers (re-exported for convenience) ─────────────────────────

export {
  sortAisles,
  findAisleById,
  findAisleByName,
  hasUncategorisedAisle,
  validateAisleDoc,
  UNCATEGORISED_AISLE_ID,
} from './logic/aisles';

export {
  sortUnits,
  findUnitById,
  groupUnitsByCategory,
  validateUnitDoc,
} from './logic/units';

export {
  sortItems,
  findItemById,
  findItemByName,
  normalizeItemName,
  filterItemsNeedingReview,
  filterItemsByAisle,
  validateItemDoc,
} from './logic/items';

// ── CofID Logic (mapping resolver) ────────────────────────────────────────────

export {
  normaliseAisleName,
  resolveGroupToAisle,
  validateEmbedding,
  resolveCofidItemsToAisles,
  generateCofidImportReport,
} from './logic/cofid-mapping';

export type {
  CofidAisleEntry,
  CofidMapping,
  AisleInfo,
  MappingResult,
} from './logic/cofid-mapping';

// ── CofID Data (for admin tools) ──────────────────────────────────────────────

/**
 * Fetch all CofID items (for diagnostics and reporting).
 */
export async function getCanonCofidItems() {
  const { fetchCanonCofidItems } = await import('./data/firebase-provider');
  return fetchCanonCofidItems();
}

// ── Seed Operations (admin-only) ──────────────────────────────────────────────

export {
  validateAisleSeed,
  validateUnitSeed,
  validateAisleSeeds,
  validateUnitSeeds,
  prepareAisleForFirestore,
  prepareUnitForFirestore,
} from './logic/seed';

export type { RawAisleSeed, RawUnitSeed, SeedResult, SeedItemResult } from './logic/seed';

/**
 * Batch seed aisles into canonAisles collection.
 * Idempotent — uses setDoc with aisle.id as document ID.
 */
export async function seedCanonAisles(aisles: Aisle[]): Promise<void> {
  return seedAisles(aisles);
}

/**
 * Batch seed units into canonUnits collection.
 * Idempotent — uses setDoc with unit.id as document ID.
 */
export async function seedCanonUnits(units: Unit[]): Promise<void> {
  return seedUnits(units);
}

// ── PR4-A: AI Parse (pure logic) ─────────────────────────────────────────────

export { validateAiParseResults } from './logic/validateAiParse';

export { buildParseSchemaDescription, AiSingleParseResultSchema, AiParseResponseSchema } from './logic/aiParseSchemas';

export type {
  AisleRef,
  UnitRef,
  AiSingleParseResult,
  AiParseResponse,
  ReviewFlag,
  ValidatedParseResult,
  BatchParseResponse,
} from './types';

export { UNCATEGORISED_AISLE } from './types';

// ── PR4-A: AI Parse (I/O) ────────────────────────────────────────────────────

export { callAiParseIngredients } from './data/aiParseIngredients';

// ── Type re-exports ───────────────────────────────────────────────────────────

export type { CanonAisle } from './logic/aisles';
export type { CanonUnit } from './logic/units';
export type { CanonItem, ItemLookupResult } from './logic/items';
export type { AisleLookupResult, UnitLookupResult, UnitsByCategory } from './types';
