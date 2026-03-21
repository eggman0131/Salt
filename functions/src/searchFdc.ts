import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Guard: index.ts initialises admin first; this module may be loaded standalone in tests
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();

// FDC data bundled with the function package (loaded from local filesystem)
const DATA_DIR = path.join(__dirname, '..', 'data', 'fdc');
const LOCAL_BIN_PATH = path.join(DATA_DIR, 'combined-v1.bin');
const LOCAL_JSON_PATH = path.join(DATA_DIR, 'combined-v1.json');

const DIM = 768;
const DEFAULT_TOP_K = 5;
const DEFAULT_THRESHOLD = 0.70;

interface FdcPortion {
  gramWeight: number;
  amount: number;
  measureUnit: { id: number; name: string; abbreviation: string };
  modifier: string;
}

interface FdcIndexEntry {
  row: number;
  fdcId: number;
  description: string;
  dataType: string;
  portions: FdcPortion[];
}

// Module-scope cache — survives warm Cloud Function invocations
let cachedBin: Float32Array | null = null;
let cachedIndex: FdcIndexEntry[] | null = null;

function loadFdcData(): void {
  if (cachedBin && cachedIndex) return;

  const binBuffer = fs.readFileSync(LOCAL_BIN_PATH);
  const jsonBuffer = fs.readFileSync(LOCAL_JSON_PATH, 'utf-8');

  // Convert Node.js Buffer to Float32Array, respecting the buffer's byte offset
  const ab = binBuffer.buffer.slice(
    binBuffer.byteOffset,
    binBuffer.byteOffset + binBuffer.byteLength
  );
  cachedBin = new Float32Array(ab);
  cachedIndex = JSON.parse(jsonBuffer) as FdcIndexEntry[];

  console.log(`[searchFdc] Loaded ${cachedIndex.length} FDC entries from bundled data (${Math.round(binBuffer.length / 1024 / 1024)} MB)`);
}

function cosineSearch(
  query: number[],
  corpus: Float32Array,
  N: number,
  topK: number,
  threshold: number
): Array<{ row: number; score: number }> {
  let qNorm = 0;
  for (let i = 0; i < DIM; i++) qNorm += query[i] * query[i];
  qNorm = Math.sqrt(qNorm);
  if (qNorm === 0) return [];

  const scores: Array<{ row: number; score: number }> = [];

  for (let row = 0; row < N; row++) {
    let dot = 0;
    let cNorm = 0;
    const offset = row * DIM;
    for (let i = 0; i < DIM; i++) {
      const c = corpus[offset + i];
      dot += query[i] * c;
      cNorm += c * c;
    }
    const score = cNorm > 0 ? dot / (qNorm * Math.sqrt(cNorm)) : 0;
    if (score >= threshold) {
      scores.push({ row, score });
    }
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, topK);
}

const functionsConfig = { region: 'europe-west2' };

export const searchFdc = functions.https.onRequest(
  functionsConfig,
  async (req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use POST.' });
      return;
    }

    const { idToken, queryEmbedding, topK } = req.body ?? {};

    if (!idToken) {
      res.status(400).json({ error: 'Missing idToken' });
      return;
    }

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== DIM) {
      res.status(400).json({ error: `queryEmbedding must be an array of ${DIM} numbers` });
      return;
    }

    try {
      await auth.verifyIdToken(idToken);
    } catch {
      res.status(401).json({ error: 'Invalid authentication token' });
      return;
    }

    try {
      loadFdcData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load FDC data';
      res.status(500).json({ error: `FDC data unavailable: ${message}` });
      return;
    }

    const N = cachedIndex!.length;
    const k = typeof topK === 'number' ? Math.min(topK, 20) : DEFAULT_TOP_K;
    const hits = cosineSearch(queryEmbedding, cachedBin!, N, k, DEFAULT_THRESHOLD);

    const matches = hits.map(({ row, score }) => ({
      ...cachedIndex![row],
      score,
    }));

    res.status(200).json({ matches });
  }
);

module.exports = { searchFdc };
