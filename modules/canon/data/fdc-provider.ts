/**
 * FDC Data Provider
 *
 * Client-side access to USDA FDC food portions data for enriching canon item
 * unit conversion fields (unit_weights, density_g_per_ml).
 *
 * Two search modes:
 *  - searchFdcLocal: downloads binary once per session, searches in-browser.
 *    Used for bulk admin enrichment (avoids repeated Cloud Function calls).
 *  - searchFdcByEmbedding: calls the searchFdc Cloud Function for a single query.
 *    Used for runtime per-ingredient lookups.
 */

import { ref, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth, storage } from '../../../shared/backend/firebase';
import type { UnitIntelligence } from '../../../types/contract';
import { generateTextEmbeddingsBatch } from './embeddings-provider';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FdcPortion {
  gramWeight: number;
  amount: number;
  measureUnit: { id: number; name: string; abbreviation: string };
  modifier: string;
}

export interface FdcSearchResult {
  row: number;
  fdcId: number;
  description: string;
  dataType: string;
  score: number;
  portions: FdcPortion[];
}

interface FdcIndexEntry {
  row: number;
  fdcId: number;
  description: string;
  dataType: string;
  portions: FdcPortion[];
}

export interface FdcEnrichmentResult {
  success: boolean;
  enriched: number;
  noMatch: number;
  errors: number;
  message?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FDC_BIN_PATH = 'fdc/embeddings/combined-v1.bin';
const FDC_JSON_PATH = 'fdc/embeddings/combined-v1.json';
const CANON_ITEMS_COLLECTION = 'canonItems';
const DIM = 768;
const ENRICH_THRESHOLD = 0.75;
const RUNTIME_THRESHOLD = 0.70;
const DEFAULT_TOP_K = 5;

const PROJECT_ID = 'gen-lang-client-0015061880';
const REGION = 'europe-west2';

// ── Module-scope cache ───────────────────────────────────────────────────────

let cachedBin: Float32Array | null = null;
let cachedIndex: FdcIndexEntry[] | null = null;

// ── Local FDC loading and search ─────────────────────────────────────────────

/**
 * Download FDC binary + JSON index from Firebase Storage and cache in memory.
 * Safe to call multiple times — re-uses cached data.
 */
export async function loadFdcData(): Promise<{ entryCount: number }> {
  if (cachedBin && cachedIndex) {
    return { entryCount: cachedIndex.length };
  }

  const [binUrl, jsonUrl] = await Promise.all([
    getDownloadURL(ref(storage, FDC_BIN_PATH)),
    getDownloadURL(ref(storage, FDC_JSON_PATH)),
  ]);

  const [binRes, jsonRes] = await Promise.all([
    fetch(binUrl),
    fetch(jsonUrl),
  ]);

  const [binBuffer, indexData] = await Promise.all([
    binRes.arrayBuffer(),
    jsonRes.json() as Promise<FdcIndexEntry[]>,
  ]);

  cachedBin = new Float32Array(binBuffer);
  cachedIndex = indexData;

  return { entryCount: cachedIndex.length };
}

/**
 * Search the cached FDC data using cosine similarity.
 * Call `loadFdcData()` before using this.
 */
export function searchFdcLocal(
  queryEmbedding: number[],
  topK: number = DEFAULT_TOP_K,
  threshold: number = ENRICH_THRESHOLD
): FdcSearchResult[] {
  if (!cachedBin || !cachedIndex) {
    throw new Error('FDC data not loaded. Call loadFdcData() first.');
  }

  const N = cachedIndex.length;

  let qNorm = 0;
  for (let i = 0; i < DIM; i++) qNorm += queryEmbedding[i] * queryEmbedding[i];
  qNorm = Math.sqrt(qNorm);
  if (qNorm === 0) return [];

  const scores: Array<{ row: number; score: number }> = [];

  for (let row = 0; row < N; row++) {
    let dot = 0;
    let cNorm = 0;
    const offset = row * DIM;
    for (let i = 0; i < DIM; i++) {
      const c = cachedBin![offset + i];
      dot += queryEmbedding[i] * c;
      cNorm += c * c;
    }
    const score = cNorm > 0 ? dot / (qNorm * Math.sqrt(cNorm)) : 0;
    if (score >= threshold) {
      scores.push({ row, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, topK).map(({ row, score }) => ({
    ...cachedIndex![row],
    score,
  }));
}

/**
 * Call the searchFdc Cloud Function for a single query.
 * Useful at runtime without downloading the full binary corpus.
 */
export async function searchFdcByEmbedding(
  queryEmbedding: number[],
  topK: number = DEFAULT_TOP_K
): Promise<FdcSearchResult[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const idToken = await user.getIdToken(true);
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const endpoint = isLocalhost
    ? `http://localhost:5001/${PROJECT_ID}/${REGION}/searchFdc`
    : `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/searchFdc`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, queryEmbedding, topK, threshold: RUNTIME_THRESHOLD }),
  });

  const data = (await res.json()) as { matches?: FdcSearchResult[]; error?: string };
  if (!res.ok) throw new Error(data.error || `searchFdc failed: HTTP ${res.status}`);

  return data.matches ?? [];
}

// ── Portions → unit field mapping ────────────────────────────────────────────

// ml per one unit of measure (for density computation)
const ML_PER_UNIT: Record<string, number> = {
  'fluid ounce': 29.5735,
  'fl oz': 29.5735,
  'milliliter': 1,
  'ml': 1,
  'liter': 1000,
  'l': 1000,
};

/**
 * Map FDC food portions to a Firestore field-path patch for CanonicalItem.unit.
 * Returns only fields where the existing unit_weights value is absent.
 * Skips portions with a non-empty modifier (e.g. "packed", "drained") for primary fields.
 */
export function mapFdcPortionsToUnitPatch(
  portions: FdcPortion[],
  existingUnit: UnitIntelligence
): Record<string, number> {
  const patch: Record<string, number> = {};

  for (const p of portions) {
    const perUnit = p.gramWeight / p.amount;
    let name = p.measureUnit.name.toLowerCase().trim();
    let abbr = p.measureUnit.abbreviation.toLowerCase().trim();

    // If measureUnit is "undetermined", try to extract unit from modifier
    if (name === 'undetermined' || abbr === 'undetermined') {
      const modLower = p.modifier.toLowerCase().trim();
      if (modLower.includes('tbsp') || modLower.includes('tablespoon')) {
        name = 'tablespoon'; abbr = 'tbsp';
      } else if (modLower.includes('tsp') || modLower.includes('teaspoon')) {
        name = 'teaspoon'; abbr = 'tsp';
      } else if (modLower.includes('cup')) {
        name = 'cup'; abbr = 'cup';
      } else if (modLower.includes('racc')) {
        name = 'racc'; abbr = 'racc';
      } else if (modLower.includes('each') || modLower.includes('whole')) {
        name = 'each'; abbr = 'each';
      }
    }

    // unit_weights — volume measures
    if (name === 'tablespoon' || abbr === 'tbsp') {
      if (existingUnit.unit_weights?.tbsp == null) patch['unit.unit_weights.tbsp'] = perUnit;
    } else if (name === 'teaspoon' || abbr === 'tsp') {
      if (existingUnit.unit_weights?.tsp == null) patch['unit.unit_weights.tsp'] = perUnit;
    } else if (name === 'cup') {
      if (existingUnit.unit_weights?.cup == null) patch['unit.unit_weights.cup'] = perUnit;
    }

    // density_g_per_ml — inferred from fluid measures
    const mlFactor = ML_PER_UNIT[name] ?? ML_PER_UNIT[abbr];
    if (mlFactor !== undefined && existingUnit.density_g_per_ml == null) {
      patch['unit.density_g_per_ml'] = p.gramWeight / (p.amount * mlFactor);
    }

    // unit_weights — count and size measures
    if (name === 'racc' || abbr === 'racc') {
      if (existingUnit.unit_weights?.medium == null) patch['unit.unit_weights.medium'] = perUnit;
      if (existingUnit.unit_weights?.default == null) patch['unit.unit_weights.default'] = perUnit;
    } else if (
      name === 'each' || name === 'whole' || name === 'piece' || name === 'item' ||
      name === 'fruit' || name === 'vegetable' || name === 'leaf' || name === 'clove' ||
      abbr === 'each' || abbr === 'piece'
    ) {
      const modLower = p.modifier.toLowerCase();
      if (modLower.includes('small')) {
        if (existingUnit.unit_weights?.small == null) patch['unit.unit_weights.small'] = perUnit;
      } else if (modLower.includes('medium')) {
        if (existingUnit.unit_weights?.medium == null) patch['unit.unit_weights.medium'] = perUnit;
      } else if (modLower.includes('large')) {
        if (existingUnit.unit_weights?.large == null) patch['unit.unit_weights.large'] = perUnit;
      } else {
        if (existingUnit.unit_weights?.default == null) patch['unit.unit_weights.default'] = perUnit;
      }
    }
  }

  return patch;
}

// ── Canon item FDC enrichment (full pipeline) ────────────────────────────────

/**
 * Enrich a batch of canon items with FDC portions data.
 *
 * Requires `loadFdcData()` to have been called first.
 * Generates embeddings for all canon item names in one API call, then searches
 * FDC locally and writes matches to Firestore.
 */
export async function enrichCanonItemsWithFdc(
  canonItems: Array<{ id: string; name: string; unit: UnitIntelligence; externalSources?: unknown[] }>,
  onProgress?: (processed: number, total: number) => void,
  signal?: AbortSignal
): Promise<FdcEnrichmentResult> {
  let enriched = 0;
  let noMatch = 0;
  let errors = 0;
  const total = canonItems.length;

  try {
    // Generate embeddings for all canon item names in one batch API call
    const names = canonItems.map(item => item.name);
    const embeddings = await generateTextEmbeddingsBatch(names);

    for (let i = 0; i < canonItems.length; i++) {
      if (signal?.aborted) throw new Error('Enrichment cancelled');

      const item = canonItems[i];
      const embedding = embeddings[i];

      onProgress?.(i + 1, total);

      if (!embedding) {
        errors++;
        continue;
      }

      const matches = searchFdcLocal(embedding, 1, ENRICH_THRESHOLD);

      if (matches.length === 0) {
        noMatch++;
        continue;
      }

      const topMatch = matches[0];

      try {
        const unitPatch = mapFdcPortionsToUnitPatch(topMatch.portions, item.unit);
        await writeFdcLinkToCanonItem(item.id, topMatch, unitPatch, item.externalSources);
        enriched++;
      } catch (error) {
        console.warn(`[enrichCanonItemsWithFdc] Failed to write FDC link for ${item.id}:`, error);
        errors++;
      }
    }

    return { success: true, enriched, noMatch, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, enriched, noMatch, errors, message };
  }
}

// ── Firestore write ───────────────────────────────────────────────────────────

/**
 * Write an FDC source link and unit field patch to a canon item document.
 * If existingExternalSources is not provided, fetches the current document first.
 */
async function writeFdcLinkToCanonItem(
  canonItemId: string,
  fdcMatch: FdcSearchResult,
  unitPatch: Record<string, number>,
  existingExternalSources?: unknown[]
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, canonItemId);

  let currentSources: unknown[];
  if (existingExternalSources !== undefined) {
    currentSources = existingExternalSources;
  } else {
    const snap = await getDoc(docRef);
    currentSources = snap.exists() ? ((snap.data().externalSources as unknown[]) ?? []) : [];
  }

  const now = new Date().toISOString();
  const fdcLink = {
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
    ...(currentSources as Array<{ source?: string }>).filter(s => s?.source !== 'fdc'),
    fdcLink,
  ];

  await updateDoc(docRef, {
    externalSources: updatedSources,
    lastSyncedAt: now,
    updatedAt: now,
    ...unitPatch,
  });
}
