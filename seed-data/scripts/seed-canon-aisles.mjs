#!/usr/bin/env node

/**
 * Seed Canon Aisles
 *
 * Loads canon-aisles.json (three-tier format) and upserts Aisle documents
 * into the `canonAisles` Firestore collection. Each entry gets a UUID as
 * its document ID and sortOrder derived from array position.
 *
 * Safe to run multiple times — existing documents with the same UUID are
 * overwritten. However, re-running after the JSON changes will create new
 * UUIDs (old documents are NOT deleted automatically).
 *
 * An `uncategorised` system aisle is always guaranteed after seeding.
 *
 * Usage:
 *   node seed-data/scripts/seed-canon-aisles.mjs
 *   FIREBASE_EMULATOR_HOST=localhost:8080 node seed-data/scripts/seed-canon-aisles.mjs
 */

import admin from 'firebase-admin';
import crypto from 'crypto';
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
console.log(`📋 Loaded ${aislesData.length} canon aisles (three-tier format)`);

// Validate format
for (let i = 0; i < aislesData.length; i++) {
  const a = aislesData[i];
  if (!a.tier1 || !a.tier2 || !a.tier3) {
    console.error(`❌ Entry ${i} missing required field (tier1, tier2, tier3):`, JSON.stringify(a));
    process.exit(1);
  }
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

    const seededAisles = [];

    for (let i = 0; i < aislesData.length; i++) {
      const entry = aislesData[i];
      const id = crypto.randomUUID();
      const docRef = db.collection('canonAisles').doc(id);

      const aisleDoc = {
        id,
        name: entry.tier1,
        tier2: entry.tier2,
        tier3: entry.tier3,
        sortOrder: i,
        createdAt: now,
      };

      batch.set(docRef, aisleDoc);
      seededAisles.push(aisleDoc);

      batchCount++;
      totalCount++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`✓ Committed ${batchCount} aisles (total: ${totalCount})`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Ensure the `uncategorised` system aisle exists
    const uncatId = 'uncategorised';
    const uncatRef = db.collection('canonAisles').doc(uncatId);
    batch.set(uncatRef, {
      id: uncatId,
      name: 'uncategorised',
      tier2: 'system',
      tier3: 'system',
      sortOrder: 999,
      createdAt: now,
    });
    batchCount++;
    totalCount++;
    seededAisles.push({ id: uncatId, name: 'uncategorised', tier2: 'system', tier3: 'system', sortOrder: 999 });

    if (batchCount > 0) {
      await batch.commit();
      console.log(`✓ Committed ${batchCount} aisles (total: ${totalCount})`);
    }

    console.log(`\n✅ Successfully seeded ${totalCount} canon aisles!\n`);

    console.log('📌 Aisles seeded:');
    seededAisles
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach(a => console.log(`   ${String(a.sortOrder).padStart(3)}  ${a.tier3.padEnd(18)} ${a.tier2.padEnd(22)} ${a.name}`));

    console.log();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding canon aisles:', error);
    process.exit(1);
  }
}

seedCanonAisles();
