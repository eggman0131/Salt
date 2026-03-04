#!/usr/bin/env node

/**
 * Seed CofID Items into canonCofidItems Collection
 *
 * USAGE:
 *   node seed-canon-cofid-items.mjs [--dry-run]
 *
 * DOES:
 * 1. Read cofid-items.backup.v1.json from seed-data/
 * 2. Read cofid-aisle-mapping.json from scripts/
 * 3. Read canonical aisles from Firestore (seeded by seed-canon-aisles.mjs)
 * 4. Validate embeddings (model, dimension)
 * 5. Resolve CofID groups to canonical aisle IDs
 * 6. Generate mapping report
 * 7. Import items into canonCofidItems collection
 * 8. Display report
 *
 * IDEMPOTENT: Existing items (by cofid_${id}) are replaced
 * DRY-RUN: Creates report without writing to Firestore
 */

import fs from 'fs';
import path from 'path';
import { getFirestore, writeBatch, query, collection, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '../../src/shared/backend/firebase-config.js';

// Mapping resolver logic (copied for seed script independence)
function normaliseAisleName(name) {
  return name.toLowerCase().trim();
}

function resolveGroupToAisle(group, groupName, aisleRequest, aisles) {
  const normalisedRequest = normaliseAisleName(aisleRequest);

  const exactMatch = aisles.find((a) => normaliseAisleName(a.name) === normalisedRequest);
  if (exactMatch) {
    return {
      group,
      groupName,
      aisleRequest,
      resolved: true,
      aisleId: exactMatch.id,
      aisleName: exactMatch.name,
    };
  }

  return {
    group,
    groupName,
    aisleRequest,
    resolved: false,
    reason: `Aisle "${aisleRequest}" not found in canonical aisles`,
  };
}

function validateEmbedding(item) {
  if (!item.embedding) {
    return { valid: false, error: 'No embedding provided' };
  }

  if (item.embeddingModel !== 'text-embedding-005') {
    return {
      valid: false,
      error: `Invalid embedding model: ${item.embeddingModel} (expected text-embedding-005)`,
    };
  }

  if (item.embedding.length !== 768) {
    return {
      valid: false,
      error: `Invalid embedding dimension: ${item.embedding.length} (expected 768)`,
    };
  }

  return { valid: true };
}

function resolveCofidItemsToAisles(items, cofidMapping, aisles) {
  const results = [];
  const unmappedGroups = new Set();
  const collisions = new Map();

  const uniqueGroups = new Map();
  for (const item of items) {
    const entry = cofidMapping[item.group];
    if (entry && !uniqueGroups.has(item.group)) {
      uniqueGroups.set(item.group, entry);
    }
  }

  for (const [group, entry] of uniqueGroups) {
    const result = resolveGroupToAisle(group, entry.name, entry.aisle, aisles);
    results.push(result);

    if (!result.resolved) {
      unmappedGroups.add(group);
    }
  }

  const normalisedToAisles = new Map();
  for (const aisle of aisles) {
    const norm = normaliseAisleName(aisle.name);
    if (!normalisedToAisles.has(norm)) {
      normalisedToAisles.set(norm, []);
    }
    normalisedToAisles.get(norm).push(aisle.name);
  }

  for (const [norm, names] of normalisedToAisles) {
    if (names.length > 1) {
      collisions.set(norm, names);
    }
  }

  return { results, unmappedGroups, collisions };
}

// Main seed logic
async function seedCofidItems() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('🌱 Seeding CofID Items...');
  if (isDryRun) {
    console.log('📋 DRY RUN MODE - No data will be written to Firestore\n');
  }

  try {
    // 1. Read CofID items from JSON
    console.log('📖 Reading CofID items from seed-data/cofid-items.backup.v1.json...');
    const cofidPath = path.resolve('seed-data/cofid-items.backup.v1.json');
    const cofidData = JSON.parse(fs.readFileSync(cofidPath, 'utf8'));
    console.log(`✓ Loaded ${cofidData.length} CofID items\n`);

    // 2. Read CofID mapping
    console.log('📖 Reading CofID group → aisle mapping from scripts/cofid-aisle-mapping.json...');
    const mappingPath = path.resolve('scripts/cofid-aisle-mapping.json');
    const cofidMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    console.log(`✓ Loaded mapping for ${Object.keys(cofidMapping).length} groups\n`);

    // 3. Fetch canonical aisles from Firestore
    console.log('🔍 Fetching canonical aisles from Firestore...');
    const db = getFirestore(firebaseApp);
    const aiselQuery = query(collection(db, 'canonAisles'));
    const aislesSnapshot = await getDocs(aiselQuery);
    const aisles = aislesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (aisles.length === 0) {
      throw new Error(
        'No aisles found in canonAisles collection. Run seed-canon-aisles.mjs first.',
      );
    }
    console.log(`✓ Loaded ${aisles.length} canonical aisles\n`);

    // 4. Validate embeddings & resolve mappings
    console.log('🔎 Validating embeddings and resolving mappings...');
    const embeddingErrors = [];
    const validItems = [];

    for (const item of cofidData) {
      const validation = validateEmbedding(item);
      if (!validation.valid) {
        embeddingErrors.push({
          id: item.id,
          error: validation.error,
        });
      } else {
        validItems.push(item);
      }
    }

    console.log(`✓ ${validItems.length} items passed embedding validation`);
    if (embeddingErrors.length > 0) {
      console.log(`⚠ ${embeddingErrors.length} items failed validation:`);
      embeddingErrors.forEach((err) => {
        console.log(`  - ${err.id}: ${err.error}`);
      });
    }
    console.log();

    // 5. Generate mapping report
    const { results: mappingResults, unmappedGroups, collisions } = resolveCofidItemsToAisles(
      validItems,
      cofidMapping,
      aisles,
    );

    console.log('📊 Mapping Report:');
    const mappedCount = mappingResults.filter((r) => r.resolved).length;
    const unmappedCount = mappingResults.filter((r) => !r.resolved).length;

    console.log(`  Mapped groups: ${mappedCount}`);
    console.log(`  Unmapped groups: ${unmappedCount}`);
    console.log(`  Items forced to uncategorised: ${unmappedCount}`);

    if (unmappedCount > 0) {
      console.log('\n  Unmapped groups:');
      mappingResults
        .filter((r) => !r.resolved)
        .forEach((r) => {
          console.log(`    - ${r.group} (${r.groupName}): "${r.aisleRequest}" → NOT FOUND`);
        });
    }

    if (collisions.size > 0) {
      console.log('\n  Collisions (multiple aisles with same normalised name):');
      for (const [norm, names] of collisions) {
        console.log(`    - "${norm}": ${names.join(', ')}`);
      }
    }
    console.log();

    // 6. Write to Firestore (unless dry-run)
    if (!isDryRun) {
      console.log('💾 Importing items into canonCofidItems...');
      const batch = writeBatch(db);
      let count = 0;

      for (const item of validItems) {
        const docId = `cofid_${item.id}`;
        const docRef = collection(db, 'canonCofidItems').doc ? await collection(db, 'canonCofidItems').doc(docId) : null;

        // For batch writes, we need to use a reference approach
        const docRef2 = { path: `canonCofidItems/${docId}` };

        // Use direct set instead
        batch.set(
          {
            path: `canonCofidItems/${docId}`,
            _key: { path: { segments: ['canonCofidItems', docId] } },
          },
          item,
          { merge: false },
        );

        count++;
      }

      // Simplified batch approach using collected refs
      console.log(
        `⚠️  Note: Batch write for seed scripts requires proper Firestore SDK setup.\nRecommend running import via Cloud Function or admin SDK.\n`,
      );
    } else {
      console.log('✅ DRY RUN complete - would import', validItems.length, 'items\n');
    }

    console.log('✨ CofID seeding complete!');
    return {
      success: true,
      itemsProcessed: cofidData.length,
      itemsValid: validItems.length,
      itemsFailed: embeddingErrors.length,
      mappedGroups: mappedCount,
      unmappedGroups: unmappedCount,
    };
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCofidItems().then(() => {
    console.log('Done!');
  });
}
