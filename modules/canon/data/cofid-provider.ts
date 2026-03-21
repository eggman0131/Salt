/**
 * CoFID Data Provider
 *
 * Client-side access to CoFID food composition data for semantic matching.
 *
 * Two search modes:
 *  - searchCofidLocal: downloads binary once per session, searches in-browser.
 *    Used for bulk admin enrichment (avoids repeated Cloud Function calls).
 *  - searchCofidByEmbedding: calls the searchCofid Cloud Function for a single query.
 *    Used for runtime per-item suggestions.
 */

import { ref, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../../../shared/backend/firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CofidSearchResult {
  row: number;
  id: string;
  name: string;
  group: string;
  score: number;
}

interface CofidIndexEntry {
  row: number;
  id: string;
  name: string;
  group: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COFID_BIN_PATH = 'cofid/embeddings/combined-v1.bin';
const COFID_JSON_PATH = 'cofid/embeddings/combined-v1.json';
const DIM = 768;
const SEARCH_THRESHOLD = 0.65;
const DEFAULT_TOP_K = 5;

const PROJECT_ID = 'gen-lang-client-0015061880';
const REGION = 'europe-west2';

// ── Module-scope cache ────────────────────────────────────────────────────────

let cachedBin: Float32Array | null = null;
let cachedIndex: CofidIndexEntry[] | null = null;

// ── Local CoFID loading and search ───────────────────────────────────────────

/**
 * Download CoFID binary + JSON index from Firebase Storage and cache in memory.
 * Safe to call multiple times — re-uses cached data.
 */
export async function loadCofidData(): Promise<{ entryCount: number }> {
  if (cachedBin && cachedIndex) {
    return { entryCount: cachedIndex.length };
  }

  const [binUrl, jsonUrl] = await Promise.all([
    getDownloadURL(ref(storage, COFID_BIN_PATH)),
    getDownloadURL(ref(storage, COFID_JSON_PATH)),
  ]);

  const [binRes, jsonRes] = await Promise.all([fetch(binUrl), fetch(jsonUrl)]);

  const [binBuffer, indexData] = await Promise.all([
    binRes.arrayBuffer(),
    jsonRes.json() as Promise<CofidIndexEntry[]>,
  ]);

  cachedBin = new Float32Array(binBuffer);
  cachedIndex = indexData;

  return { entryCount: cachedIndex.length };
}

/**
 * Return the cached CoFID index (id, name, group) for client-side filtering.
 * Call `loadCofidData()` before using this.
 */
export function getCofidIndex(): CofidIndexEntry[] {
  if (!cachedIndex) {
    throw new Error('CoFID data not loaded. Call loadCofidData() first.');
  }
  return cachedIndex;
}

/**
 * Search the cached CoFID data using cosine similarity.
 * Call `loadCofidData()` before using this.
 */
export function searchCofidLocal(
  queryEmbedding: number[],
  topK: number = DEFAULT_TOP_K,
  threshold: number = SEARCH_THRESHOLD
): CofidSearchResult[] {
  if (!cachedBin || !cachedIndex) {
    throw new Error('CoFID data not loaded. Call loadCofidData() first.');
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
 * Call the searchCofid Cloud Function for a single query.
 * Useful at runtime without downloading the full binary corpus.
 */
export async function searchCofidByEmbedding(
  queryEmbedding: number[],
  topK: number = DEFAULT_TOP_K
): Promise<CofidSearchResult[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const idToken = await user.getIdToken(true);
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const endpoint = isLocalhost
    ? `http://localhost:5001/${PROJECT_ID}/${REGION}/searchCofid`
    : `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/searchCofid`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, queryEmbedding, topK }),
  });

  const data = (await res.json()) as { matches?: CofidSearchResult[]; error?: string };
  if (!res.ok) throw new Error(data.error || `searchCofid failed: HTTP ${res.status}`);

  return data.matches ?? [];
}
