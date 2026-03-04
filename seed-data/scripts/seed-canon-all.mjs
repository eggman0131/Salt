#!/usr/bin/env node

/**
 * Seed Canon All
 *
 * Convenience runner that seeds both `canonAisles` and `canonUnits`
 * in sequence. Each individual script is idempotent, so this
 * composite script is idempotent too.
 *
 * Usage:
 *   node seed-data/scripts/seed-canon-all.mjs
 *   FIREBASE_EMULATOR_HOST=localhost:8080 node seed-data/scripts/seed-canon-all.mjs
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶  Running ${scriptName}…`);
  console.log('─'.repeat(60));

  execSync(`node "${scriptPath}"`, {
    stdio: 'inherit',
    env: process.env,
  });
}

console.log('🍴 Salt — Canon seed-all');
console.log('Seeds canonAisles and canonUnits into Firestore.\n');

try {
  run('seed-canon-aisles.mjs');
  run('seed-canon-units.mjs');

  console.log('\n' + '═'.repeat(60));
  console.log('✅ All canon collections seeded successfully.');
  console.log('═'.repeat(60) + '\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Seed-all failed:', error.message);
  process.exit(1);
}
