/**
 * Canon Firestore provider
 *
 * Read helpers for `canonAisles`, `canonUnits`, and CRUD for `canonItems`.
 * Called from api.ts only — never imported directly from UI or logic.
 */

import { Aisle, Unit, CofIDItem, CoFIDGroupAisleMapping } from '../../../types/contract';
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
} from 'firebase/firestore';
import { CanonItem } from '../logic/items';
import { suggestBestMatch, rankCandidates, buildCofidMatch, type SuggestedMatch } from '../logic/suggestCofidMatch';

const CANON_AISLES_COLLECTION = 'canonAisles';
const CANON_UNITS_COLLECTION = 'canonUnits';
const CANON_ITEMS_COLLECTION = 'canonItems';
const CANON_COFID_ITEMS_COLLECTION = 'canonCofidItems';
const COFID_GROUP_AISLE_MAPPINGS_COLLECTION = 'cofid_group_aisle_mappings';

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
    items.push({
      id: docSnap.id,
      name: data.name,
      aisleId: data.aisleId,
      preferredUnitId: data.preferredUnitId,
      needsReview: data.needsReview ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // PR5: CofID enrichment fields
      cofidId: data.cofidId ?? null,
      cofidMatch: data.cofidMatch,
      nutrients: data.nutrients,
      nutrientsSource: data.nutrientsSource ?? null,
      nutrientsImportedAt: data.nutrientsImportedAt ?? null,
    });
  });

  return items;
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

  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    aisleId: data.aisleId,
    preferredUnitId: data.preferredUnitId,
    needsReview: data.needsReview ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    // PR5: CofID enrichment fields
    cofidId: data.cofidId ?? null,
    cofidMatch: data.cofidMatch,
    nutrients: data.nutrients,
    nutrientsSource: data.nutrientsSource ?? null,
    nutrientsImportedAt: data.nutrientsImportedAt ?? null,
  };
}

/**
 * Create a new canon item.
 * Returns the newly created item with its Firestore-generated ID.
 */
export async function createCanonItem(input: {
  name: string;
  aisleId: string;
  preferredUnitId: string;
  needsReview?: boolean;
}): Promise<CanonItem> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, CANON_ITEMS_COLLECTION), {
    name: input.name,
    aisleId: input.aisleId,
    preferredUnitId: input.preferredUnitId,
    needsReview: input.needsReview ?? true,
    createdAt: now,
  });

  return {
    id: docRef.id,
    name: input.name,
    aisleId: input.aisleId,
    preferredUnitId: input.preferredUnitId,
    needsReview: input.needsReview ?? true,
    createdAt: now,
  };
}

/**
 * Update an existing canon item.
 */
export async function updateCanonItem(
  id: string,
  updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId' | 'needsReview'>>
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Approve a canon item (set needsReview = false).
 * If the item has a linked CofID match, copy nutrients from the CofID item.
 */
export async function approveCanonItem(id: string): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  
  // Get current item data to check for cofidId
  const itemSnap = await getDoc(docRef);
  if (!itemSnap.exists()) {
    throw new Error(`Canon item ${id} not found`);
  }

  const itemData = itemSnap.data();
  const updates: any = {
    needsReview: false,
    updatedAt: new Date().toISOString(),
  };

  // If linked to a CofID item, copy nutrients
  if (itemData.cofidId) {
    const cofidItem = await fetchCofidItemById(itemData.cofidId);
    if (cofidItem?.nutrients) {
      updates.nutrients = cofidItem.nutrients;
      updates.nutrientsSource = 'cofid';
      updates.nutrientsImportedAt = new Date().toISOString();
    }
  }

  await updateDoc(docRef, updates);
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
 * Updates the canon item with cofidId and cofidMatch metadata.
 */
export async function linkCofidMatchToCanonItem(
  canonItemId: string,
  cofidId: string,
  matchMetadata: any
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, canonItemId);
  await updateDoc(docRef, {
    cofidId,
    cofidMatch: matchMetadata,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Unlink CofID match from a canon item.
 * Removes cofidId, cofidMatch, nutrients fields.
 */
export async function unlinkCofidMatchFromCanonItem(
  canonItemId: string
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, canonItemId);
  await updateDoc(docRef, {
    cofidId: null,
    cofidMatch: {
      status: 'unlinked',
      method: null,
      score: null,
      matchedAt: new Date().toISOString(),
    },
    nutrients: null,
    nutrientsSource: null,
    nutrientsImportedAt: null,
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

  // 3. Build aisle mapping: CofID item ID → canon aisle ID
  const aisleMapping = await buildAisleMapping(cofidItems);

  // 4. Get best match
  const bestMatch = suggestBestMatch(
    canonItem.name,
    canonItem.aisleId,
    cofidItems,
    aisleMapping
  );

  // 5. Get top candidates
  const candidates = rankCandidates(
    canonItem.name,
    cofidItems,
    aisleMapping,
    5
  );

  return { bestMatch, candidates };
}

/**
 * Build aisle mapping for CofID items.
 * Maps CofID item ID → canon aisle ID.
 * 
 * Process:
 * 1. Fetch all canon aisles
 * 2. Fetch all CofID group-to-aisle mappings
 * 3. Build map: aisle name → aisle ID
 * 4. Build map: CofID group → aisle name
 * 5. For each CofID item: item.group → aisle name → aisle ID
 */
async function buildAisleMapping(cofidItems: CofIDItem[]): Promise<Record<string, string>> {
  // 1. Fetch aisles
  const aisles = await fetchCanonAisles();
  const aisleNameToId: Record<string, string> = {};
  for (const aisle of aisles) {
    aisleNameToId[aisle.name] = aisle.id;
  }

  // 2. Fetch CofID group-to-aisle mappings
  const groupMappingsSnapshot = await getDocs(
    collection(db, COFID_GROUP_AISLE_MAPPINGS_COLLECTION)
  );
  const groupToAisleName: Record<string, string> = {};
  groupMappingsSnapshot.forEach(docSnap => {
    const data = docSnap.data() as CoFIDGroupAisleMapping;
    groupToAisleName[data.cofidGroup] = data.aisle;
  });

  // 3. Build final mapping: CofID item ID → canon aisle ID
  const aisleMapping: Record<string, string> = {};
  for (const cofidItem of cofidItems) {
    const aisleName = groupToAisleName[cofidItem.group];
    if (aisleName) {
      const aisleId = aisleNameToId[aisleName];
      if (aisleId) {
        aisleMapping[cofidItem.id] = aisleId;
      }
    }
  }

  return aisleMapping;
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
 * Batch write CofID group → aisle mappings to cofid_group_aisle_mappings collection.
 * Uses setDoc with the group code as the document ID (idempotent).
 */
export async function seedCofidGroupAisleMappings(
  mappings: Record<string, CoFIDGroupAisleMapping>
): Promise<void> {
  const batch = writeBatch(db);
  
  Object.entries(mappings).forEach(([groupCode, mapping]) => {
    const docRef = doc(db, COFID_GROUP_AISLE_MAPPINGS_COLLECTION, groupCode);
    batch.set(docRef, {
      id: groupCode,
      cofidGroup: groupCode,
      cofidGroupName: mapping.cofidGroupName,
      aisleId: mapping.aisleId,
      aisleName: mapping.aisleName,
      createdAt: new Date().toISOString(),
    });
  });

  await batch.commit();
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
