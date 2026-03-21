#!/usr/bin/env node

/**
 * Build CoFID Embeddings
 *
 * Reads pre-computed embeddings from the CoFID backup JSON and packs them
 * into the same binary format used by FDC: a Float32Array .bin + a JSON index.
 * Uploads both to Firebase Storage.
 *
 * No embedding generation is performed — embeddings are read from the backup.
 *
 * PREREQUISITES:
 *   gcloud auth application-default login
 *
 * USAGE:
 *   node seed-data/scripts/build-cofid-embeddings.mjs
 *
 * Flags:
 *   --dry-run    Validate input and show summary without uploading
 *
 * Outputs (Firebase Storage):
 *   cofid/embeddings/combined-v1.bin   — Float32Array, row-major, N × 768 floats
 *   cofid/embeddings/combined-v1.json  — [{row, id, name, group}]
 *
 * Local copies (for inspection):
 *   seed-data/cofid/combined-v1.bin
 *   seed-data/cofid/combined-v1.json
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'gen-lang-client-0015061880.firebasestorage.app';
const DIM = 768;

const BACKUP_FILE = path.join(__dirname, '../cofid-items.backup.v1.json');
const OUT_DIR = path.join(__dirname, '../cofid');
const LOCAL_BIN = path.join(OUT_DIR, 'combined-v1.bin');
const LOCAL_JSON = path.join(OUT_DIR, 'combined-v1.json');

const isDryRun = process.argv.includes('--dry-run');

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

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 CoFID Embeddings Build Script\n');
  if (isDryRun) console.log('📋 DRY RUN — no uploads will be performed\n');

  // 1. Load backup
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`❌ Backup file not found: ${BACKUP_FILE}`);
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
  console.log(`✓ Loaded ${backup.length} CoFID items from backup`);

  // 2. Validate embeddings
  const valid = backup.filter(entry => Array.isArray(entry.data?.embedding) && entry.data.embedding.length === DIM);
  const skipped = backup.length - valid.length;
  if (skipped > 0) {
    console.warn(`⚠ Skipping ${skipped} entries with missing/invalid embeddings`);
  }
  console.log(`✓ ${valid.length} items have valid ${DIM}-dim embeddings`);

  if (isDryRun) {
    console.log(`\n📋 DRY RUN summary:`);
    console.log(`  Total items: ${backup.length}`);
    console.log(`  Valid embeddings: ${valid.length}`);
    console.log(`  Estimated binary size: ~${Math.round(valid.length * DIM * 4 / 1024 / 1024)} MB`);
    console.log(`  JSON index size: ~${Math.round(valid.length * 60 / 1024)} KB`);
    process.exit(0);
  }

  // 3. Pack binary and build JSON index
  console.log('\n📦 Packing binary...');
  const bin = new Float32Array(valid.length * DIM);
  const indexEntries = [];

  for (let i = 0; i < valid.length; i++) {
    const { data } = valid[i];
    bin.set(data.embedding, i * DIM);
    indexEntries.push({
      row: i,
      id: data.id,
      name: data.name,
      group: data.group,
    });
  }

  const binBuffer = Buffer.from(bin.buffer);
  const jsonStr = JSON.stringify(indexEntries);
  console.log(`✓ Packed ${valid.length} items (${Math.round(binBuffer.length / 1024 / 1024)} MB binary, ${Math.round(jsonStr.length / 1024)} KB JSON)`);

  // 4. Write local copies
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_BIN, binBuffer);
  fs.writeFileSync(LOCAL_JSON, jsonStr);
  console.log(`✓ Local copies written to seed-data/cofid/`);

  // 5. Upload to Firebase Storage
  console.log('\n⬆  Uploading to Firebase Storage...');
  const bucket = admin.storage(app).bucket(STORAGE_BUCKET);

  await bucket.file('cofid/embeddings/combined-v1.bin').save(binBuffer, {
    contentType: 'application/octet-stream',
    metadata: { cacheControl: 'no-cache' },
  });
  console.log('✓ Uploaded cofid/embeddings/combined-v1.bin');

  await bucket.file('cofid/embeddings/combined-v1.json').save(jsonStr, {
    contentType: 'application/json',
    metadata: { cacheControl: 'no-cache' },
  });
  console.log('✓ Uploaded cofid/embeddings/combined-v1.json');

  console.log(`\n✅ Done! ${valid.length} CoFID items packed and published to Firebase Storage.`);
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
