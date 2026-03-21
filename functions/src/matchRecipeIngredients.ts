/**
 * matchRecipeIngredients Cloud Function
 *
 * Runs the ingredient matching pipeline server-side:
 *  - matchRecipeOnCreate: Firestore trigger on recipe creation
 *  - relinkRecipeIngredients: onCall callable for repair
 *
 * Pipeline per recipe:
 * 1. Parse raw ingredient lines with Gemini (direct SDK)
 * 2. Batch-embed ingredient names via Vertex AI
 * 3. Match each ingredient against canon items (fuzzy + semantic)
 * 4. Create pending canon items where no match exists
 * 5. Save new canon embeddings in a single Storage write
 * 6. Write matched ingredients + matchingStatus back to recipe
 *
 * Fixes vs client-side pipeline:
 *  - publishLocalToMaster() called once (not per new canon item) → eliminates ~57s runs
 *  - Ingredient IDs preserved across repair so instruction references survive
 *  - No ALREADY_EXISTS risk (no IndexedDB offline persistence in CF context)
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Guard: index.ts initialises admin first; this module may be loaded standalone
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ── Constants ──────────────────────────────────────────────────────────────────

const REGION = 'europe-west2';
const PROJECT_ID = 'gen-lang-client-0015061880';
const VERTEX_LOCATION = 'us-central1';
const DIM = 768;

const isEmulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
const DB_ID = isEmulator ? '(default)' : (process.env.FIRESTORE_DATABASE_ID || 'saltstore');

const MASTER_EMBEDDINGS_PATH = 'canon/embeddings/master-lookup.v1.json';

// Matching thresholds — must stay in sync with matchIngredient.ts
const FUZZY_THRESHOLD = 0.75;
const SEMANTIC_THRESHOLD = 0.70;
const AUTO_LINK_THRESHOLD = 0.85;
const MIN_SCORE_GAP = 0.15;

// ── Types ─────────────────────────────────────────────────────────────────────

interface AisleDoc {
  id: string;
  name: string;
  tier2: string;
  tier3: string;
}

interface UnitDoc {
  id: string;
  name: string;
  category: string;
}

interface ParsedIngredient {
  index: number;
  originalLine: string;
  itemName: string;
  quantity: number | null;
  recipeUnitId: string | null;
  unitName: string | null;
  aisleId: string;
}

interface CanonItemLight {
  id: string;
  name: string;
  aisleId: string;
}

interface EmbeddingEntry {
  id: string;           // IDB key path — must equal refId for canon items
  kind: 'canon';
  refId: string;
  name: string;
  aisleId: string;
  embedding: number[];
  embeddingModel: string;
  embeddingDim: number;
  createdAt: string;
}

interface MatchCandidate {
  canonItemId: string;
  name: string;
  score: number;
  method: 'exact' | 'fuzzy' | 'semantic';
}

// ── Module-scope Firestore singleton ─────────────────────────────────────────

let _db: admin.firestore.Firestore | null = null;

function getDb(): admin.firestore.Firestore {
  if (_db) return _db;
  _db = admin.firestore();
  try {
    _db.settings({ databaseId: DB_ID });
  } catch {
    // Settings already applied by index.ts init
  }
  return _db;
}

// Module-scope canon embeddings cache (survives warm invocations)
let cachedEmbeddings: EmbeddingEntry[] | null = null;

// ── Pure helpers ──────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function levenshteinSimilarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1.0;
  const dist = levenshteinDistance(na, nb);
  return 1 - dist / Math.max(na.length, nb.length, 1);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function coerceToNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /^\d+$/.test(key))
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, v]) => v)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (entries.length > 0) return entries;
  }
  return [];
}

// ── Matching logic ────────────────────────────────────────────────────────────

function matchIngredient(
  name: string,
  canonItems: CanonItemLight[],
  embeddings: EmbeddingEntry[],
  queryEmbedding: number[] | null
): { decision: 'use_existing' | 'create_new'; canonItemId?: string } {
  const fuzzyCandidates: MatchCandidate[] = [];
  for (const item of canonItems) {
    const score = levenshteinSimilarity(name, item.name);
    if (score >= FUZZY_THRESHOLD) {
      fuzzyCandidates.push({
        canonItemId: item.id,
        name: item.name,
        score,
        method: score === 1.0 ? 'exact' : 'fuzzy',
      });
    }
  }

  const semanticCandidates: MatchCandidate[] = [];
  if (queryEmbedding) {
    const canonItemIds = new Set(canonItems.map(i => i.id));
    for (const entry of embeddings) {
      if (!canonItemIds.has(entry.refId)) continue;
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      if (score >= SEMANTIC_THRESHOLD) {
        semanticCandidates.push({
          canonItemId: entry.refId,
          name: entry.name,
          score,
          method: 'semantic',
        });
      }
    }
  }

  // Merge candidates, keeping best score per item
  const map = new Map<string, MatchCandidate>();
  for (const c of [...fuzzyCandidates, ...semanticCandidates]) {
    const existing = map.get(c.canonItemId);
    if (!existing || c.score > existing.score) map.set(c.canonItemId, c);
  }

  const all = Array.from(map.values()).sort((a, b) => b.score - a.score);
  if (all.length === 0) return { decision: 'create_new' };

  const topScore = all[0].score;
  if (topScore < AUTO_LINK_THRESHOLD) return { decision: 'create_new' };

  const scoreGap = all.length > 1 ? topScore - all[1].score : topScore;
  if (all.length > 1 && scoreGap < MIN_SCORE_GAP) return { decision: 'create_new' };

  return { decision: 'use_existing', canonItemId: all[0].canonItemId };
}

// ── Vertex AI embeddings ──────────────────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const aiplatform = require('@google-cloud/aiplatform');
  const { PredictionServiceClient } = aiplatform.v1;
  const { helpers } = aiplatform;

  const client = new PredictionServiceClient({
    apiEndpoint: `${VERTEX_LOCATION}-aiplatform.googleapis.com`,
  });

  const endpoint = `projects/${PROJECT_ID}/locations/${VERTEX_LOCATION}/publishers/google/models/text-embedding-005`;
  const instances = texts.map((text: string) => helpers.toValue({ content: text }));

  const [response] = await client.predict({
    endpoint,
    instances,
    parameters: helpers.toValue({ autoTruncate: true }),
  });

  if (!response.predictions?.length) return texts.map(() => null);

  return (response.predictions as any[]).map((pred: any) => {
    // Path 1: nested protobuf structure
    const listValues = pred?.structValue?.fields?.embeddings?.structValue?.fields?.values?.listValue?.values;
    if (Array.isArray(listValues)) {
      const emb = listValues
        .map((v: any) => v?.numberValue)
        .filter((v: unknown): v is number => typeof v === 'number' && Number.isFinite(v));
      if (emb.length === DIM) return Array.from(emb);
    }

    // Path 2: direct embeddings.values
    const vals = pred?.embeddings?.values;
    if (vals) {
      const emb = coerceToNumberArray(vals);
      if (emb.length === DIM) return Array.from(emb);
    }

    // Path 3: coerce entire prediction
    const emb = coerceToNumberArray(pred);
    return emb.length === DIM ? Array.from(emb) : null;
  });
}

// ── Gemini ingredient parsing ─────────────────────────────────────────────────

async function parseIngredients(
  lines: string[],
  aisles: AisleDoc[],
  units: UnitDoc[]
): Promise<ParsedIngredient[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  // Build aisle map (food/drink aisles only)
  const foodAisles = aisles.filter(a => {
    const t3 = (a.tier3 ?? '').toLowerCase();
    return t3 === 'food' || t3 === 'drink';
  });
  const aisleNameToId = new Map<string, string>();
  const aisleDescriptions: string[] = [];
  for (const aisle of foodAisles) {
    const desc = `${aisle.tier2} / ${aisle.name}`;
    aisleNameToId.set(desc.toLowerCase(), aisle.id);
    aisleDescriptions.push(desc);
  }

  // Build unit map (standard units only)
  const standardUnits = units.filter(u => u.category !== 'colloquial');
  const unitNameToId = new Map<string, string>();
  const unitNames: string[] = [];
  for (const unit of standardUnits) {
    unitNameToId.set(unit.name.toLowerCase(), unit.id);
    unitNames.push(unit.name);
  }

  const unitById = new Map(units.map(u => [u.id, u]));

  const systemInstruction = [
    'You are a British culinary data extractor. Standardise ingredients to UK metric conventions.',
    '',
    'Available units: ' + unitNames.join(', '),
    'Available aisles: ' + aisleDescriptions.join(', '),
    '',
    'Rules:',
    '1. Units: Use ONLY from available units list. If not found, use null.',
    '2. Aisles: Use ONLY from available aisles list. Default to "Uncategorised".',
    '3. Formatting: Standardise units (e.g., "grams" -> "g"). Keep item to the core ingredient (e.g., "Maris Piper potatoes").',
    '4. Integrity: Do not invent data. If a quantity is missing, return null.',
  ].join('\n');

  const responseSchema = {
    type: 'object' as const,
    properties: {
      results: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            index: { type: 'number' as const },
            originalLine: { type: 'string' as const },
            quantity: { type: 'number' as const, nullable: true },
            unit: { type: 'string' as const, nullable: true },
            item: { type: 'string' as const },
            prep: { type: 'string' as const, nullable: true },
            notes: { type: 'string' as const, nullable: true },
            aisle: { type: 'string' as const },
          },
          required: ['index', 'originalLine', 'item', 'aisle'],
        },
      },
    },
  };

  const parseModel = process.env.GEMINI_PARSE_MODEL || 'gemini-3.1-flash-lite-preview';
  const maxOutputTokens = Math.max(512, lines.length * 96);

  const response = await ai.models.generateContent({
    model: parseModel,
    contents: [{ role: 'user', parts: [{ text: lines.join('\n') }] }],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0,
      topP: 0.1,
      maxOutputTokens,
      thinkingLevel: 'low',
    },
  });

  const text: string =
    response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text as string)
      .join('') || '{}';

  const parsed = JSON.parse(text) as { results?: any[] };
  const rawResults = parsed.results ?? [];

  return rawResults
    .sort((a: any, b: any) => a.index - b.index)
    .map((r: any) => {
      const aisleName = String(r.aisle || '').trim();
      const aisleId = aisleNameToId.get(aisleName.toLowerCase()) ?? 'uncategorised';
      const unitName: string | null = r.unit ? String(r.unit).trim() : null;
      const recipeUnitId = unitName ? unitNameToId.get(unitName.toLowerCase()) ?? null : null;
      const resolvedUnit = recipeUnitId ? unitById.get(recipeUnitId) : null;

      return {
        index: r.index as number,
        originalLine: String(r.originalLine || ''),
        itemName: String(r.item || ''),
        quantity: typeof r.quantity === 'number' ? r.quantity : null,
        recipeUnitId,
        unitName: resolvedUnit?.name ?? null,
        aisleId,
      } as ParsedIngredient;
    });
}

// ── Canon embeddings I/O ──────────────────────────────────────────────────────

async function loadCanonEmbeddings(): Promise<EmbeddingEntry[]> {
  if (cachedEmbeddings) return cachedEmbeddings;

  const bucket = admin.storage().bucket();
  try {
    const [buffer] = await bucket.file(MASTER_EMBEDDINGS_PATH).download();
    const payload = JSON.parse(buffer.toString('utf-8'));
    const entries: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.entries)
      ? payload.entries
      : [];
    cachedEmbeddings = entries
      .filter((e): e is EmbeddingEntry => e.kind === 'canon' && Array.isArray(e.embedding))
      // Back-fill id for any entries written before this fix
      .map(e => ({ ...e, id: e.id ?? e.refId }));
    return cachedEmbeddings;
  } catch (err: any) {
    // File doesn't exist yet — start with empty set
    if (
      err?.code === 404 ||
      String(err?.message).includes('No such object') ||
      String(err?.message).includes('not found')
    ) {
      cachedEmbeddings = [];
      return [];
    }
    throw err;
  }
}

async function saveCanonEmbeddings(newEntries: EmbeddingEntry[]): Promise<void> {
  if (newEntries.length === 0) return;

  const existing = await loadCanonEmbeddings();
  const map = new Map(existing.map(e => [e.refId, e]));
  for (const entry of newEntries) {
    map.set(entry.refId, entry);
  }

  const allEntries = Array.from(map.values());
  const snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    entryCount: allEntries.length,
    entries: allEntries,
  };

  const bucket = admin.storage().bucket();
  await bucket.file(MASTER_EMBEDDINGS_PATH).save(JSON.stringify(snapshot), {
    contentType: 'application/json',
  });

  cachedEmbeddings = allEntries;
  console.log(`[matchRecipeIngredients] Saved ${newEntries.length} new canon embeddings (${allEntries.length} total)`);
}

// ── CoFID auto-linking ───────────────────────────────────────────────────────

const COFID_DATA_DIR = path.join(__dirname, '..', 'data', 'cofid');
const COFID_BIN_PATH = path.join(COFID_DATA_DIR, 'combined-v1.bin');
const COFID_JSON_PATH = path.join(COFID_DATA_DIR, 'combined-v1.json');
const COFID_DIM = 768;
const COFID_AUTO_LINK_THRESHOLD = 0.80;
const COFID_AUTO_LINK_GAP = 0.02;

let cachedCofidBin: Float32Array | null = null;
let cachedCofidIndex: Array<{ id: string; name: string; group: string }> | null = null;

function loadCofidData(): void {
  if (cachedCofidBin && cachedCofidIndex) return;
  const binBuffer = fs.readFileSync(COFID_BIN_PATH);
  const ab = binBuffer.buffer.slice(binBuffer.byteOffset, binBuffer.byteOffset + binBuffer.byteLength);
  cachedCofidBin = new Float32Array(ab);
  cachedCofidIndex = JSON.parse(fs.readFileSync(COFID_JSON_PATH, 'utf-8'));
}

function searchCofidByEmbedding(
  query: number[],
  topK: number = 1
): Array<{ id: string; name: string; group: string; score: number }> {
  if (!cachedCofidBin || !cachedCofidIndex) return [];
  const N = cachedCofidIndex.length;
  let qNorm = 0;
  for (let i = 0; i < COFID_DIM; i++) qNorm += query[i] * query[i];
  qNorm = Math.sqrt(qNorm);
  if (qNorm === 0) return [];

  const scores: Array<{ row: number; score: number }> = [];
  for (let row = 0; row < N; row++) {
    let dot = 0, cNorm = 0;
    const offset = row * COFID_DIM;
    for (let i = 0; i < COFID_DIM; i++) {
      const c = cachedCofidBin![offset + i];
      dot += query[i] * c;
      cNorm += c * c;
    }
    const score = cNorm > 0 ? dot / (qNorm * Math.sqrt(cNorm)) : 0;
    scores.push({ row, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK).map(({ row, score }) => ({ ...cachedCofidIndex![row], score }));
}

async function autoLinkCofidIfMatch(
  db: admin.firestore.Firestore,
  canonItemId: string,
  embedding: number[]
): Promise<void> {
  try {
    loadCofidData();
    const hits = searchCofidByEmbedding(embedding, 2);
    const best = hits[0];
    const second = hits[1];
    if (!best || best.score < COFID_AUTO_LINK_THRESHOLD) return;
    if (second && best.score - second.score < COFID_AUTO_LINK_GAP) return;

    const now = new Date().toISOString();
    const cofidLink = {
      source: 'cofid',
      externalId: best.id,
      confidence: best.score,
      matchMethod: 'auto',
      properties: { name: best.name, group: best.group },
      syncedAt: now,
    };
    await db.collection('canonItems').doc(canonItemId).update({
      externalSources: FieldValue.arrayUnion(cofidLink),
      updatedAt: now,
    });
    console.log(`[matchRecipeIngredients] Auto-linked canon item ${canonItemId} to CoFID ${best.id} (score ${best.score.toFixed(3)})`);
  } catch (err) {
    console.warn(`[matchRecipeIngredients] CoFID auto-link failed for ${canonItemId}:`, err);
  }
}

// ── Canon item creation ─────────────────────────────────────────────────────────

async function createCanonItem(
  db: admin.firestore.Firestore,
  name: string,
  aisleId: string,
  aisleById: Map<string, AisleDoc>
): Promise<CanonItemLight> {
  const now = new Date().toISOString();
  const lowerName = name.toLowerCase().trim();
  const aisle = aisleById.get(aisleId);
  const aisleSnapshot = aisle
    ? { tier1: aisle.name, tier2: aisle.tier2, tier3: aisle.tier3 }
    : { tier1: 'Uncategorised', tier2: 'Uncategorised', tier3: 'Uncategorised' };

  const docRef = await db.collection('canonItems').add({
    name: lowerName,
    normalisedName: lowerName,
    synonyms: [],
    aisleId,
    aisle: aisleSnapshot,
    unit: { canonical_unit: 'g', density_g_per_ml: null },
    isStaple: false,
    itemType: 'ingredient',
    allergens: [],
    barcodes: [],
    externalSources: [],
    approved: false,
    createdAt: now,
  });

  return { id: docRef.id, name: lowerName, aisleId };
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function runMatchingPipeline(recipeId: string): Promise<void> {
  const db = getDb();
  const recipeRef = db.collection('recipes').doc(recipeId);

  const recipeSnap = await recipeRef.get();
  if (!recipeSnap.exists) {
    console.log(`[matchRecipeIngredients] Recipe ${recipeId} not found`);
    return;
  }

  const recipeData = recipeSnap.data()!;

  // Skip if already matched or in-progress
  const currentStatus = recipeData.matchingStatus;
  if (currentStatus === 'matching' || currentStatus === 'matched') {
    console.log(`[matchRecipeIngredients] Recipe ${recipeId} already in status '${currentStatus}', skipping`);
    return;
  }

  await recipeRef.update({ matchingStatus: 'matching' });

  try {
    // Collect raw ingredient lines from existing recipe data
    const rawLines: string[] = Array.isArray(recipeData.ingredients)
      ? (recipeData.ingredients as any[])
          .map((ing: any) =>
            typeof ing === 'string' ? ing : String(ing.raw || ing.ingredientName || '')
          )
          .filter(Boolean)
      : [];

    if (rawLines.length === 0) {
      await recipeRef.update({ matchingStatus: 'matched' });
      return;
    }

    // Load reference data
    const [aislesSnap, unitsSnap] = await Promise.all([
      db.collection('canonAisles').orderBy('sortOrder').get(),
      db.collection('canonUnits').orderBy('sortOrder').get(),
    ]);

    const aisles: AisleDoc[] = aislesSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AisleDoc, 'id'>) }));
    const units: UnitDoc[] = unitsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<UnitDoc, 'id'>) }));
    const aisleById = new Map(aisles.map(a => [a.id, a]));
    const unitById = new Map(units.map(u => [u.id, u]));

    // Parse ingredients with Gemini
    const parsed = await parseIngredients(rawLines, aisles, units);
    if (parsed.length === 0) {
      await recipeRef.update({
        matchingStatus: 'failed',
        matchingError: 'AI ingredient parsing returned no results',
      });
      return;
    }

    // Batch-embed all ingredient names
    let batchEmbeddings: (number[] | null)[];
    try {
      batchEmbeddings = await generateEmbeddings(parsed.map(p => p.itemName));
    } catch (err) {
      console.warn('[matchRecipeIngredients] Embedding generation failed, falling back to fuzzy-only:', err);
      batchEmbeddings = parsed.map(() => null);
    }

    // Load canon items and embeddings in parallel
    const [canonItemsSnap, canonEmbeddings] = await Promise.all([
      db.collection('canonItems').get(),
      loadCanonEmbeddings(),
    ]);

    const canonItems: CanonItemLight[] = canonItemsSnap.docs.map(d => ({
      id: d.id,
      name: String(d.data().name ?? ''),
      aisleId: String(d.data().aisleId ?? 'uncategorised'),
    }));

    // Build raw→id map to preserve ingredient IDs across repairs
    const existingIngredients: any[] = Array.isArray(recipeData.ingredients)
      ? (recipeData.ingredients as any[])
      : [];
    const rawToId = new Map<string, string>();
    for (const ing of existingIngredients) {
      if (ing?.raw && ing?.id) rawToId.set(ing.raw, ing.id);
    }

    // Match each ingredient, creating canon items where needed
    const newEmbeddingEntries: EmbeddingEntry[] = [];
    const matchedIngredients: any[] = [];
    const cofidLinkPromises: Promise<void>[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const queryEmbedding = batchEmbeddings[i] ?? null;
      const ingredientId = rawToId.get(p.originalLine) ?? randomUUID();

      const result = matchIngredient(p.itemName, canonItems, canonEmbeddings, queryEmbedding);

      let canonicalItemId: string | undefined;

      if (result.decision === 'use_existing' && result.canonItemId) {
        canonicalItemId = result.canonItemId;
      } else {
        const newItem = await createCanonItem(db, p.itemName, p.aisleId, aisleById);
        canonicalItemId = newItem.id;

        // Update local context so subsequent ingredients can match this item
        canonItems.push(newItem);

        // Auto-link to CoFID if there is a high-confidence match
        if (queryEmbedding) {
          cofidLinkPromises.push(autoLinkCofidIfMatch(db, newItem.id, queryEmbedding));
        }

        if (queryEmbedding) {
          const entry: EmbeddingEntry = {
            id: newItem.id,
            kind: 'canon',
            refId: newItem.id,
            name: newItem.name,
            aisleId: newItem.aisleId,
            embedding: queryEmbedding,
            embeddingModel: 'text-embedding-005',
            embeddingDim: queryEmbedding.length,
            createdAt: new Date().toISOString(),
          };
          newEmbeddingEntries.push(entry);
          canonEmbeddings.push(entry); // Update local cache for subsequent iterations
        }
      }

      const resolvedUnit = p.recipeUnitId ? unitById.get(p.recipeUnitId) : null;

      matchedIngredients.push({
        id: ingredientId,
        raw: p.originalLine,
        quantity: p.quantity,
        unit: resolvedUnit?.name ?? null,
        ingredientName: p.itemName,
        canonicalItemId,
        parsedAt: new Date().toISOString(),
        parserVersion: 2,
        matchedAt: new Date().toISOString(),
      });
    }

    // Save all new embeddings in one Storage write
    await saveCanonEmbeddings(newEmbeddingEntries);

    // Await all CoFID auto-link writes before the function returns
    if (cofidLinkPromises.length > 0) {
      await Promise.all(cofidLinkPromises);
    }

    // Update instruction ingredient references if they exist
    let updatedInstructions = recipeData.instructions;
    if (Array.isArray(updatedInstructions)) {
      const ingredientMap = new Map(matchedIngredients.map((ing: any) => [ing.id, ing]));
      updatedInstructions = updatedInstructions.map((instr: any) => {
        if (instr.ingredients && Array.isArray(instr.ingredients)) {
          return {
            ...instr,
            ingredients: instr.ingredients
              .map((ing: any) => ingredientMap.get(ing.id) || ing)
              .filter(Boolean),
          };
        }
        return instr;
      });
    }

    const recipeUpdate: any = {
      ingredients: matchedIngredients,
      matchingStatus: 'matched',
      matchingError: FieldValue.delete(),
    };
    if (updatedInstructions !== recipeData.instructions) {
      recipeUpdate.instructions = updatedInstructions;
    }

    await recipeRef.update(recipeUpdate);

    console.log(
      `[matchRecipeIngredients] Matched ${matchedIngredients.length} ingredients for recipe ${recipeId}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[matchRecipeIngredients] Pipeline failed for recipe ${recipeId}:`, err);
    await recipeRef.update({
      matchingStatus: 'failed',
      matchingError: message,
    });
    throw err;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const matchRecipeOnCreate = onDocumentCreated(
  {
    document: 'recipes/{recipeId}',
    database: DB_ID,
    region: REGION,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    const recipeId = event.params.recipeId;
    console.log(`[matchRecipeOnCreate] Triggered for recipe ${recipeId}`);
    await runMatchingPipeline(recipeId);
  }
);

export const relinkRecipeIngredients = onCall(
  {
    region: REGION,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { recipeId } = request.data as { recipeId?: string };
    if (!recipeId || typeof recipeId !== 'string') {
      throw new HttpsError('invalid-argument', 'recipeId is required');
    }

    console.log(
      `[relinkRecipeIngredients] Repair requested for recipe ${recipeId} by ${request.auth.uid}`
    );

    // Allow re-run of failed recipes or explicit repair of matched recipes
    const db = getDb();
    const recipeRef = db.collection('recipes').doc(recipeId);
    const snap = await recipeRef.get();
    if (snap.exists && snap.data()?.matchingStatus === 'matching') {
      return { success: false, message: 'Already matching — please wait' };
    }

    // Reset status so pipeline runs
    if (snap.exists) {
      await recipeRef.update({ matchingStatus: 'pending' });
    }

    try {
      await runMatchingPipeline(recipeId);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpsError('internal', `Matching pipeline failed: ${message}`);
    }
  }
);
