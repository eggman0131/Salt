#!/usr/bin/env node

/**
 * Seed Cooking Units
 * 
 * Loads units.json and creates Unit documents in Firestore's canon collection.
 * Units are used by the ingredient parser to normalize units during recipe import.
 * 
 * Usage:
 *   npm run seed:units
 *   FIREBASE_EMULATOR_HOST=localhost:8080 npm run seed:units  (for emulator)
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const unitsFilePath = path.join(__dirname, '../units.json');

// Validate units file exists
if (!fs.existsSync(unitsFilePath)) {
  console.error(`❌ Units file not found: ${unitsFilePath}`);
  process.exit(1);
}

const unitsData = JSON.parse(fs.readFileSync(unitsFilePath, 'utf-8'));
console.log(`📋 Loaded ${unitsData.length} cooking units`);

// Initialize Firebase Admin SDK
let app;
try {
  const emulatorHost = process.env.FIREBASE_EMULATOR_HOST;
  
  if (emulatorHost) {
    console.log(`🔌 Using Firebase Emulator at ${emulatorHost}`);
    app = admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-saltstore',
    });
  } else {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      app = admin.initializeApp();
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore(app);
db.settings({ databaseId: '(default)' });

async function seedUnits() {
  try {
    console.log('\n🌱 Seeding cooking units...');
    
    // Check if units already exist
    const existingCount = (await db.collection('units').get()).size;
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing units. Clearing...`);
      const batch = db.batch();
      const docs = await db.collection('units').get();
      docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`Cleared ${docs.size} existing units`);
    }

    // Seed new units
    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;
    let totalCount = 0;

    for (const unit of unitsData) {
      const docRef = db.collection('units').doc(unit.id);
      
      const unitDoc = {
        id: unit.id,
        name: unit.name,
        plural: unit.plural || null,
        category: unit.category,
        sortOrder: unit.sortOrder || 999,
        createdAt: new Date().toISOString(),
      };

      batch.set(docRef, unitDoc);

      batchCount++;
      totalCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`✓ Committed ${batchCount} units (total: ${totalCount})`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✓ Committed ${batchCount} units (total: ${totalCount})`);
    }

    console.log(`\n✅ Successfully seeded ${totalCount} cooking units!\n`);

    // Display sample by category
    console.log('📌 Sample units by category:');
    const categories = ['weight', 'volume', 'count', 'colloquial'];
    for (const category of categories) {
      const sampleUnits = unitsData.filter(u => u.category === category).slice(0, 3);
      console.log(`\n   ${category.toUpperCase()}:`);
      sampleUnits.forEach(u => {
        const display = u.plural ? `${u.name}/${u.plural}` : u.name;
        console.log(`      - ${display}`);
      });
    }

    console.log();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding units:', error);
    process.exit(1);
  }
}

seedUnits();
