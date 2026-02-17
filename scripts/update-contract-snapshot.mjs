#!/usr/bin/env node

/**
 * Update Contract Snapshot
 *
 * Regenerates the contract snapshot after contract changes have been
 * documented in docs/contract-gate/CHANGELOG.md.
 *
 * Usage: npm run update-contract-snapshot
 *
 * This must be run AFTER modifying docs/contract-gate/CHANGELOG.md.
 */

import fs from 'fs/promises';
import path from 'path';

const CURRENT_DIR = process.cwd();
const CONTRACT_PATH = path.join(CURRENT_DIR, 'types/contract.ts');
const SNAPSHOT_PATH = path.join(CURRENT_DIR, 'scripts/contract-snapshot.mjs');

/**
 * Compute a stable hash for change detection.
 */
function computeChecksum(content) {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Extract all exported schemas and types from contract.ts
 */
function extractContractExports(content) {
  const schemas = {};
  const types = [];

  const schemaMatches = content.matchAll(/export const (\w+Schema)\s*=/g);
  for (const match of schemaMatches) {
    schemas[match[1]] = `Zod schema for ${match[1].replace('Schema', '')}`;
  }

  const typeMatches = content.matchAll(/export (?:type|interface) (\w+)/g);
  for (const match of typeMatches) {
    if (!types.includes(match[1])) {
      types.push(match[1]);
    }
  }

  return { schemas, types: types.sort() };
}

/**
 * Main update logic
 */
async function updateSnapshot() {
  console.log('📸 Updating Contract Snapshot\n');

  // Load current contract
  let contractContent;
  try {
    contractContent = await fs.readFile(CONTRACT_PATH, 'utf8');
  } catch (err) {
    console.error(`❌ Error reading contract: ${err.message}`);
    process.exit(1);
  }

  // Extract current exports
  const current = extractContractExports(contractContent);
  const checksum = computeChecksum(JSON.stringify(current));
  const timestamp = new Date().toISOString();

  // Build new snapshot file
  const snapshotContent = [
    '/**',
    ' * Contract Snapshot for Verification Gate',
    ' *',
    ' * This snapshot is used by the contract changelog gate to detect changes.',
    ' * It is automatically regenerated when docs/contract-gate/CHANGELOG.md is modified.',
    ' *',
    ' * DO NOT EDIT MANUALLY. Use: npm run update-contract-snapshot',
    ' */',
    '',
    'const CURRENT_CONTRACT_SNAPSHOT = {',
    '  schemas: {',
    ...Object.entries(current.schemas)
      .sort()
      .map(([name, desc]) => `    ${name}: '${desc}',`),
    '  },',
    '  types: [',
    ...current.types.map(type => `    '${type}',`),
    '  ],',
    `  timestamp: '${timestamp}',`,
    `  checksum: '${checksum}',`,
    '};',
    '',
    'module.exports = CURRENT_CONTRACT_SNAPSHOT;',
    '',
  ].join('\n');

  try {
    await fs.writeFile(SNAPSHOT_PATH, snapshotContent, 'utf8');
    console.log(`✅ Snapshot updated at ${SNAPSHOT_PATH}`);
    console.log(`   Checksum: ${checksum}`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Schemas: ${Object.keys(current.schemas).length}`);
    console.log(`   Types: ${current.types.length}`);
    console.log('\n✅ Ready to commit!');
    process.exit(0);
  } catch (err) {
    console.error(`❌ Error writing snapshot: ${err.message}`);
    process.exit(1);
  }
}

updateSnapshot();
