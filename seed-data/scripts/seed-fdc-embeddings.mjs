#!/usr/bin/env node

/**
 * Seed FDC Embeddings
 *
 * Generates text embeddings for USDA FDC Foundation + SR Legacy food descriptions
 * and uploads a packed Float32Array binary + JSON index to Firebase Storage.
 *
 * PREREQUISITES:
 *   gcloud auth application-default login
 *
 * USAGE:
 *   node seed-data/scripts/seed-fdc-embeddings.mjs
 *
 * Flags:
 *   --dry-run    Validate inputs and show summary without uploading
 *   --rebuild    Ignore existing checkpoint and regenerate all embeddings
 *
 * Outputs (Firebase Storage):
 *   fdc/embeddings/combined-v1.bin   — Float32Array, row-major, N × 768 floats
 *   fdc/embeddings/combined-v1.json  — [{row, fdcId, description, dataType, portions[]}]
 *
 * Local checkpoint (resumable):
 *   seed-data/fdc-embeddings-checkpoint.json  — {fdcId: embedding[]}
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Constants ──────────────────────────────────────────────────────────────

const PROJECT_ID = 'gen-lang-client-0015061880';
const VERTEX_LOCATION = 'us-central1';
const VERTEX_MODEL = 'text-embedding-005';
const STORAGE_BUCKET = 'gen-lang-client-0015061880.firebasestorage.app';

const DIM = 768;
const EMBED_BATCH_SIZE = 100;

const FOUNDATION_FILE = path.join(__dirname, '../FDC-Foundation.json');
const SR_LEGACY_FILE = path.join(__dirname, '../FDC-SR-Legacy.json');
const CHECKPOINT_FILE = path.join(__dirname, '../fdc-embeddings-checkpoint.json');

const isDryRun = process.argv.includes('--dry-run');
const isRebuild = process.argv.includes('--rebuild');

// ── Firebase Admin init ────────────────────────────────────────────────────

let app;
try {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    app = admin.initializeApp();
  }
} catch (error) {
  console.error('❌ Failed to initialise Firebase Admin:', error.message);
  process.exit(1);
}

// ── Vertex AI embeddings ───────────────────────────────────────────────────

/**
 * Generate embeddings via Vertex AI text-embedding-005 using ADC credentials.
 * Returns a parallel array of embeddings (same length as texts).
 */
async function generateEmbeddings(texts) {
  const aiplatform = await import(
    new URL('../../functions/node_modules/@google-cloud/aiplatform/build/src/index.js', import.meta.url).href
  );
  const { PredictionServiceClient } = aiplatform.v1;
  const { helpers } = aiplatform;

  const client = new PredictionServiceClient({
    apiEndpoint: `${VERTEX_LOCATION}-aiplatform.googleapis.com`,
  });

  const endpoint = `projects/${PROJECT_ID}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}`;

  const instances = texts.map(text => helpers.toValue({ content: text }));
  const [response] = await client.predict({
    endpoint,
    instances,
    parameters: helpers.toValue({ autoTruncate: true }),
  });

  if (!response.predictions || response.predictions.length === 0) {
    throw new Error('Empty predictions from Vertex AI');
  }

  return response.predictions.map((pred, idx) => {
    // Path 1: nested protobuf structure
    const listValues = pred?.structValue?.fields?.embeddings?.structValue?.fields?.values?.listValue?.values;
    if (Array.isArray(listValues) && listValues.length > 0) {
      return listValues
        .map(v => v?.numberValue)
        .filter(v => typeof v === 'number' && Number.isFinite(v));
    }

    // Path 2: direct embeddings.values
    const vals = pred?.embeddings?.values;
    if (vals) {
      if (Array.isArray(vals) && vals.length > 0) return Array.from(vals);
      const entries = Object.entries(vals)
        .filter(([k]) => /^\d+$/.test(k))
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, v]) => v)
        .filter(v => typeof v === 'number' && Number.isFinite(v));
      if (entries.length > 0) return entries;
    }

    throw new Error(`Could not extract embedding for prediction ${idx}`);
  });
}

// ── FDC data loading ───────────────────────────────────────────────────────

function loadFdcFoods() {
  const byFdcId = new Map();

  if (fs.existsSync(FOUNDATION_FILE)) {
    const raw = JSON.parse(fs.readFileSync(FOUNDATION_FILE, 'utf-8'));
    const foods = raw.FoundationFoods || [];
    for (const food of foods) {
      if (food.fdcId && food.foodPortions?.length > 0) {
        byFdcId.set(food.fdcId, { ...food, dataType: 'Foundation' });
      }
    }
    console.log(`✓ Foundation: ${foods.length} foods, ${byFdcId.size} with portions`);
  } else {
    console.warn(`⚠ Foundation file not found: ${FOUNDATION_FILE}`);
  }

  if (fs.existsSync(SR_LEGACY_FILE)) {
    const raw = JSON.parse(fs.readFileSync(SR_LEGACY_FILE, 'utf-8'));
    // Bulk download uses 'SRLegacyFoods'; verify on download if key differs
    const foods = raw.SRLegacyFoods || raw.FoundationFoods || Object.values(raw)[0] || [];
    let added = 0;
    for (const food of foods) {
      if (food.fdcId && food.foodPortions?.length > 0 && !byFdcId.has(food.fdcId)) {
        byFdcId.set(food.fdcId, { ...food, dataType: 'SR Legacy' });
        added++;
      }
    }
    console.log(`✓ SR Legacy: ${foods.length} foods, ${added} added (Foundation wins on conflicts)`);
  } else {
    console.log(`ℹ SR Legacy file not found — using Foundation only`);
  }

  return [...byFdcId.values()];
}


// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 FDC Embeddings Seed Script\n');
  if (isDryRun) console.log('📋 DRY RUN — no uploads will be performed');
  if (isRebuild) console.log('🔄 REBUILD — ignoring existing checkpoint\n');

  // 1. Load FDC foods
  const foods = loadFdcFoods();
  console.log(`\n📦 Total foods to embed: ${foods.length}`);

  if (foods.length === 0) {
    console.error('❌ No foods found with portions data. Exiting.');
    process.exit(1);
  }

  // 2. Load checkpoint
  let checkpoint = {};
  if (!isRebuild && fs.existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    console.log(`✓ Checkpoint: ${Object.keys(checkpoint).length} embeddings already generated`);
  }

  if (isDryRun) {
    const remaining = foods.filter(f => !checkpoint[String(f.fdcId)]).length;
    console.log(`\n📋 DRY RUN summary:`);
    console.log(`  Total foods: ${foods.length}`);
    console.log(`  Already embedded: ${foods.length - remaining}`);
    console.log(`  Remaining: ${remaining}`);
    console.log(`  Estimated binary size: ~${Math.round(foods.length * DIM * 4 / 1024 / 1024)} MB`);
    process.exit(0);
  }

  // 3. Generate embeddings for remaining foods
  const toEmbed = foods.filter(f => !checkpoint[String(f.fdcId)]);
  if (toEmbed.length > 0) {
    console.log(`\n🧮 Generating embeddings for ${toEmbed.length} foods in batches of ${EMBED_BATCH_SIZE}...`);

    const totalBatches = Math.ceil(toEmbed.length / EMBED_BATCH_SIZE);
    for (let i = 0; i < toEmbed.length; i += EMBED_BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + EMBED_BATCH_SIZE);
      const batchNum = Math.floor(i / EMBED_BATCH_SIZE) + 1;

      try {
        const embeddings = await generateEmbeddings(batch.map(f => f.description));

        for (let j = 0; j < batch.length; j++) {
          if (embeddings[j] && embeddings[j].length === DIM) {
            checkpoint[String(batch[j].fdcId)] = embeddings[j];
          } else {
            console.warn(`  ⚠ Missing embedding for fdcId ${batch[j].fdcId}`);
          }
        }

        const total = Object.keys(checkpoint).length;
        console.log(`  ✓ Batch ${batchNum}/${totalBatches} — ${total}/${foods.length} total`);
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint));
      } catch (error) {
        console.error(`  ❌ Batch ${batchNum} failed: ${error.message}`);
        console.log('  Checkpoint saved. Re-run to continue from here.');
        process.exit(1);
      }
    }
  } else {
    console.log('\n✓ All embeddings already in checkpoint');
  }

  // 5. Pack binary and build JSON index
  console.log('\n📦 Packing binary...');
  const indexEntries = [];
  const allBin = new Float32Array(foods.length * DIM);
  let validCount = 0;

  for (const food of foods) {
    const embedding = checkpoint[String(food.fdcId)];
    if (!embedding || embedding.length !== DIM) {
      console.warn(`  ⚠ Missing/invalid embedding for fdcId ${food.fdcId}, skipping`);
      continue;
    }

    allBin.set(embedding, validCount * DIM);

    indexEntries.push({
      row: validCount,
      fdcId: food.fdcId,
      description: food.description,
      dataType: food.dataType,
      portions: (food.foodPortions || []).map(p => ({
        gramWeight: p.gramWeight,
        amount: p.amount,
        measureUnit: {
          id: p.measureUnit?.id ?? 0,
          name: p.measureUnit?.name ?? '',
          abbreviation: p.measureUnit?.abbreviation ?? '',
        },
        modifier: p.modifier ?? '',
      })),
    });

    validCount++;
  }

  const bin = allBin.slice(0, validCount * DIM);
  const binBuffer = Buffer.from(bin.buffer);
  const jsonStr = JSON.stringify(indexEntries);

  console.log(`✓ Packed ${validCount} foods (${Math.round(binBuffer.length / 1024 / 1024)} MB binary, ${Math.round(jsonStr.length / 1024)} KB JSON)`);

  // 6. Upload to Firebase Storage
  console.log('\n⬆  Uploading to Firebase Storage...');
  const bucket = admin.storage(app).bucket(STORAGE_BUCKET);

  await bucket.file('fdc/embeddings/combined-v1.bin').save(binBuffer, {
    contentType: 'application/octet-stream',
    metadata: { cacheControl: 'no-cache' },
  });
  console.log('✓ Uploaded fdc/embeddings/combined-v1.bin');

  await bucket.file('fdc/embeddings/combined-v1.json').save(jsonStr, {
    contentType: 'application/json',
    metadata: { cacheControl: 'no-cache' },
  });
  console.log('✓ Uploaded fdc/embeddings/combined-v1.json');

  console.log(`\n✅ Done! ${validCount} FDC foods embedded and published to Firebase Storage.`);
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
