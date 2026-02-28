#!/usr/bin/env node

/**
 * Seed CoFID Group ↔ Aisle Mappings
 * 
 * Loads cofid-aisle-mapping.json and creates CoFIDGroupAisleMapping documents
 * in Firestore for ingredients auto-creation workflow.
 * 
 * Usage:
 *   npm run seed:cofid-mappings
 *   FIREBASE_EMULATOR_HOST=localhost:8080 npm run seed:cofid-mappings  (for emulator)
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mappingFilePath = path.join(__dirname, 'cofid-aisle-mapping.json');

// Validate mapping file exists
if (!fs.existsSync(mappingFilePath)) {
  console.error(`❌ Mapping file not found: ${mappingFilePath}`);
  process.exit(1);
}

const mappingData = JSON.parse(fs.readFileSync(mappingFilePath, 'utf-8'));
console.log(`📋 Loaded ${Object.keys(mappingData).length} CoFID group mappings`);

// Initialize Firebase Admin SDK
let app;
try {
  // Check if running against emulator
  const emulatorHost = process.env.FIREBASE_EMULATOR_HOST;
  
  if (emulatorHost) {
    console.log(`🔌 Using Firebase Emulator at ${emulatorHost}`);
    // For emulator, we don't need credentials
    app = admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-saltstore',
    });
  } else {
    // Use service account for production
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Use Application Default Credentials
      app = admin.initializeApp();
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore(app);
db.settings({ databaseId: 'saltstore' });

async function seedMappings() {
  try {
    console.log('\n🌱 Seeding CoFID group mappings...');
    
    // Check if mappings already exist
    const existingCount = (await db.collection('cofid_group_aisle_mappings').get()).size;
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing mappings. Clearing...`);
      const batch = db.batch();
      const docs = await db.collection('cofid_group_aisle_mappings').get();
      docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`Cleared ${docs.size} existing mappings`);
    }

    // Seed new mappings
    const batchSize = 500; // Firestore batch limit
    let batch = db.batch();
    let batchCount = 0;
    let totalCount = 0;

    for (const [code, { name, aisle }] of Object.entries(mappingData)) {
      const docRef = db.collection('cofid_group_aisle_mappings').doc();
      
      batch.set(docRef, {
        cofidGroup: code,
        cofidGroupName: name,
        aisle: aisle,
        createdAt: new Date().toISOString(),
      });

      batchCount++;
      totalCount++;

      // Commit batch if at limit
      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`✓ Committed ${batchCount} mappings (total: ${totalCount})`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✓ Committed ${batchCount} mappings (total: ${totalCount})`);
    }

    console.log(`\n✅ Successfully seeded ${totalCount} CoFID group mappings!\n`);

    // Display sample
    console.log('📌 Sample mappings:');
    const samples = Object.entries(mappingData).slice(0, 5);
    samples.forEach(([code, { name, aisle }]) => {
      console.log(`   ${code} → ${aisle}: ${name}`);
    });
    console.log(`   ... and ${totalCount - 5} more\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding mappings:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run seeding
seedMappings();
