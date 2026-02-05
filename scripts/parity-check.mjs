#!/usr/bin/env node

/**
 * SALT Backend Parity Check CLI
 * 
 * Runs the parity suite in a browser context and prints a clear report.
 * Requirements:
 * - npm run dev (dev server running on :3000)
 * - npm run emulators (emulators running for Firebase backend)
 * - functions/.env.local with GEMINI_API_KEY (optional, for AI tests)
 * 
 * Usage: node scripts/parity-check.mjs
 */

import { chromium } from '@playwright/test';

const BASE_URL = process.env.VITE_DEV_URL || 'http://localhost:3000';
const PARITY_URL = `${BASE_URL}/?parity=1`;
const TIMEOUT = parseInt(process.env.PARITY_TIMEOUT || '30000', 10);

/**
 * Formats the report with colors and structure
 */
function formatReport(report) {
  const { summary, tests, notes } = report;
  const { totalTests, passed, failed, skipped } = summary;

  let output = '\n╔═══════════════════════════════════════════════════════════╗\n';
  output += '║         SALT BACKEND PARITY TEST REPORT                  ║\n';
  output += '╚═══════════════════════════════════════════════════════════╝\n\n';

  // Notes section (if any)
  if (notes && notes.length > 0) {
    output += '📌 NOTES\n';
    for (const note of notes) {
      output += `   ${note}\n`;
    }
    output += '\n';
  }

  // Summary
  output += '📊 SUMMARY\n';
  output += `   Total:  ${totalTests}\n`;
  output += `   ${passed > 0 ? '✅' : '  '} Passed: ${passed}\n`;
  output += `   ${failed > 0 ? '❌' : '  '} Failed: ${failed}\n`;
  output += `   ${skipped > 0 ? '⏭️ ' : '  '} Skipped: ${skipped}\n\n`;

  // Detailed results
  output += '📋 DETAILED RESULTS\n\n';

  for (const test of tests) {
    const fbSkipped = test.firebase.data && typeof test.firebase.data === 'string' && test.firebase.data.includes('SKIPPED');
    const icon = test.parity ? '✅' : fbSkipped ? '⏭️ ' : '❌';
    output += `${icon} ${test.name}\n`;

    if (test.simulated.error) {
      output += `   ❌ Simulated: ${test.simulated.error}\n`;
    } else if (test.simulated.data) {
      const dataStr = typeof test.simulated.data === 'string'
        ? test.simulated.data
        : JSON.stringify(test.simulated.data);
      output += `   ✓ Simulated: ${dataStr}\n`;
    }

    if (test.firebase.error) {
      output += `   ❌ Firebase: ${test.firebase.error}\n`;
    } else if (test.firebase.data) {
      const dataStr = typeof test.firebase.data === 'string'
        ? test.firebase.data
        : JSON.stringify(test.firebase.data);
      output += `   ✓ Firebase: ${dataStr}\n`;
    }

    if (test.details && !test.parity) {
      output += `   ℹ️  ${test.details}\n`;
    }

    output += '\n';
  }

  output += `⏱️  Completed at ${new Date(report.timestamp).toLocaleString()}\n`;
  output += '\n';

  return output;
}

/**
 * Main function
 */
async function main() {
  let browser = null;
  let page = null;

  try {
    console.log(`🧪 Starting SALT Parity Check`);
    console.log(`📍 Target: ${PARITY_URL}`);
    console.log(`⏱️  Timeout: ${TIMEOUT}ms\n`);

    // Launch browser
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Navigate with timeout
    console.log('🌐 Loading dev server...');
    await page.goto(PARITY_URL, { timeout: TIMEOUT, waitUntil: 'networkidle' });

    // Wait for parity results
    console.log('⏳ Running parity suite...');
    const report = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (window.__SALT_PARITY__) {
            clearInterval(checkInterval);
            resolve(window.__SALT_PARITY__);
          }
        }, 100);
        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(null);
        }, 30000);
      });
    });

    if (!report) {
      console.error('❌ Parity suite did not complete within timeout');
      process.exit(1);
    }

    // Print formatted report
    console.log(formatReport(report));

    // Exit with appropriate code
    const { failed } = report.summary;
    if (failed > 0) {
      console.log(`❌ ${failed} test(s) failed\n`);
      process.exit(1);
    } else {
      console.log('✅ All tests passed\n');
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ Parity check failed: ${error.message}\n`);
    console.error('Make sure:');
    console.error('  1. npm run dev is running (port 3000)');
    console.error('  2. npm run emulators is running (Firestore, Auth, Functions)');
    console.error('  3. functions/.env.local has GEMINI_API_KEY (optional, for AI tests)\n');
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
