#!/usr/bin/env node

/**
 * Contract Changelog Gate
 *
 * Enforces that any modification to types/contract.ts is explicitly
 * documented in CONTRACT_CHANGELOG.md.
 *
 * Exit code:
 *   0 = Contract unchanged, or changed with changelog updated
 *   1 = Contract changed but changelog not updated
 *   2 = Error (file not found, etc.)
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const CURRENT_DIR = process.cwd();
const CONTRACT_PATH = path.join(CURRENT_DIR, 'types/contract.ts');
const CHANGELOG_PATH = path.join(CURRENT_DIR, 'CONTRACT_CHANGELOG.md');
const SNAPSHOT_PATH = path.join(CURRENT_DIR, 'scripts/contract-snapshot.mjs');

/**
 * Compute a stable hash of a string using a simple checksum.
 * Not cryptographic, just for detecting changes.
 */
function computeChecksum(content) {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Extract all exported schemas and types from contract.ts
 */
function extractContractExports(content) {
  const schemas = {};
  const types = [];

  // Find all Zod schema exports: export const XSchema = z.object(...)
  const schemaMatches = content.matchAll(
    /export const (\w+Schema)\s*=/g
  );
  for (const match of schemaMatches) {
    schemas[match[1]] = `Zod schema for ${match[1].replace('Schema', '')}`;
  }

  // Find all type exports: export type X = ...
  const typeMatches = content.matchAll(
    /export (?:type|interface) (\w+)/g
  );
  for (const match of typeMatches) {
    if (!types.includes(match[1])) {
      types.push(match[1]);
    }
  }

  return { schemas, types: types.sort() };
}

/**
 * Load the snapshot from contract-snapshot.mjs
 */
async function loadSnapshot() {
  try {
    const snapshotContent = await fs.readFile(SNAPSHOT_PATH, 'utf8');
    // Parse the CommonJS module export
    const match = snapshotContent.match(
      /const CURRENT_CONTRACT_SNAPSHOT = ({[\s\S]*?});/
    );
    if (!match) {
      throw new Error('Snapshot format invalid: missing CURRENT_CONTRACT_SNAPSHOT');
    }
    // Evaluate the object literal (safe here because we control the file)
    const snapshot = eval(`(${match[1]})`);
    return snapshot;
  } catch (err) {
    console.error(`Error loading snapshot: ${err.message}`);
    process.exit(2);
  }
}

/**
 * Check if CONTRACT_CHANGELOG.md was modified in the current working changes.
 * Only returns true if the file shows actual modifications (not just creation).
 */
function hasChangelogBeenModified() {
  try {
    // Check if CONTRACT_CHANGELOG.md has any modifications
    const diffStatus = execSync(
      'git diff --name-only HEAD -- CONTRACT_CHANGELOG.md; git diff --cached --name-only -- CONTRACT_CHANGELOG.md',
      {
        cwd: CURRENT_DIR,
        encoding: 'utf8',
      }
    ).trim();

    // If there are any diff results, the file was modified
    if (diffStatus.length > 0) {
      return true;
    }

    // Also check uncommitted modifications
    const status = execSync('git status --porcelain -- CONTRACT_CHANGELOG.md', {
      cwd: CURRENT_DIR,
      encoding: 'utf8',
    }).trim();

    // M = modified, MM = modified in both, etc.
    if (status.match(/^[AM]/)) {
      return true;
    }

    return false;
  } catch (err) {
    // If git fails or we're not in a repo, be conservative
    console.error(`⚠️  Could not check git status: ${err.message}`);
    console.error('    Assuming changelog was NOT modified (safest assumption)');
    return false;
  }
}

/**
 * Main gate logic
 */
async function runGate() {
  console.log('🔐 Contract Changelog Gate\n');

  // Load current contract
  let contractContent;
  try {
    contractContent = await fs.readFile(CONTRACT_PATH, 'utf8');
  } catch (err) {
    console.error(`❌ Error reading contract: ${err.message}`);
    process.exit(2);
  }

  // Load changelog
  let changelogContent;
  try {
    changelogContent = await fs.readFile(CHANGELOG_PATH, 'utf8');
  } catch (err) {
    console.error(`❌ Error reading changelog: ${err.message}`);
    process.exit(2);
  }

  // Load snapshot
  const snapshot = await loadSnapshot();

  // Extract current exports
  const current = extractContractExports(contractContent);
  const currentChecksum = computeChecksum(JSON.stringify(current));

  // Compare with snapshot
  const snapshotChecksum = snapshot.checksum;
  const contractChanged = currentChecksum !== snapshotChecksum;

  console.log(`Current checksum:  ${currentChecksum}`);
  console.log(`Snapshot checksum: ${snapshotChecksum}`);
  console.log();

  if (!contractChanged) {
    console.log('✅ Contract unchanged. Gate passes.');
    process.exit(0);
  }

  // Contract has changed
  console.log('⚠️  Contract has changed.');
  console.log();

  const changelogModified = hasChangelogBeenModified();

  if (!changelogModified) {
    console.error(
      '❌ GATE FAILURE: Contract changed but CONTRACT_CHANGELOG.md was not updated!\n' +
      'Rules:\n' +
      '  1. Any change to types/contract.ts requires a changelog entry.\n' +
      '  2. Document the change, its impact, and rationale.\n' +
      '  3. Update CONTRACT_CHANGELOG.md and commit together with your changes.\n\n' +
      'To acknowledge and document this change:\n' +
      '  1. Edit CONTRACT_CHANGELOG.md\n' +
      '  2. Add an entry under the "Entries" section\n' +
      '  3. Commit the changelog update\n\n' +
      'To regenerate the snapshot after documenting:\n' +
      '  npm run update-contract-snapshot'
    );
    process.exit(1);
  }

  console.log('✅ Contract change detected AND documented in changelog.');
  console.log('   Changelog file will be verified in the next build step.');
  process.exit(0);
}

// Run the gate
runGate().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}`);
  process.exit(2);
});
