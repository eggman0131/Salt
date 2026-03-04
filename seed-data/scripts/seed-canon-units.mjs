#!/usr/bin/env node

/**
 * Seed Canon Units
 *
 * Loads canon-units.json and upserts Unit documents into the
 * `canonUnits` Firestore collection. Safe to run multiple times
 * (idempotent: each document is set by its known ID).
 *
 * Usage:
 *   node seed-data/scripts/seed-canon-units.mjs
 *   FIREBASE_EMULATOR_HOST=localhost:8080 node seed-data/scripts/seed-canon-units.mjs
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const unitsFilePath = path.join(__dirname, '../canon-units.json');

if (!fs.existsSync(unitsFilePath)) {
  console.error(`❌ Units file not found: ${unitsFilePath}`);
  process.exit(1);
}

const unitsData = JSON.parse(fs.readFileSync(unitsFilePath, 'utf-8'));
console.log(`📋 Loaded ${unitsData.length} canon units`);

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

async function seedCanonUnits() {
  try {
    console.log('\n🌱 Seeding canon units into `canonUnits`…');

    const now = new Date().toISOString();
    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let batchCount = 0;
    let totalCount = 0;

    for (const unit of unitsData) {
      const docRef = db.collection('canonUnits').doc(unit.id);

      batch.set(docRef, {
        id: unit.id,
        name: unit.name,
        plural: unit.plural ?? null,
        category: unit.category,
        sortOrder: unit.sortOrder ?? 999,
        createdAt: now,
      });

      batchCount++;
      totalCount++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`✓ Committed ${batchCount} units (total: ${totalCount})`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`✓ Committed ${batchCount} units (total: ${totalCount})`);
    }

    console.log(`\n✅ Successfully seeded ${totalCount} canon units!\n`);

    // Display sample by category
    console.log('📌 Sample units by category:');
    const categories = ['weight', 'volume', 'count', 'colloquial'];
    for (const cat of categories) {
      const sample = unitsData.filter(u => u.category === cat).slice(0, 3);
      console.log(`\n   ${cat.toUpperCase()}:`);
      sample.forEach(u => {
        const display = u.plural ? `${u.name}/${u.plural}` : u.name;
        console.log(`      - ${display}`);
      });
    }

    console.log();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding canon units:', error);
    process.exit(1);
  }
}

seedCanonUnits();
