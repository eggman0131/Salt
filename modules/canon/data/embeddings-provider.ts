/**
 * Embeddings Data Layer (I/O)
 *
 * Handles local IndexedDB storage for embedding lookups,
 * plus Firestore lookups and Cloud Function calls needed to build the index.
 * All functions are async and handle I/O.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, getMetadata } from 'firebase/storage';
import { db, auth, storage } from '../../../shared/backend/firebase';
import type { CanonEmbeddingLookup } from '../types';
import type { CanonItem } from '../logic/items';
import { validateEmbedding } from '../logic/embeddings';

// ── Collection names ─────────────────────────────────────────────────────────

const CANON_AISLES_COLLECTION = 'canonAisles';
const CANON_ITEMS_COLLECTION = 'canonItems';

// ── IndexedDB constants ──────────────────────────────────────────────────────

const EMBEDDINGS_DB_NAME = 'salt-canon-embeddings';
const EMBEDDINGS_DB_VERSION = 2;
const EMBEDDINGS_STORE = 'canonEmbeddingLookup';
const EMBEDDINGS_INDEX_AISLE = 'aisleId';
const EMBEDDINGS_META_STORE = 'meta';

const MASTER_EMBEDDINGS_PATH = 'canon/embeddings/master-lookup.v1.json';
const MASTER_SYNC_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let lastMasterSyncCheckMs = 0;


interface EmbedBatchResponse {
  embeddings: number[][];
  model: string;
  dimension: number;
}

interface EmbedBatchHttpResult {
  id: string;
  embedding: number[];
  modelVersion: string;
}

interface EmbedBatchHttpResponse {
  results?: EmbedBatchHttpResult[];
  failures?: Array<{ id: string; error: string }>;
  error?: string;
}

interface Aisle {
  id: string;
  name: string;
}

interface MasterEmbeddingSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  entryCount: number;
  entries: CanonEmbeddingLookup[];
}

// ── IndexedDB helpers ────────────────────────────────────────────────────────

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openEmbeddingsDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EMBEDDINGS_DB_NAME, EMBEDDINGS_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(EMBEDDINGS_STORE)) {
        const store = database.createObjectStore(EMBEDDINGS_STORE, {
          keyPath: 'id',
        });
        store.createIndex(EMBEDDINGS_INDEX_AISLE, 'aisleId', { unique: false });
      } else {
        const tx = request.transaction;
        if (tx) {
          const store = tx.objectStore(EMBEDDINGS_STORE);
          if (!store.indexNames.contains(EMBEDDINGS_INDEX_AISLE)) {
            store.createIndex(EMBEDDINGS_INDEX_AISLE, 'aisleId', { unique: false });
          }
        }
      }

      if (!database.objectStoreNames.contains(EMBEDDINGS_META_STORE)) {
        database.createObjectStore(EMBEDDINGS_META_STORE, {
          keyPath: 'key',
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function upsertEmbeddings(entries: CanonEmbeddingLookup[]): Promise<void> {
  if (entries.length === 0) return;

  const database = await openEmbeddingsDb();

  try {
    const tx = database.transaction(EMBEDDINGS_STORE, 'readwrite');
    const store = tx.objectStore(EMBEDDINGS_STORE);

    for (const entry of entries) {
      store.put(entry);
    }

    await transactionDone(tx);
  } finally {
    database.close();
  }
}

async function readEmbeddings(aisleId?: string): Promise<CanonEmbeddingLookup[]> {
  const database = await openEmbeddingsDb();

  try {
    const tx = database.transaction(EMBEDDINGS_STORE, 'readonly');
    const store = tx.objectStore(EMBEDDINGS_STORE);

    if (!aisleId) {
      const all = await requestToPromise(store.getAll());
      await transactionDone(tx);
      return all;
    }

    const index = store.index(EMBEDDINGS_INDEX_AISLE);
    const filtered = await requestToPromise(index.getAll(IDBKeyRange.only(aisleId)));
    await transactionDone(tx);
    return filtered;
  } finally {
    database.close();
  }
}

/**
 * Delete specific embeddings by their IDs from IndexedDB.
 */
export async function deleteEmbeddings(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const database = await openEmbeddingsDb();

  try {
    const tx = database.transaction(EMBEDDINGS_STORE, 'readwrite');
    const store = tx.objectStore(EMBEDDINGS_STORE);

    for (const id of ids) {
      store.delete(id);
    }

    await transactionDone(tx);
  } finally {
    database.close();
  }

  // Publish the updated local IndexedDB State to the Firebase Storage master file
  // so the deletion propagates to all clients.
  await publishLocalToMaster();
}

/**
 * Delete all canon-kind embeddings from IndexedDB.
 */
export async function clearCanonEmbeddings(): Promise<void> {
  const database = await openEmbeddingsDb();

  try {
    const tx = database.transaction(EMBEDDINGS_STORE, 'readwrite');
    const store = tx.objectStore(EMBEDDINGS_STORE);
    
    // We need to find all entries with kind === 'canon'
    // Since we don't have an index on 'kind', we'll iterate
    const request = store.openCursor();
    
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.kind === 'canon') {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    await transactionDone(tx);
  } finally {
    database.close();
  }

  // Publish the updated local IndexedDB State to the Firebase Storage master file
  // so the deletion propagates to all clients.
  await publishLocalToMaster();
}

async function replaceEmbeddings(entries: CanonEmbeddingLookup[]): Promise<void> {
  const database = await openEmbeddingsDb();

  try {
    const tx = database.transaction(EMBEDDINGS_STORE, 'readwrite');
    const store = tx.objectStore(EMBEDDINGS_STORE);

    store.clear();
    for (const entry of entries) {
      store.put(entry);
    }

    await transactionDone(tx);
  } finally {
    database.close();
  }
}

async function getMetaValue(key: string): Promise<string | null> {
  const database = await openEmbeddingsDb();

  try {
    const tx = database.transaction(EMBEDDINGS_META_STORE, 'readonly');
    const store = tx.objectStore(EMBEDDINGS_META_STORE);
    const record = await requestToPromise(store.get(key) as IDBRequest<{ key: string; value: string } | undefined>);
    await transactionDone(tx);
    return record?.value ?? null;
  } finally {
    database.close();
  }
}

async function setMetaValue(key: string, value: string): Promise<void> {
  const database = await openEmbeddingsDb();

  try {
    const tx = database.transaction(EMBEDDINGS_META_STORE, 'readwrite');
    const store = tx.objectStore(EMBEDDINGS_META_STORE);
    store.put({ key, value });
    await transactionDone(tx);
  } finally {
    database.close();
  }
}

function parseMasterSnapshot(raw: unknown): CanonEmbeddingLookup[] {
  if (Array.isArray(raw)) {
    return raw as CanonEmbeddingLookup[];
  }

  if (raw && typeof raw === 'object') {
    const maybeSnapshot = raw as Partial<MasterEmbeddingSnapshot>;
    if (Array.isArray(maybeSnapshot.entries)) {
      return maybeSnapshot.entries as CanonEmbeddingLookup[];
    }
  }

  return [];
}

async function getMasterUpdatedAt(): Promise<string | null> {
  try {
    const metadata = await getMetadata(ref(storage, MASTER_EMBEDDINGS_PATH));
    return metadata.updated ?? null;
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    if (code === 'storage/object-not-found') {
      return null;
    }
    throw error;
  }
}

async function downloadMasterEmbeddings(): Promise<CanonEmbeddingLookup[] | null> {
  try {
    const url = await getDownloadURL(ref(storage, MASTER_EMBEDDINGS_PATH));
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch master embeddings: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    return parseMasterSnapshot(payload);
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    if (code === 'storage/object-not-found') {
      return null;
    }
    throw error;
  }
}

async function publishMasterEmbeddings(entries: CanonEmbeddingLookup[]): Promise<void> {
  const snapshot: MasterEmbeddingSnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
  };

  const fileRef = ref(storage, MASTER_EMBEDDINGS_PATH);
  await uploadString(fileRef, JSON.stringify(snapshot), 'raw', {
    contentType: 'application/json',
  });

  const metadata = await getMetadata(fileRef);
  const remoteUpdatedAt = metadata.updated ?? snapshot.generatedAt;
  await setMetaValue('masterUpdatedAt', remoteUpdatedAt);
  await setMetaValue('lastSyncAt', new Date().toISOString());
}

async function syncFromMasterIfNeeded(force: boolean = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastMasterSyncCheckMs < MASTER_SYNC_CHECK_INTERVAL_MS) {
    return;
  }

  lastMasterSyncCheckMs = now;

  try {
    const remoteUpdatedAt = await getMasterUpdatedAt();
    if (!remoteUpdatedAt) {
      return;
    }

    const localMasterUpdatedAt = await getMetaValue('masterUpdatedAt');
    if (localMasterUpdatedAt === remoteUpdatedAt) {
      return;
    }

    const remoteEntries = await downloadMasterEmbeddings();
    if (!remoteEntries) {
      return;
    }

    await replaceEmbeddings(remoteEntries);
    await setMetaValue('masterUpdatedAt', remoteUpdatedAt);
    await setMetaValue('lastSyncAt', new Date().toISOString());
  } catch (error) {
    console.warn('[syncFromMasterIfNeeded] Failed to sync from Firebase Storage master:', error);
  }
}

export async function publishLocalToMaster(): Promise<void> {
  const allLocalEmbeddings = await readEmbeddings();
  await publishMasterEmbeddings(allLocalEmbeddings);
}

function normaliseEmbeddingName(value: string): string {
  return value.trim().toLowerCase();
}

function pickReusableEmbeddingByName(
  entries: CanonEmbeddingLookup[],
  name: string
): CanonEmbeddingLookup | null {
  const target = normaliseEmbeddingName(name);
  if (!target) return null;

  const exactCanon = entries.find(
    entry => entry.kind === 'canon' && normaliseEmbeddingName(entry.name) === target
  );

  if (exactCanon) {
    return exactCanon;
  }

  return entries.find(entry => normaliseEmbeddingName(entry.name) === target) ?? null;
}

// ── Fetch Operations ─────────────────────────────────────────────────────────

/**
 * Fetch all embedding lookup entries, optionally filtered by aisleId.
 * 
 * @param aisleId - Optional aisle filter
 * @returns Array of CanonEmbeddingLookup entries
 */
export async function fetchEmbeddingsFromLookup(
  aisleId?: string
): Promise<CanonEmbeddingLookup[]> {
  try {
    await syncFromMasterIfNeeded();
    return await readEmbeddings(aisleId);
  } catch (error) {
    console.error('[fetchEmbeddingsFromLookup] Error:', error);
    throw error;
  }
}

/**
 * Fetch all aisles.
 * 
 * @returns Array of Aisle objects
 */
async function fetchCanonAisles(): Promise<Aisle[]> {
  try {
    const q = query(collection(db, CANON_AISLES_COLLECTION));

    const snapshot = await getDocs(q);
    const aisles: Aisle[] = [];

    snapshot.forEach(docSnap => {
      aisles.push(docSnap.data() as Aisle);
    });

    return aisles;
  } catch (error) {
    console.error('[fetchCanonAisles] Error:', error);
    throw error;
  }
}


/**
 * Fetch all canon items for embedding generation.
 * @returns Array of CanonItem objects
 */
async function fetchCanonItems(): Promise<CanonItem[]> {
  try {
    const q = query(collection(db, CANON_ITEMS_COLLECTION));
    const snapshot = await getDocs(q);
    const items: CanonItem[] = [];

    snapshot.forEach(docSnap => {
      items.push(docSnap.data() as CanonItem);
    });

    return items;
  } catch (error) {
    console.error('[fetchCanonItems] Error:', error);
    throw error;
  }
}

// ── CofID Embedding Import ───────────────────────────────────────────────────

// ── CofID Embedding Import from Backup ──────────────────────────────────────

/**
 * Seed CofID embeddings directly from backup file data.
 * 
 * Used during initial seeding to import embeddings from the same backup file
 * that contains CofID items. This avoids fetching from Firestore.
 * 
 * This function:
 * 1. Extracts embeddings from raw items (unwraps { id, data } if needed)
 * 2. Fetches CofID group → aisle mappings
 * 3. Fetches all aisles to convert names to IDs
 * 4. Validates each embedding (model, dimension)
 * 5. Creates canonEmbeddingLookup entries with kind='cofid'
 * 6. Upserts entries to local IndexedDB lookup storage
 * 
 * @param rawItems - Raw items from backup file (may be { id, data: {...} } format)
 * @returns Summary of import operation
 */
export async function seedCofidEmbeddings(
  rawItems: any[]
): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  message?: string;
}> {
  try {
    console.log(`[seedCofidEmbeddings] Processing ${rawItems.length} items`);

    if (rawItems.length === 0) {
      return {
        success: true,
        imported: 0,
        skipped: 0,
        errors: 0,
        message: 'No items to process',
      };
    }

    // Define raw item type with embedding fields (from backup file only)
    interface RawCofIDItemWithEmbedding {
      id: string;
      name: string;
      group: string;
      embedding?: number[];
      embeddingModel?: string;
    }

    // 1. Extract and unwrap items (handle { id, data } format)
    const itemsWithEmbeddings: RawCofIDItemWithEmbedding[] = [];
    for (const rawItem of rawItems) {
      const item = rawItem.data ? rawItem.data : rawItem;
      if (item.id && item.embedding && Array.isArray(item.embedding)) {
        itemsWithEmbeddings.push({
          id: item.id,
          name: item.name,
          group: item.group,
          embedding: item.embedding,
          embeddingModel: item.embeddingModel,
        });
      }
    }

    console.log(`[seedCofidEmbeddings] Found ${itemsWithEmbeddings.length} items with embeddings`);

    if (itemsWithEmbeddings.length === 0) {
      return {
        success: true,
        imported: 0,
        skipped: 0,
        errors: 0,
        message: 'No items with embeddings found',
      };
    }

    // 2. Build lookup entries
    const lookupEntries: CanonEmbeddingLookup[] = [];
    let skipped = 0;
    let errors = 0;

    for (const item of itemsWithEmbeddings) {
      // Validate embedding
      if (!item.embedding || !item.embeddingModel) {
        skipped++;
        continue;
      }

      const validationResult = validateEmbedding(
        item.embedding,
        768,
        item.embeddingModel
      );

      if (!validationResult.valid) {
        console.warn(`[seedCofidEmbeddings] Invalid embedding for ${item.id}: ${validationResult.reason}`);
        errors++;
        continue;
      }

      // Create lookup entry — aisleId not used for filtering so 'uncategorised' is fine
      lookupEntries.push({
        id: item.id,
        kind: 'cofid',
        refId: item.id,
        name: item.name,
        aisleId: 'uncategorised',
        embedding: item.embedding,
        embeddingModel: item.embeddingModel,
        embeddingDim: item.embedding.length,
        createdAt: new Date().toISOString(),
      });
    }

    console.log(`[seedCofidEmbeddings] Created ${lookupEntries.length} lookup entries`);

    // 5. Upsert into local IndexedDB lookup table
    await upsertEmbeddings(lookupEntries);

    // 6. Publish local snapshot to Firebase Storage master for other browsers
    await publishLocalToMaster();

    const imported = lookupEntries.length;

    return {
      success: true,
      imported,
      skipped,
      errors,
      message: `Imported ${imported} CofID embeddings`,
    };
  } catch (error) {
    console.error('[seedCofidEmbeddings] Error:', error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ── Canon Item Embedding Generation ──────────────────────────────────────────

/**
 * Call the embedBatch Cloud Function to generate embeddings for texts.
 * 
 * @param texts - Array of text strings to embed
 * @param model - Embedding model (default: "text-embedding-005")
 * @returns Embeddings array and metadata
 */
async function callEmbedBatch(
  texts: string[],
  model: string = 'text-embedding-005'
): Promise<{ success: boolean; data?: EmbedBatchResponse; error?: string }> {
  try {
    // Get authentication token
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const idToken = await user.getIdToken(true);

    const projectId = 'gen-lang-client-0015061880';
    const region = 'europe-west2';
    const host = typeof location !== 'undefined' ? location.hostname : '';

    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isCloudIDE = host.endsWith('.cloudworkstations.dev');

    const endpoint = isLocalhost
      ? `http://localhost:5001/${projectId}/${region}/embedBatch`
      : isCloudIDE
        ? `${location.origin}/${projectId}/${region}/embedBatch`
        : `https://${region}-${projectId}.cloudfunctions.net/embedBatch`;

    const items = texts.map((text, index) => ({
      id: `item-${index}`,
      text,
    }));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken,
        items,
        model,
      }),
    });

    const payload = (await response.json()) as EmbedBatchHttpResponse;

    if (!response.ok) {
      return {
        success: false,
        error: payload.error || `embedBatch failed with HTTP ${response.status}`,
      };
    }

    const resultMap = new Map<string, EmbedBatchHttpResult>();
    for (const item of payload.results ?? []) {
      resultMap.set(item.id, item);
    }

    const embeddings = items
      .map(item => resultMap.get(item.id)?.embedding)
      .filter((embedding): embedding is number[] => Array.isArray(embedding));

    if (embeddings.length !== items.length) {
      return {
        success: false,
        error: `Embedding count mismatch: expected ${items.length}, got ${embeddings.length}`,
      };
    }

    const modelVersion = payload.results?.[0]?.modelVersion || model;
    const dimension = embeddings[0]?.length ?? 0;

    return {
      success: true,
      data: {
        embeddings,
        model: modelVersion,
        dimension,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Cloud Function error: ${message}`,
    };
  }
}

/**
 * Generate a single embedding vector for a text query.
 * Reuses the embedBatch Cloud Function for consistency with bulk generation.
 */
export async function generateTextEmbedding(
  text: string,
  model: string = 'text-embedding-005'
): Promise<number[] | null> {
  const cleaned = text.trim();
  if (!cleaned) return null;

  const result = await callEmbedBatch([cleaned], model);
  if (!result.success || !result.data || result.data.embeddings.length === 0) {
    return null;
  }

  return result.data.embeddings[0] ?? null;
}

/**
 * Generate embeddings for a batch of texts in one API call.
 * Returns null for any text that fails or is empty.
 */
export async function generateTextEmbeddingsBatch(
  texts: string[],
  model: string = 'text-embedding-005'
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];

  const result = await callEmbedBatch(texts.map(t => t.trim()), model);
  if (!result.success || !result.data) {
    return texts.map(() => null);
  }

  return result.data.embeddings.map(e => e ?? null);
}

/**
 * Upsert a single canon item embedding into local lookup and publish to master snapshot.
 * Reuses an existing embedding from lookup when an identical name already exists.
 */
export async function upsertCanonItemEmbedding(input: {
  id: string;
  name: string;
  aisleId: string;
}): Promise<{ success: boolean; reused: boolean; message?: string }> {
  const name = input.name.trim();
  if (!name) {
    return {
      success: false,
      reused: false,
      message: 'Cannot embed empty canon item name',
    };
  }

  await syncFromMasterIfNeeded();

  const aisleEntries = await readEmbeddings(input.aisleId);
  const reusable = pickReusableEmbeddingByName(aisleEntries, name);

  let embedding: number[] | null = null;
  let embeddingModel = 'text-embedding-005';
  let reused = false;

  if (reusable?.embedding?.length) {
    embedding = reusable.embedding;
    embeddingModel = reusable.embeddingModel;
    reused = true;
  } else {
    embedding = await generateTextEmbedding(name, embeddingModel);
  }

  if (!embedding || embedding.length === 0) {
    return {
      success: false,
      reused,
      message: `Failed to generate embedding for canon item ${input.id}`,
    };
  }

  const entry: CanonEmbeddingLookup = {
    id: input.id,
    kind: 'canon',
    refId: input.id,
    name,
    aisleId: input.aisleId,
    embedding,
    embeddingModel,
    embeddingDim: embedding.length,
    createdAt: new Date().toISOString(),
  };

  await upsertEmbeddings([entry]);
  await publishLocalToMaster();

  return {
    success: true,
    reused,
    message: reused
      ? `Reused existing embedding for canon item ${input.id}`
      : `Generated embedding for canon item ${input.id}`,
  };
}

/**
 * Resolve a single canon item from Firestore and upsert embedding in the lookup table.
 */
export async function upsertCanonItemEmbeddingById(
  canonItemId: string
): Promise<{ success: boolean; reused: boolean; message?: string }> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, canonItemId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return {
      success: false,
      reused: false,
      message: `Canon item not found: ${canonItemId}`,
    };
  }

  const data = snap.data() as Partial<CanonItem>;
  if (!data.name || !data.aisleId) {
    return {
      success: false,
      reused: false,
      message: `Canon item missing required fields: ${canonItemId}`,
    };
  }

  return upsertCanonItemEmbedding({
    id: canonItemId,
    name: data.name,
    aisleId: data.aisleId,
  });
}

/**
 * Generate embeddings for canon items and store in local IndexedDB lookup table.
 *
 * This function:
 * 1. Fetches ALL canon items (approved and unapproved)
 * 2. Calls embedBatch Cloud Function for all item names
 * 3. Creates canonEmbeddingLookup entries with kind='canon'
 * 4. Upserts to IndexedDB
 * 5. Publishes master snapshot to Firebase Storage
 *
 * @returns Summary of generation operation
 */
export async function generateCanonItemEmbeddings(): Promise<{
  success: boolean;
  generated: number;
  errors: number;
  message?: string;
}> {
  try {
    // 1. Fetch all canon items (approved and unapproved)
    const canonItems = await fetchCanonItems();
    console.log(`[generateCanonItemEmbeddings] Found ${canonItems.length} canon items`);

    if (canonItems.length === 0) {
      return {
        success: true,
        generated: 0,
        errors: 0,
        message: 'No canon items found',
      };
    }

    // 2. Extract item names for embedding
    const texts = canonItems.map(item => item.name);

    // 3. Call embedBatch Cloud Function
    console.log(`[generateCanonItemEmbeddings] Calling embedBatch for ${texts.length} items`);
    const embedResult = await callEmbedBatch(texts);

    if (!embedResult.success || !embedResult.data) {
      return {
        success: false,
        generated: 0,
        errors: canonItems.length,
        message: embedResult.error || 'Failed to generate embeddings',
      };
    }

    const { embeddings, model, dimension } = embedResult.data;

    if (embeddings.length !== canonItems.length) {
      return {
        success: false,
        generated: 0,
        errors: canonItems.length,
        message: `Embedding count mismatch: expected ${canonItems.length}, got ${embeddings.length}`,
      };
    }

    // 4. Build lookup entries
    const lookupEntries: CanonEmbeddingLookup[] = [];
    let errors = 0;

    for (let i = 0; i < canonItems.length; i++) {
      const item = canonItems[i];
      const embedding = embeddings[i];

      // Validate embedding
      const validationResult = validateEmbedding(embedding, dimension, model);
      if (!validationResult.valid) {
        console.warn(`[generateCanonItemEmbeddings] Invalid embedding for ${item.id}: ${validationResult.reason}`);
        errors++;
        continue;
      }

      // Create lookup entry
      lookupEntries.push({
        id: item.id, // Use canon item ID as document ID
        kind: 'canon',
        refId: item.id,
        name: item.name,
        aisleId: item.aisleId,
        embedding,
        embeddingModel: model,
        embeddingDim: dimension,
        createdAt: new Date().toISOString(),
      });
    }

    console.log(`[generateCanonItemEmbeddings] Created ${lookupEntries.length} lookup entries`);

    // 5. Upsert into local IndexedDB lookup table
    await upsertEmbeddings(lookupEntries);

    // 6. Publish local snapshot to Firebase Storage master for other browsers
    await publishLocalToMaster();

    const generated = lookupEntries.length;

    return {
      success: true,
      generated,
      errors,
      message: `Generated ${generated} canon item embeddings`,
    };
  } catch (error) {
    console.error('[generateCanonItemEmbeddings] Error:', error);
    return {
      success: false,
      generated: 0,
      errors: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
