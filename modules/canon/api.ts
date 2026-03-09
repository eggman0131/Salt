/**
 * Canon Module Public API
 *
 * Exposes read helpers (backed by Firestore) and CRUD for canon items.
 * Re-exports all pure deterministic helpers from the logic layer.
 *
 * Rule: UI imports ONLY from this file.
 */

import { Aisle, Unit } from '../../types/contract';
import { CanonMatchEvent } from './types';
import {
  fetchCanonAisles,
  fetchCanonUnits,
  fetchCanonItems,
  fetchCanonItemById,
  createCanonItem,
  updateCanonItem,
  approveCanonItem,
  deleteCanonItem,
  deleteAllCanonItems,
  seedAisles,
  seedUnits,
  fetchCofidItemById,
  linkCofidMatchToCanonItem,
  unlinkCofidMatchFromCanonItem,
  suggestCofidForCanonItem,
  createCanonAisle,
  updateCanonAisle,
  deleteCanonAisle,
  reorderCanonAisles,
  createCanonUnit,
  updateCanonUnit,
  deleteCanonUnit,
  reorderCanonUnits,
} from './data/firebase-provider';
import {
  fetchMatchEvents,
  getMatchPerformanceStats,
} from './data/match-events-provider';
import {
  getCanonItemMergeImpact,
  getAisleMergeImpact,
  mergeCanonItems,
  mergeCanonAisles,
  type CanonItemMergeImpact,
  type AisleMergeImpact,
  type CanonItemMergeUpdates,
  type AisleMergeUpdates,
} from './data/merge-provider';
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

/**
 * Delete a single canon item.
 * Note: Orphaned recipe references are handled gracefully by the system.
 */
export async function deleteItem(id: string): Promise<void> {
  return deleteCanonItem(id);
}

/**
 * Delete all canon items.
 * Warning: This is a destructive operation.
 */
export async function deleteAllItems(): Promise<void> {
  return deleteAllCanonItems();
}

// ── Canon Aisles CRUD ─────────────────────────────────────────────────────────

/**
 * Create a new canon aisle.
 */
export async function addCanonAisle(input: {
  name: string;
  sortOrder?: number;
}): Promise<Aisle> {
  return createCanonAisle(input);
}

/**
 * Update an existing canon aisle.
 */
export async function editCanonAisle(
  id: string,
  updates: Partial<Pick<Aisle, 'name' | 'sortOrder'>>
): Promise<void> {
  return updateCanonAisle(id, updates);
}

/**
 * Delete a canon aisle.
 * Throws if aisle is in use by canon items.
 */
export async function removeCanonAisle(id: string): Promise<void> {
  return deleteCanonAisle(id);
}

/**
 * Reorder canon aisles (batch update sortOrder).
 */
export async function reorderAisles(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  return reorderCanonAisles(updates);
}

// ── Canon Units CRUD ──────────────────────────────────────────────────────────

/**
 * Create a new canon unit.
 */
export async function addCanonUnit(input: {
  name: string;
  plural?: string | null;
  category: 'weight' | 'volume' | 'count' | 'colloquial';
  sortOrder?: number;
}): Promise<Unit> {
  return createCanonUnit(input);
}

/**
 * Update an existing canon unit.
 */
export async function editCanonUnit(
  id: string,
  updates: Partial<Pick<Unit, 'name' | 'plural' | 'category' | 'sortOrder'>>
): Promise<void> {
  return updateCanonUnit(id, updates);
}

/**
 * Delete a canon unit.
 * Throws if unit is in use by canon items.
 */
export async function removeCanonUnit(id: string): Promise<void> {
  return deleteCanonUnit(id);
}

/**
 * Reorder canon units (batch update sortOrder).
 */
export async function reorderUnits(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  return reorderCanonUnits(updates);
}

// ── Merge operations ──────────────────────────────────────────────────────────

export { getCanonItemMergeImpact, getAisleMergeImpact, mergeCanonItems, mergeCanonAisles };
export type { CanonItemMergeImpact, AisleMergeImpact, CanonItemMergeUpdates, AisleMergeUpdates };

// ── Split operations ──────────────────────────────────────────────────────────

export {
  getCanonItemIngredientRefs,
  splitCanonItem,
  splitCanonAisle,
} from './data/split-provider';
export type { IngredientRef, CanonItemSplitDef, AisleSplitDef } from './data/split-provider';

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


// ── CofID Data (for admin tools) ──────────────────────────────────────────────

/**
 * Fetch all CofID items (for diagnostics and reporting).
 */
export async function getCanonCofidItems() {
  const { fetchCanonCofidItems } = await import('./data/firebase-provider');
  return fetchCanonCofidItems();
}

// ── PR5: CofID Integration ───────────────────────────────────────────────────

/**
 * Suggest CofID matches for a canon item.
 * Returns best match + top 5 candidates.
 */
export async function suggestCofidMatch(canonItemId: string) {
  return suggestCofidForCanonItem(canonItemId);
}

/**
 * Link a CofID match to a canon item.
 * Stores the link in externalSources with source-specific metadata.
 */
export async function linkCofidMatch(
  canonItemId: string,
  cofidId: string,
  matchMetadata: any
): Promise<void> {
  return linkCofidMatchToCanonItem(canonItemId, cofidId, matchMetadata);
}

/**
 * Unlink CofID match from a canon item.
 * Removes the cofid external source entry.
 */
export async function unlinkCofidMatch(canonItemId: string): Promise<void> {
  return unlinkCofidMatchFromCanonItem(canonItemId);
}

/**
 * Get a single CofID item by ID (for displaying linked item details).
 */
export async function getCofidItemById(id: string) {
  return fetchCofidItemById(id);
}

// ── PR5: CofID Match Logic (pure helpers) ────────────────────────────────────

export {
  suggestBestMatch,
  rankCandidates,
  buildCofidMatch,
  normaliseForMatching,
  levenshteinSimilarity,
} from './logic/suggestCofidMatch';

export type { SuggestedMatch } from './logic/suggestCofidMatch';

// ── PR6: Embedding Lookup Table (semantic matching) ──────────────────────────

/**
 * Fetch embeddings from the lookup table.
 * Optionally filter by aisle ID.
 * Automatically syncs local cache from Firebase Storage master snapshot when newer.
 */
export async function getEmbeddingsFromLookup(aisleId?: string) {
  const { fetchEmbeddingsFromLookup } = await import('./data/embeddings-provider');
  return fetchEmbeddingsFromLookup(aisleId);
}

/**
 * Generate embeddings for canon items (generic only).
 * Calls embedBatch Cloud Function and stores in the local lookup index.
 * 
 * @returns Generation summary with counts
 */
export async function generateCanonItemEmbeddings() {
  const { generateCanonItemEmbeddings: generateFn } = await import('./data/embeddings-provider');
  return generateFn();
}

// ── PR6: Semantic Matching Logic (pure helpers) ──────────────────────────────

export {
  cosineSimilarity,
  findSemanticMatches,
  getBestSemanticMatch,
  calculateCoverageStats,
  groupCoverageByAisle,
  validateEmbedding as validateEmbeddingDimension,
} from './logic/embeddings';

export type { SemanticMatch } from './logic/embeddings';

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

/**
 * Batch seed CofID items into canonCofidItems collection.
 * Idempotent — uses setDoc with item.id as document ID.
 */
export async function seedCofidItems(
  items: any[],
  onProgress?: (processed: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ imported: number; failed: number; errors: Array<{ id: string; reason: string }> }> {
  const { seedCofidItems: seedFn } = await import('./data/firebase-provider');
  return seedFn(items, onProgress, signal);
}

/**
 * Seed CofID embeddings directly from backup file data.
 */
export async function seedCofidEmbeddings(rawItems: any[]) {
  const { seedCofidEmbeddings: seedFn } = await import('./data/embeddings-provider');
  return seedFn(rawItems);
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

// ── PR8: Recipe Ingredient Matching (I/O + Logic) ────────────────────────────

export {
  processRawRecipeIngredients,
  matchAndLinkRecipeIngredient,
  matchAndLinkRecipeIngredients,
} from './data/matchRecipeIngredients';

export {
  matchIngredientToCanonItem,
  type IngredientMatchResult,
  type MatchCandidate,
} from './logic/matchIngredient';

// ── Match Events & Performance Monitoring ─────────────────────────────────────

/**
 * Fetch match events with optional filters.
 * Used by the admin UI for performance analysis.
 */
export async function getMatchEvents(options: {
  entityId?: string;
  batchId?: string;
  eventType?: CanonMatchEvent['eventType'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
} = {}): Promise<CanonMatchEvent[]> {
  return fetchMatchEvents(options);
}

/**
 * Get performance statistics for a given time period.
 * Returns aggregated metrics for dashboard display.
 */
export async function getPerformanceStats(
  startDate: Date,
  endDate: Date
): Promise<{
  totalEvents: number;
  eventsByType: Record<CanonMatchEvent['eventType'], number>;
  avgDurationByType: Record<CanonMatchEvent['eventType'], number>;
  successRate: number;
  totalDuration: number;
}> {
  return getMatchPerformanceStats(startDate, endDate);
}

// ── Type re-exports ───────────────────────────────────────────────────────────

export type { CanonAisle } from './logic/aisles';
export type { CanonUnit } from './logic/units';
export type { CanonItem, ItemLookupResult } from './logic/items';
export type { AisleLookupResult, UnitLookupResult, UnitsByCategory } from './types';
