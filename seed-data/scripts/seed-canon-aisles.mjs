#!/usr/bin/env node

/**
 * Seed Canon Aisles
 *
 * Loads canon-aisles.json and upserts Aisle documents into the
 * `canonAisles` Firestore collection. Safe to run multiple times
 * (idempotent: each document is set by its known ID).
 *
 * The `uncategorised` system aisle is always guaranteed after seeding.
 *
 * Usage:
 *   node seed-data/scripts/seed-canon-aisles.mjs
 *   FIREBASE_EMULATOR_HOST=localhost:8080 node seed-data/scripts/seed-canon-aisles.mjs
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aislesFilePath = path.join(__dirname, '../canon-aisles.json');

if (!fs.existsSync(aislesFilePath)) {
  console.error(`❌ Aisles file not found: ${aislesFilePath}`);
  process.exit(1);
}

const aislesData = JSON.parse(fs.readFileSync(aislesFilePath, 'utf-8'));
console.log(`📋 Loaded ${aislesData.length} canon aisles`);

// Validate that the required system aisle is present in the seed file
const hasUncategorised = aislesData.some(a => a.id === 'uncategorised');
if (!hasUncategorised) {
  console.error('❌ seed file is missing required system aisle: id="uncategorised"');
  process.exit(1);
}

// Initialise Firebase Admin SDK
let app;
try {
  const emulatorHost = process.env.FIREBASE_EMULATOR_HOST;

  if (emulatorHost) {
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    console.log(`🔌 Using Firebase Emulator at ${emulatorHost}`);
    app = admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-saltstore',
    });
  } else {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      app = admin.initializeApp();
    }
  }
} catch (error) {
  console.error('❌ Failed to initialise Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore(app);
db.settings({ databaseId: '(default)' });

async function seedCanonAisles() {
  try {
    console.log('\n🌱 Seeding canon aisles into `canonAisles`…');

    const now = new Date().toISOString();
    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let batchCount = 0;
    let totalCount = 0;

    for (const aisle of aislesData) {
      const docRef = db.collection('canonAisles').doc(aisle.id);

      batch.set(docRef, {
        id: aisle.id,
        name: aisle.name,
        sortOrder: aisle.sortOrder ?? 999,
        createdAt: now,
      });

      batchCount++;
      totalCount++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`✓ Committed ${batchCount} aisles (total: ${totalCount})`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`✓ Committed ${batchCount} aisles (total: ${totalCount})`);
    }

    console.log(`\n✅ Successfully seeded ${totalCount} canon aisles!\n`);

    console.log('📌 Aisles seeded:');
    aislesData
      .slice()
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
      .forEach(a => console.log(`   ${String(a.sortOrder).padStart(3)}  ${a.id.padEnd(24)} ${a.name}`));

    console.log();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding canon aisles:', error);
    process.exit(1);
  }
}

seedCanonAisles();
