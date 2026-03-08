/**
 * Canon Firestore provider
 *
 * Read helpers for `canonAisles`, `canonUnits`, and CRUD for `canonItems`.
 * Called from api.ts only — never imported directly from UI or logic.
 */

import { Aisle, Unit } from '../../../types/contract';
import { CofIDItem, CoFIDGroupAisleMapping } from '../types';
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
import { suggestBestMatch, rankCandidates, buildCofidMatch, type SuggestedMatch } from '../logic/suggestCofidMatch';
import { findSemanticMatches } from '../logic/embeddings';
import {
  fetchEmbeddingsFromLookup,
  generateTextEmbedding,
  upsertCanonItemEmbedding,
  upsertCanonItemEmbeddingById,
} from './embeddings-provider';
import {
  logMatchEvent,
  startTimer,
} from './match-events-provider';

const CANON_AISLES_COLLECTION = 'canonAisles';
const CANON_UNITS_COLLECTION = 'canonUnits';
const CANON_ITEMS_COLLECTION = 'canonItems';
const CANON_COFID_ITEMS_COLLECTION = 'canonCofidItems';
const COFID_GROUP_AISLE_MAPPINGS_COLLECTION = 'cofid_group_aisle_mappings';

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
 * Checks if any canon items reference this unit.
 */
export async function deleteCanonUnit(id: string): Promise<void> {
  const docRef = doc(db, CANON_UNITS_COLLECTION, id);
  
  // Check if any canon items reference this unit
  const itemsSnapshot = await getDocs(collection(db, CANON_ITEMS_COLLECTION));
  const hasReferences = itemsSnapshot.docs.some(doc => doc.data().preferredUnitId === id);
  
  if (hasReferences) {
    throw new Error(`Cannot delete unit: ${id} is in use by ${itemsSnapshot.docs.filter(doc => doc.data().preferredUnitId === id).length} canon items`);
  }
  
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
  sortOrder?: number;
}): Promise<Aisle> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, CANON_AISLES_COLLECTION), {
    name: input.name,
    sortOrder: input.sortOrder ?? 999,
    createdAt: now,
  });

  return {
    id: docRef.id,
    name: input.name,
    sortOrder: input.sortOrder ?? 999,
    createdAt: now,
  };
}

/**
 * Update an existing canon aisle.
 */
export async function updateCanonAisle(
  id: string,
  updates: Partial<Pick<Aisle, 'name' | 'sortOrder'>>
): Promise<void> {
  const docRef = doc(db, CANON_AISLES_COLLECTION, id);
  await updateDoc(docRef, updates);
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

// ── CofID Group Aisle Mappings CRUD ───────────────────────────────────────────

/**
 * Fetch all CofID group aisle mappings.
 */
export async function fetchCofidMappings(): Promise<CoFIDGroupAisleMapping[]> {
  const snapshot = await getDocs(collection(db, COFID_GROUP_AISLE_MAPPINGS_COLLECTION));
  const mappings: CoFIDGroupAisleMapping[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    mappings.push({
      id: docSnap.id,
      cofidGroup: data.cofidGroup,
      cofidGroupName: data.cofidGroupName,
      aisleId: data.aisleId,
      aisleName: data.aisleName,
      createdAt: data.createdAt,
      createdBy: data.createdBy,
    });
  });

  return mappings;
}

/**
 * Create a new CofID group aisle mapping.
 */
export async function createCofidMapping(input: {
  cofidGroup: string;
  cofidGroupName: string;
  aisleId: string;
  aisleName: string;
}): Promise<CoFIDGroupAisleMapping> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COFID_GROUP_AISLE_MAPPINGS_COLLECTION), {
    cofidGroup: input.cofidGroup,
    cofidGroupName: input.cofidGroupName,
    aisleId: input.aisleId,
    aisleName: input.aisleName,
    createdAt: now,
  });

  return {
    id: docRef.id,
    cofidGroup: input.cofidGroup,
    cofidGroupName: input.cofidGroupName,
    aisleId: input.aisleId,
    aisleName: input.aisleName,
    createdAt: now,
  };
}

/**
 * Update an existing CofID group aisle mapping.
 */
export async function updateCofidMapping(
  id: string,
  updates: Partial<Pick<CoFIDGroupAisleMapping, 'cofidGroup' | 'cofidGroupName' | 'aisleId' | 'aisleName'>>
): Promise<void> {
  const docRef = doc(db, COFID_GROUP_AISLE_MAPPINGS_COLLECTION, id);
  await updateDoc(docRef, updates);
}

/**
 * Delete a CofID group aisle mapping.
 */
export async function deleteCofidMapping(id: string): Promise<void> {
  const docRef = doc(db, COFID_GROUP_AISLE_MAPPINGS_COLLECTION, id);
  await deleteDoc(docRef);
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
      normalisedName: data.normalisedName ?? String(data.name ?? '').toLowerCase(),
      aisleId: data.aisleId,
      preferredUnitId: data.preferredUnitId,
      needsReview: data.needsReview ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      metadata: data.metadata,
      externalSources: Array.isArray(data.externalSources) ? data.externalSources : undefined,
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
    normalisedName: data.normalisedName ?? String(data.name ?? '').toLowerCase(),
    aisleId: data.aisleId,
    preferredUnitId: data.preferredUnitId,
    needsReview: data.needsReview ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    metadata: data.metadata,
    externalSources: Array.isArray(data.externalSources) ? data.externalSources : undefined,
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
    normalisedName: input.name.toLowerCase(),
    aisleId: input.aisleId,
    preferredUnitId: input.preferredUnitId,
    needsReview: input.needsReview ?? true,
    createdAt: now,
  });

  const createdItem: CanonItem = {
    id: docRef.id,
    name: input.name,
    normalisedName: input.name.toLowerCase(),
    aisleId: input.aisleId,
    preferredUnitId: input.preferredUnitId,
    needsReview: input.needsReview ?? true,
    createdAt: now,
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
 * Update an existing canon item.
 */
export async function updateCanonItem(
  id: string,
  updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId' | 'needsReview'>>
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  const payload: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (typeof updates.name === 'string') {
    payload.normalisedName = updates.name.toLowerCase();
  }

  await updateDoc(docRef, {
    ...payload,
  });

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
    needsReview: false,
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
}

/**
 * Delete all canon items.
 * Warning: This is a destructive operation that removes ALL items from the collection.
 */
export async function deleteAllCanonItems(): Promise<void> {
  const snapshot = await getDocs(collection(db, CANON_ITEMS_COLLECTION));
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
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

  await updateDoc(docRef, {
    externalSources: withCofidSource(existingSources, cofidId, {
      match: matchMetadata,
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

  // 3. Build aisle mapping: CofID item ID → canon aisle ID
  const aisleMapping = await buildAisleMapping(cofidItems);

  // 4. Get lexical aisle-bounded candidates
  const lexicalTimer = startTimer();
  const lexicalCandidates = rankCandidates(
    canonItem.name,
    canonItem.aisleId,
    cofidItems,
    aisleMapping,
    8
  );
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

  // 5. Semantic ranking from embedding lookup (best effort)
  let semanticCandidates: SuggestedMatch[] = [];
  try {
    const lookupEntries = await fetchEmbeddingsFromLookup(canonItem.aisleId);
    
    // Embedding generation/reuse with timing
    const embeddingTimer = startTimer();
    const cachedQueryEmbedding = resolveQueryEmbeddingFromLookup(
      canonItem.name,
      canonItem.id,
      lookupEntries as Array<{
        kind: 'canon' | 'cofid';
        refId: string;
        name: string;
        embedding: number[];
      }>
    );

    const embeddingReused = cachedQueryEmbedding !== null;
    const queryEmbedding = cachedQueryEmbedding ?? await generateTextEmbedding(canonItem.name);
    const embeddingDuration = embeddingTimer();

    // Log embedding generation event
    logMatchEvent({
      eventType: 'embedding-generation',
      entityType: 'canon-item',
      entityId: canonItem.id,
      entityName: canonItem.name,
      aisleId: canonItem.aisleId,
      input: {
        queryText: canonItem.name,
        embeddingDim: queryEmbedding?.length,
      },
      output: {
        embeddingGenerated: !embeddingReused,
        embeddingReused: embeddingReused,
      },
      metrics: {
        durationMs: embeddingDuration,
      },
    });

    if (queryEmbedding) {
      // Semantic matching with timing
      const semanticTimer = startTimer();
      const semanticMatches = findSemanticMatches(
        queryEmbedding,
        lookupEntries,
        canonItem.aisleId,
        0.55,
        12
      ).filter(match => match.kind === 'cofid');

      semanticCandidates = semanticMatches.map(match => ({
        cofidId: match.refId,
        name: match.name,
        score: match.similarity,
        method: 'semantic' as const,
        reason: match.reason,
      }));
      const semanticDuration = semanticTimer();

      // Log semantic matching event
      logMatchEvent({
        eventType: 'semantic-match',
        entityType: 'canon-item',
        entityId: canonItem.id,
        entityName: canonItem.name,
        aisleId: canonItem.aisleId,
        input: {
          embeddingDim: queryEmbedding.length,
          candidateCount: lookupEntries.length,
          aisleFiltered: true,
        },
        output: {
          resultCount: semanticCandidates.length,
          topScore: semanticCandidates[0]?.score,
          topMatchId: semanticCandidates[0]?.cofidId,
          topMatchName: semanticCandidates[0]?.name,
          method: 'semantic',
        },
        metrics: {
          durationMs: semanticDuration,
        },
        metadata: {
          threshold: 0.55,
        },
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

  const bestMatch = candidates[0] ?? suggestBestMatch(
    canonItem.name,
    canonItem.aisleId,
    cofidItems,
    aisleMapping
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
  const normaliseAisleName = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');

  // 1. Fetch aisles
  const aisles = await fetchCanonAisles();
  const aisleNameToId: Record<string, string> = {};
  for (const aisle of aisles) {
    aisleNameToId[normaliseAisleName(aisle.name)] = aisle.id;
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
      const aisleId = aisleNameToId[normaliseAisleName(aisleName)];
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
