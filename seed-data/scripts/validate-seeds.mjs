#!/usr/bin/env node

/**
 * Validate Seed Data
 * 
 * Checks structural integrity of all seed files:
 * - units.json: valid JSON, required fields, no duplicates
 * - cofid-aisle-mappings.json: valid JSON (when added)
 * - cofid-items.json: valid JSON (when added)
 * 
 * Usage:
 *   npm run validate:seeds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.join(__dirname, '..');

const files = [
  { path: 'units.json', required: true, schema: validateUnits },
  { path: 'cofid-aisle-mappings.json', required: false, schema: validateAisleMappings },
  { path: 'cofid-items.json', required: false, schema: validateCoFIDItems },
];

let errorCount = 0;
let warningCount = 0;

function log(level, msg) {
  const icons = { error: '❌', warn: '⚠️ ', ok: '✅' };
  console.log(`${icons[level]} ${msg}`);
  if (level === 'error') errorCount++;
  if (level === 'warn') warningCount++;
}

function validateUnits(data) {
  if (!Array.isArray(data)) {
    log('error', 'units.json: root must be an array');
    return false;
  }

  const ids = new Set();
  let valid = true;

  data.forEach((unit, idx) => {
    // Check required fields
    if (!unit.id) log('error', `units.json[${idx}]: missing id`);
    if (!unit.name) log('error', `units.json[${idx}]: missing name`);
    if (!unit.category) log('error', `units.json[${idx}]: missing category`);

    // Check for duplicates
    if (ids.has(unit.id)) {
      log('error', `units.json[${idx}]: duplicate id "${unit.id}"`);
      valid = false;
    } else {
      ids.add(unit.id);
    }

    // Validate category enum
    const validCategories = ['weight', 'volume', 'count', 'colloquial'];
    if (unit.category && !validCategories.includes(unit.category)) {
      log('error', `units.json[${idx}]: invalid category "${unit.category}"`);
      valid = false;
    }

    // Check sortOrder is number
    if (unit.sortOrder && typeof unit.sortOrder !== 'number') {
      log('warn', `units.json[${idx}]: sortOrder should be number, got ${typeof unit.sortOrder}`);
    }
  });

  if (valid) {
    log('ok', `units.json: ${data.length} units valid`);
  }
  return valid;
}

function validateAisleMappings(data) {
  if (typeof data !== 'object' || data === null) {
    log('error', 'cofid-aisle-mappings.json: root must be an object');
    return false;
  }

  const entries = Object.entries(data);
  let valid = true;

  entries.forEach(([code, mapping]) => {
    if (!mapping.aisle) {
      log('error', `cofid-aisle-mappings.json["${code}"]: missing aisle`);
      valid = false;
    }
  });

  if (valid) {
    log('ok', `cofid-aisle-mappings.json: ${entries.length} mappings valid`);
  }
  return valid;
}

function validateCoFIDItems(data) {
  if (!Array.isArray(data)) {
    log('error', 'cofid-items.json: root must be an array');
    return false;
  }

  const ids = new Set();
  let valid = true;

  data.slice(0, 100).forEach((item, idx) => {
    if (!item.id) log('error', `cofid-items.json[${idx}]: missing id`);
    if (!item.name) log('error', `cofid-items.json[${idx}]: missing name`);

    if (ids.has(item.id)) {
      log('error', `cofid-items.json[${idx}]: duplicate id "${item.id}"`);
      valid = false;
    } else {
      ids.add(item.id);
    }
  });

  if (valid) {
    log('ok', `cofid-items.json: ${data.length} items valid (checked first 100)`);
  }
  return valid;
}

// Main validation
console.log('🔍 Validating seed data...\n');

for (const file of files) {
  const filePath = path.join(seedDir, file.path);

  if (!fs.existsSync(filePath)) {
    if (file.required) {
      log('error', `${file.path}: required file missing`);
    } else {
      console.log(`⏭️  ${file.path}: skipped (optional, not present)`);
    }
    continue;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    file.schema(data);
  } catch (error) {
    log('error', `${file.path}: ${error.message}`);
  }
}

console.log(`\n${errorCount === 0 ? '✅' : '❌'} Validation complete: ${errorCount} errors, ${warningCount} warnings\n`);

process.exit(errorCount > 0 ? 1 : 0);
