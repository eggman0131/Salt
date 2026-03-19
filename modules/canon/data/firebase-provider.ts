/**
 * Canon Firestore provider
 *
 * Read helpers for `canonAisles`, `canonUnits`, and CRUD for `canonItems`.
 * Called from api.ts only — never imported directly from UI or logic.
 */

import { Aisle, Unit, CanonicalItemSchema, AisleSnapshotSchema, UnitIntelligenceSchema, ShoppingIntelligenceSchema } from '../../../types/contract';
import type { AisleSnapshot, UnitIntelligence, ShoppingIntelligence } from '../../../types/contract';
import { CofIDItem } from '../types';
import { db } from '../../../shared/backend/firebase';
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  Timestamp,
  setDoc,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { CanonItem, ExternalSourceLink } from '../logic/items';
import { suggestBestMatch, rankCandidates, tryExactMatch, tryFuzzyMatch, buildCofidMatch, type SuggestedMatch } from '../logic/suggestCofidMatch';
import { findSemanticMatches } from '../logic/embeddings';
import {
  fetchEmbeddingsFromLookup,
  generateTextEmbedding,
  upsertCanonItemEmbedding,
  upsertCanonItemEmbeddingById,
  deleteEmbeddings,
  clearCanonEmbeddings,
} from './embeddings-provider';
import {
  logMatchEvent,
  startTimer,
} from './match-events-provider';
import {
  loadFdcData,
  searchFdcLocal,
  mapFdcPortionsToUnitPatch,
  type FdcSearchResult,
} from './fdc-provider';

const CANON_AISLES_COLLECTION = 'canonAisles';
const CANON_UNITS_COLLECTION = 'canonUnits';
const CANON_ITEMS_COLLECTION = 'canonItems';
const CANON_COFID_ITEMS_COLLECTION = 'canonCofidItems';

function getCofidSourceFromExternalSources(
  externalSources?: ExternalSourceLink[]
): ExternalSourceLink | undefined {
  return externalSources?.find(source => source.source === 'cofid');
}

function withCofidSource(
  existingSources: ExternalSourceLink[] | undefined,
  cofidId: string,
  propertiesPatch?: Record<string, unknown>
): ExternalSourceLink[] {
  const now = new Date().toISOString();
  const current = existingSources ?? [];
  const existing = current.find(source => source.source === 'cofid');
  const mergedProperties = {
    ...(existing?.properties ?? {}),
    ...(propertiesPatch ?? {}),
  };

  const cofidSource: ExternalSourceLink = {
    source: 'cofid',
    externalId: cofidId,
    ...(existing?.confidence !== undefined && { confidence: existing.confidence }),
    ...(Object.keys(mergedProperties).length > 0 && { properties: mergedProperties }),
    syncedAt: now,
  };

  const withoutCofid = current.filter(source => source.source !== 'cofid');
  return [...withoutCofid, cofidSource];
}

function withoutCofidSource(existingSources: ExternalSourceLink[] | undefined): ExternalSourceLink[] {
  return (existingSources ?? []).filter(source => source.source !== 'cofid');
}

/**
 * Resolve aisle snapshot from the canonAisles collection.
 * Returns tier1/tier2/tier3 values for embedding in a canon item.
 * Falls back to 'Uncategorised' if the aisle doc is not found.
 */
async function resolveAisleSnapshot(aisleId: string): Promise<AisleSnapshot> {
  if (!aisleId || aisleId === 'uncategorised') {
    return { tier1: 'Uncategorised', tier2: 'Uncategorised', tier3: 'Uncategorised' };
  }
  const aisleDoc = await getDoc(doc(db, CANON_AISLES_COLLECTION, aisleId));
  if (!aisleDoc.exists()) {
    return { tier1: 'Uncategorised', tier2: 'Uncategorised', tier3: 'Uncategorised' };
  }
  const data = aisleDoc.data();
  return {
    tier1: data.name ?? 'Uncategorised',
    tier2: data.tier2 ?? '',
    tier3: data.tier3 ?? '',
  };
}

/**
 * Propagate an aisle rename to all items that reference the given aisleId.
 * Called after updateCanonAisle and mergeCanonAisles to keep snapshots consistent.
 * Returns the number of items updated.
 */
export async function syncAisleSnapshots(
  aisleId: string,
  newSnapshot: AisleSnapshot
): Promise<number> {
  const snapshot = await getDocs(collection(db, CANON_ITEMS_COLLECTION));
  const BATCH_LIMIT = 450;
  let count = 0;

  const affected = snapshot.docs.filter(d => d.data().aisleId === aisleId);
  for (let i = 0; i < affected.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = affected.slice(i, i + BATCH_LIMIT);
    chunk.forEach(d => batch.update(d.ref, { aisle: newSnapshot }));
    await batch.commit();
    count += chunk.length;
  }

  return count;
}

function normaliseEmbeddingName(value: string): string {
  return value.trim().toLowerCase();
}

function resolveQueryEmbeddingFromLookup(
  itemName: string,
  itemId: string,
  lookupEntries: Array<{
    kind: 'canon' | 'cofid';
    refId: string;
    name: string;
    embedding: number[];
  }>
): number[] | null {
  const target = normaliseEmbeddingName(itemName);
  if (!target) return null;

  const byId = lookupEntries.find(
    entry =>
      entry.kind === 'canon' &&
      entry.refId === itemId &&
      normaliseEmbeddingName(entry.name) === target &&
      Array.isArray(entry.embedding) &&
      entry.embedding.length > 0
  );

  if (byId) {
    return byId.embedding;
  }

  const byName = lookupEntries.find(
    entry =>
      normaliseEmbeddingName(entry.name) === target &&
      Array.isArray(entry.embedding) &&
      entry.embedding.length > 0
  );

  return byName?.embedding ?? null;
}

/**
 * Fetch all canon aisles ordered by sortOrder.
 */
export async function fetchCanonAisles(): Promise<Aisle[]> {
  const q = query(
    collection(db, CANON_AISLES_COLLECTION),
    orderBy('sortOrder', 'asc'),
  );
  const snapshot = await getDocs(q);
  const aisles: Aisle[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    aisles.push({
      id: docSnap.id,
      name: data.name,
      tier2: data.tier2 ?? '',
      tier3: data.tier3 ?? '',
      sortOrder: data.sortOrder ?? 999,
      createdAt: data.createdAt ?? new Date().toISOString(),
    });
  });

  return aisles;
}

/**
 * Fetch all canon units ordered by sortOrder.
 */
export async function fetchCanonUnits(): Promise<Unit[]> {
  const q = query(
    collection(db, CANON_UNITS_COLLECTION),
    orderBy('sortOrder', 'asc'),
  );
  const snapshot = await getDocs(q);
  const units: Unit[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    units.push({
      id: docSnap.id,
      name: data.name,
      plural: data.plural ?? null,
      category: data.category,
      sortOrder: data.sortOrder ?? 999,
      createdAt: data.createdAt,
    });
  });

  return units;
}

// ── Canon Units CRUD ──────────────────────────────────────────────────────────

/**
 * Create a new canon unit.
 */
export async function createCanonUnit(input: {
  name: string;
  plural?: string | null;
  category: 'weight' | 'volume' | 'count' | 'colloquial';
  sortOrder?: number;
}): Promise<Unit> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, CANON_UNITS_COLLECTION), {
    name: input.name,
    plural: input.plural ?? null,
    category: input.category,
    sortOrder: input.sortOrder ?? 999,
    createdAt: now,
  });

  return {
    id: docRef.id,
    name: input.name,
    plural: input.plural ?? null,
    category: input.category,
    sortOrder: input.sortOrder ?? 999,
    createdAt: now,
  };
}

/**
 * Update an existing canon unit.
 */
export async function updateCanonUnit(
  id: string,
  updates: Partial<Pick<Unit, 'name' | 'plural' | 'category' | 'sortOrder'>>
): Promise<void> {
  const docRef = doc(db, CANON_UNITS_COLLECTION, id);
  await updateDoc(docRef, updates);
}

/**
 * Delete a canon unit.
 * Units are now embedded in each item (no FK reference), so deletion is always safe.
 */
export async function deleteCanonUnit(id: string): Promise<void> {
  const docRef = doc(db, CANON_UNITS_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Batch update sortOrder for multiple units.
 * Used for drag-and-drop reordering within categories.
 */
export async function reorderCanonUnits(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  const batch = writeBatch(db);
  
  updates.forEach(({ id, sortOrder }) => {
    const docRef = doc(db, CANON_UNITS_COLLECTION, id);
    batch.update(docRef, { sortOrder });
  });
  
  await batch.commit();
}

// ── Canon Aisles CRUD ─────────────────────────────────────────────────────────

/**
 * Create a new canon aisle.
 */
export async function createCanonAisle(input: {
  name: string;
  tier2: string;
  tier3: string;
  sortOrder?: number;
}): Promise<Aisle> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, CANON_AISLES_COLLECTION), {
    name: input.name,
    tier2: input.tier2,
    tier3: input.tier3,
    sortOrder: input.sortOrder ?? 999,
    createdAt: now,
  });

  return {
    id: docRef.id,
    name: input.name,
    tier2: input.tier2,
    tier3: input.tier3,
    sortOrder: input.sortOrder ?? 999,
    createdAt: now,
  };
}

/**
 * Update an existing canon aisle.
 * Propagates any tier changes to the embedded snapshots on all referencing items.
 */
export async function updateCanonAisle(
  id: string,
  updates: Partial<Pick<Aisle, 'name' | 'tier2' | 'tier3' | 'sortOrder'>>
): Promise<void> {
  const docRef = doc(db, CANON_AISLES_COLLECTION, id);
  await updateDoc(docRef, updates);

  // Propagate snapshot if any display fields changed
  if (updates.name !== undefined || updates.tier2 !== undefined || updates.tier3 !== undefined) {
    const newSnapshot = await resolveAisleSnapshot(id);
    await syncAisleSnapshots(id, newSnapshot);
  }
}

/**
 * Delete a canon aisle.
 * Caller must enforce business rules (e.g., cannot delete 'uncategorised').
 */
export async function deleteCanonAisle(id: string): Promise<void> {
  const docRef = doc(db, CANON_AISLES_COLLECTION, id);
  
  // Check if any canon items reference this aisle
  const itemsSnapshot = await getDocs(collection(db, CANON_ITEMS_COLLECTION));
  const hasReferences = itemsSnapshot.docs.some(doc => doc.data().aisleId === id);
  
  if (hasReferences) {
    throw new Error(`Cannot delete aisle: ${id} is in use by canon items`);
  }
  
  await deleteDoc(docRef);
}

/**
 * Batch update sortOrder for multiple aisles.
 * Used for drag-and-drop reordering.
 */
export async function reorderCanonAisles(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  const batch = writeBatch(db);
  
  updates.forEach(({ id, sortOrder }) => {
    const docRef = doc(db, CANON_AISLES_COLLECTION, id);
    batch.update(docRef, { sortOrder });
  });
  
  await batch.commit();
}

// ── Canon Items CRUD ──────────────────────────────────────────────────────────

/**
 * Fetch all canon items.
 * Items are returned unsorted (use sortItems from logic layer).
 */
export async function fetchCanonItems(): Promise<CanonItem[]> {
  const snapshot = await getDocs(collection(db, CANON_ITEMS_COLLECTION));
  const items: CanonItem[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    items.push(deserializeCanonItem(docSnap.id, data));
  });

  return items;
}

/**
 * Deserialize a Firestore doc into a typed CanonItem (v3 schema).
 * Applies safe defaults so stale/partial docs don't cause runtime errors.
 */
function deserializeCanonItem(id: string, data: Record<string, any>): CanonItem {
  return {
    id,
    name: data.name ?? '',
    normalisedName: data.normalisedName ?? String(data.name ?? '').toLowerCase(),
    synonyms: Array.isArray(data.synonyms) ? data.synonyms : [],
    aisleId: data.aisleId ?? 'uncategorised',
    aisle: data.aisle ?? { tier1: 'Uncategorised', tier2: 'Uncategorised', tier3: 'Uncategorised' },
    unit: data.unit ?? { canonical_unit_type: 'mass', canonical_unit: 'g', density_g_per_ml: null },
    shopping: data.shopping,
    isStaple: data.isStaple ?? false,
    itemType: data.itemType ?? 'ingredient',
    allergens: Array.isArray(data.allergens) ? data.allergens : [],
    barcodes: Array.isArray(data.barcodes) ? data.barcodes : [],
    externalSources: Array.isArray(data.externalSources) ? data.externalSources : [],
    metadata: data.metadata,
    embedding: data.embedding,
    embeddingModel: data.embeddingModel,
    embeddedAt: data.embeddedAt,
    createdAt: data.createdAt ?? new Date().toISOString(),
    createdBy: data.createdBy,
    approved: data.approved ?? !(data.needsReview ?? false), // migrate: needsReview=true → approved=false
    lastSyncedAt: data.lastSyncedAt,
    matchingAudit: data.matchingAudit,
  };
}

/**
 * Fetch a single canon item by ID.
 */
export async function fetchCanonItemById(id: string): Promise<CanonItem | null> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return deserializeCanonItem(docSnap.id, docSnap.data() as Record<string, any>);
}

/**
 * Create a new canon item (v3 schema).
 * Resolves the aisle snapshot from canonAisles so the item is self-contained.
 * Returns the newly created item with its Firestore-generated ID.
 */
export async function createCanonItem(input: {
  name: string;
  aisleId: string;
  unit?: Partial<UnitIntelligence>;
  shopping?: Partial<ShoppingIntelligence>;
  itemType?: 'ingredient' | 'product' | 'household';
  synonyms?: string[];
  allergens?: string[];
  isStaple?: boolean;
  approved?: boolean;
}): Promise<CanonItem> {
  const now = new Date().toISOString();
  const lowerName = input.name.toLowerCase().trim();

  const aisleSnapshot = await resolveAisleSnapshot(input.aisleId);

  const unitData: UnitIntelligence = {
    canonical_unit_type: input.unit?.canonical_unit_type ?? 'mass',
    canonical_unit: input.unit?.canonical_unit ?? 'g',
    density_g_per_ml: input.unit?.density_g_per_ml ?? null,
    ...(input.unit?.count_equivalents !== undefined ? { count_equivalents: input.unit.count_equivalents } : {}),
    ...(input.unit?.volume_equivalents !== undefined ? { volume_equivalents: input.unit.volume_equivalents } : {}),
  };

  const firestoreDoc = {
    name: lowerName,
    normalisedName: lowerName,
    synonyms: input.synonyms ?? [],
    aisleId: input.aisleId,
    aisle: aisleSnapshot,
    unit: unitData,
    ...(input.shopping ? { shopping: input.shopping } : {}),
    isStaple: input.isStaple ?? false,
    itemType: input.itemType ?? 'ingredient',
    allergens: input.allergens ?? [],
    barcodes: [],
    externalSources: [],
    approved: input.approved ?? false,
    createdAt: now,
  };

  const docRef = await addDoc(collection(db, CANON_ITEMS_COLLECTION), firestoreDoc);

  const createdItem: CanonItem = {
    id: docRef.id,
    ...firestoreDoc,
    shopping: input.shopping as ShoppingIntelligence | undefined,
  };

  // Keep canon embedding lookup fresh for semantic matching.
  try {
    await upsertCanonItemEmbedding({
      id: createdItem.id,
      name: createdItem.name,
      aisleId: createdItem.aisleId,
    });
  } catch (error) {
    console.warn('[createCanonItem] Failed to upsert embedding (non-blocking):', error);
  }

  return createdItem;
}

/**
 * Update an existing canon item (v3 schema).
 * If aisleId changes, re-resolves the aisle snapshot automatically.
 */
export async function updateCanonItem(
  id: string,
  updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'unit' | 'shopping' | 'isStaple' | 'itemType' | 'allergens' | 'synonyms' | 'approved' | 'barcodes' | 'metadata'>>
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (typeof updates.name === 'string') {
    payload.name = updates.name.toLowerCase().trim();
    payload.normalisedName = updates.name.toLowerCase().trim();
  }

  if (updates.aisleId !== undefined) {
    payload.aisleId = updates.aisleId;
    payload.aisle = await resolveAisleSnapshot(updates.aisleId);
  }

  if (updates.unit !== undefined) payload.unit = updates.unit;
  if (updates.shopping !== undefined) payload.shopping = updates.shopping;
  if (updates.isStaple !== undefined) payload.isStaple = updates.isStaple;
  if (updates.itemType !== undefined) payload.itemType = updates.itemType;
  if (updates.allergens !== undefined) payload.allergens = updates.allergens;
  if (updates.synonyms !== undefined) payload.synonyms = updates.synonyms;
  if (updates.approved !== undefined) payload.approved = updates.approved;
  if (updates.barcodes !== undefined) payload.barcodes = updates.barcodes;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;

  await updateDoc(docRef, payload);

  // Refresh embedding when the query text changes (rename).
  if (typeof updates.name === 'string') {
    try {
      await upsertCanonItemEmbeddingById(id);
    } catch (error) {
      console.warn('[updateCanonItem] Failed to refresh embedding after rename (non-blocking):', error);
    }
  }
}

/**
 * Approve a canon item (set needsReview = false).
 * If linked to CofID, copy nutrients into externalSources[].properties.nutrition.
 */
export async function approveCanonItem(id: string): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  
  // Get current item data to check for a linked CoFID source.
  const itemSnap = await getDoc(docRef);
  if (!itemSnap.exists()) {
    throw new Error(`Canon item ${id} not found`);
  }

  const itemData = itemSnap.data();
  const existingSources = Array.isArray(itemData.externalSources)
    ? (itemData.externalSources as ExternalSourceLink[])
    : undefined;
  const cofidSource = getCofidSourceFromExternalSources(existingSources);

  const updates: any = {
    approved: true,
    updatedAt: new Date().toISOString(),
  };

  // If linked to a CofID item, copy nutrients to source-specific properties.
  if (cofidSource?.externalId) {
    const cofidItem = await fetchCofidItemById(cofidSource.externalId);
    if (cofidItem?.nutrients) {
      updates.externalSources = withCofidSource(existingSources, cofidSource.externalId, {
        nutrition: cofidItem.nutrients,
        nutritionImportedAt: new Date().toISOString(),
      });
      updates.lastSyncedAt = new Date().toISOString();
    }
  }

  await updateDoc(docRef, updates);
}

/**
 * Delete a single canon item by ID.
 * Note: Does not check for recipe references - orphaned references handled gracefully.
 */
export async function deleteCanonItem(id: string): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  await deleteDoc(docRef);

  // Keep local embedding lookup in sync
  try {
    await deleteEmbeddings([id]);
  } catch (error) {
    console.warn('[deleteCanonItem] Failed to delete embedding (non-blocking):', error);
  }
}

/**
 * Batch-delete multiple canon items in a single Firestore writeBatch,
 * with a single embedding cleanup + publishLocalToMaster at the end.
 */
export async function batchDeleteCanonItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  // Firestore writeBatch limit is 500 — chunk if needed
  const BATCH_LIMIT = 450;
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, CANON_ITEMS_COLLECTION, id));
    }
    await batch.commit();
  }

  // Single embedding cleanup (one IndexedDB tx + one publishLocalToMaster)
  try {
    await deleteEmbeddings(ids);
  } catch (error) {
    console.warn('[batchDeleteCanonItems] Failed to delete embeddings (non-blocking):', error);
  }
}

/**
 * Delete all canon items.
 * Warning: This is a destructive operation that removes ALL items from the collection.
 */
export async function deleteAllCanonItems(): Promise<void> {
  const snapshot = await getDocs(collection(db, CANON_ITEMS_COLLECTION));
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);

  // Keep local embedding lookup in sync
  try {
    await clearCanonEmbeddings();
  } catch (error) {
    console.warn('[deleteAllCanonItems] Failed to clear embeddings (non-blocking):', error);
  }
}

// ── CofID Items Read ──────────────────────────────────────────────────────────

/**
 * Fetch all CofID items from canonCofidItems collection.
 * Used for diagnostics, matching, and linking.
 */
export async function fetchCanonCofidItems(): Promise<any[]> {
  const snapshot = await getDocs(collection(db, CANON_COFID_ITEMS_COLLECTION));
  const items: any[] = [];

  snapshot.forEach(docSnap => {
    items.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });

  return items;
}

/**
 * Get a single CofID item by ID.
 * Used when linking or copying nutrients.
 */
export async function fetchCofidItemById(id: string): Promise<any | null> {
  const docRef = doc(db, CANON_COFID_ITEMS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  };
}

/**
 * Link a CofID match to a canon item.
 * Stores linkage and metadata in the CoFID external source record.
 */
export async function linkCofidMatchToCanonItem(
  canonItemId: string,
  cofidId: string,
  matchMetadata: any
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, canonItemId);

  const itemSnap = await getDoc(docRef);
  const itemData = itemSnap.exists() ? itemSnap.data() : {};
  const existingSources = Array.isArray(itemData.externalSources)
    ? (itemData.externalSources as ExternalSourceLink[])
    : undefined;

  // Fetch nutrition data from the CoFID item and store it alongside the match metadata.
  const cofidItem = await fetchCofidItemById(cofidId);
  const nutritionProps = cofidItem?.nutrients
    ? { nutrition: cofidItem.nutrients, nutritionImportedAt: new Date().toISOString() }
    : {};

  await updateDoc(docRef, {
    externalSources: withCofidSource(existingSources, cofidId, {
      match: matchMetadata,
      ...nutritionProps,
    }),
    lastSyncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  // Log final selection event
  const canonItem = await getDoc(docRef);
  const canonData = canonItem.data();
  
  logMatchEvent({
    eventType: 'final-selection',
    entityType: 'canon-item',
    entityId: canonItemId,
    entityName: canonData?.name || 'unknown',
    aisleId: canonData?.aisleId,
    input: {},
    output: {
      topMatchId: cofidId,
      topScore: matchMetadata.score,
      method: matchMetadata.method,
    },
    metrics: {
      durationMs: 0, // Instant operation
    },
  });}

/**
 * Unlink CofID match from a canon item.
 * Removes the CoFID entry from externalSources.
 */
export async function unlinkCofidMatchFromCanonItem(
  canonItemId: string
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, canonItemId);

  const itemSnap = await getDoc(docRef);
  const itemData = itemSnap.exists() ? itemSnap.data() : {};
  const existingSources = Array.isArray(itemData.externalSources)
    ? (itemData.externalSources as ExternalSourceLink[])
    : undefined;

  await updateDoc(docRef, {
    externalSources: withoutCofidSource(existingSources),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Suggest a CofID match for a canon item.
 * 
 * Workflow:
 * 1. Fetch canon item
 * 2. Fetch all CofID items
 * 3. Build aisle mapping (CofID item ID → canon aisle ID)
 * 4. Call pure matching logic (suggestBestMatch)
 * 5. Get top N candidates (rankCandidates)
 * 6. Return best match + candidates or null
 * 
 * Returns object with:
 * - bestMatch: SuggestedMatch | null
 * - candidates: SuggestedMatch[] (top 5)
 */
export async function suggestCofidForCanonItem(
  canonItemId: string
): Promise<{ bestMatch: SuggestedMatch | null; candidates: SuggestedMatch[] }> {
  // 1. Fetch canon item
  const canonItem = await fetchCanonItemById(canonItemId);
  if (!canonItem) {
    return { bestMatch: null, candidates: [] };
  }

  // 2. Fetch all CofID items
  const cofidItems = await fetchCanonCofidItems() as CofIDItem[];

  // 3. Get lexical candidates — full pool
  const lexicalTimer = startTimer();
  let lexicalCandidates = rankCandidates(canonItem.name, cofidItems, 8);
  const lexicalDuration = lexicalTimer();

  // Log lexical matching event
  logMatchEvent({
    eventType: 'lexical-match',
    entityType: 'canon-item',
    entityId: canonItem.id,
    entityName: canonItem.name,
    aisleId: canonItem.aisleId,
    input: {
      queryText: canonItem.name,
      candidateCount: cofidItems.length,
      aisleFiltered: true,
    },
    output: {
      resultCount: lexicalCandidates.length,
      topScore: lexicalCandidates[0]?.score,
      topMatchId: lexicalCandidates[0]?.cofidId,
      topMatchName: lexicalCandidates[0]?.name,
      method: lexicalCandidates[0]?.method,
    },
    metrics: {
      durationMs: lexicalDuration,
    },
  });

  // 5. Semantic ranking — searches ALL CoFID embeddings (no aisle filter).
  //    Aisle-bounded search caused poor results because CoFID food groups are broad
  //    and don't align cleanly with shopping aisles. The embedding distance is a
  //    better signal than aisle membership here.
  let semanticCandidates: SuggestedMatch[] = [];
  try {
    // Load all embeddings — no aisle filter
    const allLookupEntries = await fetchEmbeddingsFromLookup();

    // Resolve query embedding from the global lookup or generate fresh
    const embeddingTimer = startTimer();
    const cachedQueryEmbedding = resolveQueryEmbeddingFromLookup(
      canonItem.name,
      canonItem.id,
      allLookupEntries as Array<{
        kind: 'canon' | 'cofid';
        refId: string;
        name: string;
        embedding: number[];
      }>
    );

    const embeddingReused = cachedQueryEmbedding !== null;
    const queryEmbedding = cachedQueryEmbedding ?? await generateTextEmbedding(canonItem.name);
    const embeddingDuration = embeddingTimer();

    logMatchEvent({
      eventType: 'embedding-generation',
      entityType: 'canon-item',
      entityId: canonItem.id,
      entityName: canonItem.name,
      aisleId: canonItem.aisleId,
      input: { queryText: canonItem.name, embeddingDim: queryEmbedding?.length },
      output: { embeddingGenerated: !embeddingReused, embeddingReused },
      metrics: { durationMs: embeddingDuration },
    });

    if (queryEmbedding) {
      const semanticTimer = startTimer();
      // No aisle filter — higher threshold (0.65) to compensate for broader pool
      const semanticMatches = findSemanticMatches(
        queryEmbedding,
        allLookupEntries,
        undefined,   // no aisle filter
        0.65,
        15
      ).filter(match => match.kind === 'cofid');

      semanticCandidates = semanticMatches.map(match => ({
        cofidId: match.refId,
        name: match.name,
        score: match.similarity,
        method: 'semantic' as const,
        reason: match.reason,
      }));
      const semanticDuration = semanticTimer();

      logMatchEvent({
        eventType: 'semantic-match',
        entityType: 'canon-item',
        entityId: canonItem.id,
        entityName: canonItem.name,
        aisleId: canonItem.aisleId,
        input: {
          embeddingDim: queryEmbedding.length,
          candidateCount: allLookupEntries.length,
          aisleFiltered: false,
        },
        output: {
          resultCount: semanticCandidates.length,
          topScore: semanticCandidates[0]?.score,
          topMatchId: semanticCandidates[0]?.cofidId,
          topMatchName: semanticCandidates[0]?.name,
          method: 'semantic',
        },
        metrics: { durationMs: semanticDuration },
        metadata: { threshold: 0.65 },
      });
    }
  } catch (error) {
    console.warn('[suggestCofidForCanonItem] Semantic ranking unavailable, falling back to lexical:', error);
  }

  // 6. Merge semantic + lexical candidates (dedupe by CofID ID, keep best score)
  const mergeTimer = startTimer();
  const mergedMap = new Map<string, SuggestedMatch>();

  for (const candidate of lexicalCandidates) {
    mergedMap.set(candidate.cofidId, candidate);
  }

  for (const candidate of semanticCandidates) {
    const existing = mergedMap.get(candidate.cofidId);
    if (!existing || candidate.score > existing.score) {
      mergedMap.set(candidate.cofidId, candidate);
    }
  }

  const candidates = Array.from(mergedMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const mergeDuration = mergeTimer();

  // Log candidate merging event
  logMatchEvent({
    eventType: 'candidate-merge',
    entityType: 'canon-item',
    entityId: canonItem.id,
    entityName: canonItem.name,
    aisleId: canonItem.aisleId,
    input: {
      candidateCount: lexicalCandidates.length + semanticCandidates.length,
    },
    output: {
      resultCount: candidates.length,
      topScore: candidates[0]?.score,
      topMatchId: candidates[0]?.cofidId,
      topMatchName: candidates[0]?.name,
      method: 'merged',
    },
    metrics: {
      durationMs: mergeDuration,
    },
    metadata: {
      pipelineVersion: 'v1.0.0',
    },
  });

  const bestMatch = candidates[0] ?? suggestBestMatch(canonItem.name, cofidItems);

  // Auto-link when the best match has high confidence (≥ 0.85)
  const AUTO_LINK_THRESHOLD = 0.85;
  if (bestMatch && bestMatch.score >= AUTO_LINK_THRESHOLD) {
    try {
      const matchMetadata = buildCofidMatch(bestMatch, 'auto');
      await linkCofidMatchToCanonItem(canonItemId, bestMatch.cofidId, matchMetadata);
    } catch (error) {
      console.warn('[suggestCofidForCanonItem] Auto-link failed (non-blocking):', error);
    }
  }

  return { bestMatch, candidates };
}

/**
 * Link an FDC match to a canon item.
 * Stores linkage, enriches unit intelligence from FDC portions data.
 */
export async function linkFdcMatchToCanonItem(
  canonItemId: string,
  fdcMatch: FdcSearchResult
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, canonItemId);

  const itemSnap = await getDoc(docRef);
  const itemData = itemSnap.exists() ? itemSnap.data() : {};
  const existingSources = Array.isArray(itemData.externalSources)
    ? (itemData.externalSources as ExternalSourceLink[])
    : undefined;

  // Map FDC portions to unit intelligence patch
  const unitPatch = mapFdcPortionsToUnitPatch(
    fdcMatch.portions,
    itemData.unit ?? { canonical_unit_type: 'mass', canonical_unit: 'g', density_g_per_ml: null }
  );

  console.log('[linkFdcMatchToCanonItem] Unit patch generated:', {
    portionCount: fdcMatch.portions.length,
    patchEntries: Object.keys(unitPatch).length,
    patch: unitPatch,
  });

  const now = new Date().toISOString();
  const fdcSource: ExternalSourceLink = {
    source: 'fdc',
    externalId: String(fdcMatch.fdcId),
    confidence: fdcMatch.score,
    properties: {
      description: fdcMatch.description,
      dataType: fdcMatch.dataType,
      portions: fdcMatch.portions,
    },
    syncedAt: now,
  };

  const updatedSources = [
    ...(existingSources ?? []).filter(source => source.source !== 'fdc'),
    fdcSource,
  ];

  const updatePayload: Record<string, any> = {
    externalSources: updatedSources,
    lastSyncedAt: now,
    updatedAt: now,
  };

  // Apply unit patch fields individually to Firestore path format
  for (const [path, value] of Object.entries(unitPatch)) {
    updatePayload[path] = value;
  }

  await updateDoc(docRef, updatePayload);

  logMatchEvent({
    eventType: 'final-selection',
    entityType: 'canon-item',
    entityId: canonItemId,
    entityName: itemData?.name || 'unknown',
    aisleId: itemData?.aisleId,
    input: {},
    output: {
      topMatchId: String(fdcMatch.fdcId),
      topScore: fdcMatch.score,
      method: 'fdc-matching',
    },
    metrics: {
      durationMs: 0,
    },
    metadata: {
      dataType: fdcMatch.dataType,
      description: fdcMatch.description,
    },
  });
}

/**
 * Unlink FDC match from a canon item.
 * Removes the FDC entry from externalSources.
 */
export async function unlinkFdcMatchFromCanonItem(
  canonItemId: string
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, canonItemId);

  const itemSnap = await getDoc(docRef);
  const itemData = itemSnap.exists() ? itemSnap.data() : {};
  const existingSources = Array.isArray(itemData.externalSources)
    ? (itemData.externalSources as ExternalSourceLink[])
    : undefined;

  await updateDoc(docRef, {
    externalSources: (existingSources ?? []).filter(source => source.source !== 'fdc'),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Suggest FDC matches for a canon item.
 *
 * Workflow:
 * 1. Fetch canon item
 * 2. Load FDC data (embeddings + index)
 * 3. Generate or reuse embedding for canon item name
 * 4. Search FDC locally by vector similarity
 * 5. Return best match + candidates
 *
 * Returns object with:
 * - bestMatch: FdcSearchResult | null
 * - candidates: FdcSearchResult[] (top 5)
 */
export async function suggestFdcForCanonItem(
  canonItemId: string
): Promise<{ bestMatch: FdcSearchResult | null; candidates: FdcSearchResult[] }> {
  // 1. Fetch canon item
  const canonItem = await fetchCanonItemById(canonItemId);
  if (!canonItem) {
    return { bestMatch: null, candidates: [] };
  }

  try {
    // 2. Load FDC data (will use cache if already loaded)
    const loadTimer = startTimer();
    await loadFdcData();
    const loadDuration = loadTimer();

    logMatchEvent({
      eventType: 'fdc-data-load',
      entityType: 'canon-item',
      entityId: canonItem.id,
      entityName: canonItem.name,
      aisleId: canonItem.aisleId,
      input: {},
      output: { entryCount: 0 }, // Actual count would require loadFdcData to return it
      metrics: { durationMs: loadDuration },
    });

    // 3. Generate embedding for canon item name
    const embeddingTimer = startTimer();
    const queryEmbedding = await generateTextEmbedding(canonItem.name);
    const embeddingDuration = embeddingTimer();

    logMatchEvent({
      eventType: 'embedding-generation',
      entityType: 'canon-item',
      entityId: canonItem.id,
      entityName: canonItem.name,
      aisleId: canonItem.aisleId,
      input: { queryText: canonItem.name, embeddingDim: queryEmbedding?.length },
      output: { embeddingGenerated: true, embeddingReused: false },
      metrics: { durationMs: embeddingDuration },
    });

    // 4. Search FDC locally
    const searchTimer = startTimer();
    const candidates = searchFdcLocal(queryEmbedding, 5, 0.65);
    const searchDuration = searchTimer();

    logMatchEvent({
      eventType: 'fdc-match',
      entityType: 'canon-item',
      entityId: canonItem.id,
      entityName: canonItem.name,
      aisleId: canonItem.aisleId,
      input: { embeddingDim: queryEmbedding.length },
      output: {
        resultCount: candidates.length,
        topScore: candidates[0]?.score,
        topMatchId: String(candidates[0]?.fdcId),
        topMatchName: candidates[0]?.description,
        method: 'semantic',
      },
      metrics: { durationMs: searchDuration },
      metadata: { threshold: 0.65 },
    });

    const bestMatch = candidates[0] ?? null;

    return { bestMatch, candidates };
  } catch (error) {
    console.warn('[suggestFdcForCanonItem] FDC matching unavailable:', error);
    return { bestMatch: null, candidates: [] };
  }
}

// ── Seed Operations (batch writes) ───────────────────────────────────────────

/**
 * Batch write aisles to canonAisles collection.
 * Uses setDoc with the aisle's id as the document ID (idempotent).
 */
export async function seedAisles(aisles: Aisle[]): Promise<void> {
  const batch = writeBatch(db);
  
  aisles.forEach(aisle => {
    const docRef = doc(db, CANON_AISLES_COLLECTION, aisle.id);
    batch.set(docRef, {
      id: aisle.id,
      name: aisle.name,
      tier2: aisle.tier2,
      tier3: aisle.tier3,
      sortOrder: aisle.sortOrder,
      createdAt: aisle.createdAt,
    });
  });

  await batch.commit();
}

/**
 * Batch write units to canonUnits collection.
 * Uses setDoc with the unit's id as the document ID (idempotent).
 */
export async function seedUnits(units: Unit[]): Promise<void> {
  const batch = writeBatch(db);
  
  units.forEach(unit => {
    const docRef = doc(db, CANON_UNITS_COLLECTION, unit.id);
    batch.set(docRef, {
      id: unit.id,
      name: unit.name,
      plural: unit.plural,
      category: unit.category,
      sortOrder: unit.sortOrder,
      createdAt: unit.createdAt,
    });
  });

  await batch.commit();
}


/**
 * Batch seed canonical items (v3 schema) into canonItems collection.
 * Idempotent — uses setDoc with item.id as the document ID.
 * Resolves aisle snapshots from canonAisles if the snapshot is missing.
 *
 * @param items  Raw item records (validated against CanonicalItemSchema)
 * @param onProgress  Optional progress callback (processed, total)
 * @param signal  AbortSignal for cancellation
 */
export async function seedCanonItems(
  items: unknown[],
  onProgress?: (processed: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ imported: number; failed: number; errors: Array<{ id: string; reason: string }> }> {
  const BATCH_SIZE = 50;
  const results = { imported: 0, failed: 0, errors: [] as Array<{ id: string; reason: string }> };

  // Pre-load all aisles for snapshot resolution
  const allAisles = await fetchCanonAisles();
  const aisleById = new Map(allAisles.map(a => [a.id, a]));

  const validItems: Array<{ id: string; doc: Record<string, unknown> }> = [];

  for (const raw of items) {
    if (signal?.aborted) throw new Error('Seeding cancelled by user');

    const parsed = CanonicalItemSchema.safeParse(raw);
    if (!parsed.success) {
      const id = (raw as any)?.id ?? 'unknown';
      results.errors.push({ id, reason: parsed.error.issues.map(i => i.message).join('; ') });
      results.failed++;
      continue;
    }

    const item = parsed.data;

    // Resolve aisle snapshot if not already present or if it looks like a default placeholder
    let aisleSnapshot = item.aisle;
    if (!aisleSnapshot.tier1 || aisleSnapshot.tier1 === 'Uncategorised') {
      const aisleDoc = aisleById.get(item.aisleId);
      if (aisleDoc) {
        aisleSnapshot = { tier1: aisleDoc.name, tier2: aisleDoc.tier2, tier3: aisleDoc.tier3 };
      }
    }

    validItems.push({
      id: item.id,
      doc: { ...item, aisle: aisleSnapshot },
    });
  }

  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new Error('Seeding cancelled by user');

    const chunk = validItems.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const { id, doc: itemDoc } of chunk) {
      const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
      batch.set(docRef, itemDoc);
    }

    try {
      await batch.commit();
      results.imported += chunk.length;
      onProgress?.(results.imported, validItems.length);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      for (const { id } of chunk) {
        results.errors.push({ id, reason: `Batch write failed: ${errorMsg}` });
        results.failed++;
      }
    }
  }

  return results;
}

/**
 * Batch write CofID items to canonCofidItems collection.
 * Handles both direct CofIDItem objects and the backup format { id, data: {...} }
 * 
 * Chunks writes into smaller batches to avoid "Request Entity Too Large" errors.
 * Each batch processes max 50 items to keep payload under limits.
 * 
 * @param items Raw items from backup file or CofIDItem objects
 * @param onProgress Callback for progress tracking (processed, total)
 * @param signal AbortSignal for cancellation
 */
export async function seedCofidItems(
  items: any[],
  onProgress?: (processed: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ imported: number; failed: number; errors: Array<{ id: string; reason: string }> }> {
  const BATCH_SIZE = 50; // Items per Firestore batch (keeps payload small)
  const results = { imported: 0, failed: 0, errors: [] as Array<{ id: string; reason: string }> };

  // Validate and transform items first (don't write invalid ones)
  // NOTE: Embeddings are NOT stored here - they go to canonEmbeddingLookup via seedCofidEmbeddings
  const validItems: Array<{
    id: string;
    name: string;
    group: string;
    nutrients: any;
    importedAt: string;
  }> = [];

  for (const rawItem of items) {
    if (signal?.aborted) throw new Error('Seeding cancelled by user');

    const item = rawItem.data ? rawItem.data : rawItem;

    if (!item.id || !item.name || !item.group || !item.importedAt) {
      results.errors.push({
        id: item.id || 'unknown',
        reason: 'Missing required fields (id, name, group, importedAt)',
      });
      results.failed++;
      continue;
    }

    validItems.push({
      id: item.id,
      name: item.name,
      group: item.group,
      nutrients: item.nutrients ?? null,
      importedAt: item.importedAt,
    });
  }

  // Write in chunks to avoid payload size errors
  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new Error('Seeding cancelled by user');

    const chunk = validItems.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(db, CANON_COFID_ITEMS_COLLECTION, item.id);
      batch.set(docRef, item);
    }

    try {
      await batch.commit();
      results.imported += chunk.length;
      onProgress?.(results.imported, validItems.length);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[seedCofidItems] Batch write failed at index ${i}:`, errorMsg);
      
      for (const item of chunk) {
        results.errors.push({
          id: item.id,
          reason: `Batch write failed: ${errorMsg}`,
        });
        results.failed++;
      }
    }
  }

  return results;
}
