#!/usr/bin/env node

/**
 * SALT Parity Check Helper
 * 
 * Temporarily relaxes Firestore rules for parity testing, then restores them.
 * This allows full Firebase backend testing without requiring user authentication.
 * 
 * Usage: node scripts/parity-helper.mjs
 */

import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.join(__dirname, '..', 'firestore.rules');

const ORIGINAL_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper to check if user is in the authorized 'users' collection
    function isAuthorized() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.token.email));
    }

    match /{document=**} {
      // For development/emulators, you might want 'allow read, write: if true;' 
      // but we'll stick to the production logic for testing.
      allow read, write: if isAuthorized();
    }
    
    // Allow initial users to be checked during login
    match /users/{email} {
      allow read: if true;
    }
  }
}
`;

const RELAXED_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ⚠️  TEMPORARILY RELAXED FOR PARITY TESTING
    // This allows all read/write without authentication.
    // Original rules will be restored after testing.
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
`;

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║       SALT Parity Helper - Firestore Rules Manager       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Check if rules file exists
    if (!fs.existsSync(rulesPath)) {
      console.error(`❌ firestore.rules not found at ${rulesPath}`);
      process.exit(1);
    }

    const originalContent = fs.readFileSync(rulesPath, 'utf8');

    console.log('📋 Current Status:');
    console.log(`   Rules file: ${rulesPath}\n`);

    if (originalContent.includes('TEMPORARILY RELAXED')) {
      console.log('⚠️  Rules are already relaxed (parity testing mode)\n');
      console.log('Restoring original rules...');
      fs.writeFileSync(rulesPath, ORIGINAL_RULES.trim());
      console.log('✅ Rules restored to production security mode\n');
      process.exit(0);
    }

    console.log('🔒 Current mode: Production (auth required)\n');
    console.log('📝 About to:');
    console.log('   1. Relax firestore.rules → allow all read/write');
    console.log('   2. Run: npm run parity');
    console.log('   3. Restore original firestore.rules\n');

    console.log('⏱️  You have 5 seconds to cancel (Ctrl+C)...\n');

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('▶️  Modifying firestore.rules for testing...');
    fs.writeFileSync(rulesPath, RELAXED_RULES.trim());
    console.log('✅ Rules relaxed (auth bypass enabled)\n');

    console.log('▶️  Starting parity check...\n');
    console.log('─'.repeat(61) + '\n');

    // Run parity check
    return new Promise((resolve, reject) => {
      const parity = spawn('npm', ['run', 'parity'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });

      parity.on('close', (code) => {
        console.log('\n' + '─'.repeat(61));
        console.log('\n▶️  Restoring original firestore.rules...');

        try {
          fs.writeFileSync(rulesPath, ORIGINAL_RULES.trim());
          console.log('✅ Rules restored to production security mode\n');
          console.log('✨ Parity helper complete\n');
          resolve();
          process.exit(code);
        } catch (e) {
          console.error(`❌ Failed to restore rules: ${e.message}\n`);
          console.error('⚠️  You may need to manually restore firestore.rules\n');
          reject(e);
        }
      });

      parity.on('error', (err) => {
        console.error(`❌ Parity check failed: ${err.message}\n`);
        
        try {
          console.log('▶️  Attempting to restore firestore.rules...');
          fs.writeFileSync(rulesPath, ORIGINAL_RULES.trim());
          console.log('✅ Rules restored\n');
        } catch (e) {
          console.error(`⚠️  Also failed to restore rules: ${e.message}\n`);
        }
        
        reject(err);
      });
    });
  } catch (err) {
    console.error(`❌ Error: ${err.message}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
