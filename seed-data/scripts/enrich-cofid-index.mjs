#!/usr/bin/env node

/**
 * Enrich CoFID Index with Nutrition Data
 *
 * Reads nutrients from cofid-backup-2026-02-28.json and merges them into
 * the two copies of combined-v1.json used at build time:
 *   - seed-data/cofid/combined-v1.json   (imported by the app)
 *   - functions/data/cofid/combined-v1.json  (bundled with Cloud Function)
 *
 * After running this script, commit both files and redeploy the Cloud Function.
 * No Firebase credentials needed — no network calls.
 *
 * USAGE:
 *   node seed-data/scripts/enrich-cofid-index.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKUP_FILE = path.join(__dirname, '../cofid-backup-2026-02-28.json');
const INDEX_FILE = path.join(__dirname, '../cofid/combined-v1.json');
const FUNCTIONS_INDEX_FILE = path.join(__dirname, '../../functions/data/cofid/combined-v1.json');

const isDryRun = process.argv.includes('--dry-run');

// 1. Load backup
console.log(`Reading backup from ${path.basename(BACKUP_FILE)}...`);
const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
const nutrientMap = new Map();
let nullNutrients = 0;

for (const doc of backup.documents) {
  const { id, nutrients } = doc.data;
  if (nutrients && typeof nutrients === 'object') {
    nutrientMap.set(id, nutrients);
  } else {
    nullNutrients++;
  }
}
console.log(`${nutrientMap.size} items with nutrients, ${nullNutrients} without\n`);

// 2. Load current index
console.log(`Reading current index from ${path.basename(INDEX_FILE)}...`);
const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
console.log(`${index.length} index entries\n`);

// 3. Merge nutrients
let enriched = 0;
let missing = 0;
const enrichedIndex = index.map(entry => {
  const nutrients = nutrientMap.get(entry.id) ?? null;
  if (nutrients) enriched++;
  else missing++;
  return { ...entry, nutrients };
});

console.log('Enrichment summary:');
console.log(`  Enriched: ${enriched}`);
console.log(`  No nutrients found: ${missing}\n`);

if (isDryRun) {
  console.log('DRY RUN complete. Sample entry:');
  console.log(JSON.stringify(enrichedIndex[0], null, 2));
  process.exit(0);
}

// 4. Write both local files
fs.writeFileSync(INDEX_FILE, JSON.stringify(enrichedIndex));
console.log(`Written: ${INDEX_FILE}`);

fs.writeFileSync(FUNCTIONS_INDEX_FILE, JSON.stringify(enrichedIndex));
console.log(`Written: ${FUNCTIONS_INDEX_FILE}`);

console.log('\nDone. Commit both files and redeploy the Cloud Function.');
