// Only available in Node.js environments (used by Firebase backend during recipe operations)
let fs: any = null;
let path: any = null;
let LOG_FILE: string | null = null;

const HEADERS = ['Timestamp', 'Raw String', 'Quantity', 'Unit', 'Ingredient Name', 'Qualifiers', 'Preparation'];

interface ParsedIngredientLog {
  timestamp: string;
  raw: string;
  quantity: number | null;
  unit: string | null;
  ingredientName: string;
  qualifiers: string;
  preparation: string | null;
}

/**
 * Initialize Node.js dependencies (safe to call in browser - returns false)
 */
function initializeNodeDeps(): boolean {
  if (typeof process === 'undefined' || !process.cwd) {
    return false; // Not in Node.js environment
  }

  try {
    fs = require('fs');
    path = require('path');
    LOG_FILE = path.join(process.cwd(), 'ingredient-parsing-log.csv');
    return true;
  } catch (error) {
    console.warn(`Failed to initialize Node.js dependencies for ingredient logging: ${error}`);
    return false;
  }
}

/**
 * Initialize CSV file with headers if it doesn't exist
 */
function ensureCSVExists(): void {
  if (!LOG_FILE || !fs) return;

  try {
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, HEADERS.join(',') + '\n', 'utf-8');
    }
  } catch (error) {
    console.warn(`Failed to initialize ingredient parsing log: ${error}`);
  }
}

/**
 * Escape CSV field values to handle commas, quotes, and newlines
 */
function escapeCSVField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If field contains special characters, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Log parsed ingredient to CSV file
 */
export function logParsedIngredient(
  raw: string,
  quantity: number | null,
  unit: string | null,
  ingredientName: string,
  qualifiers: string[] | undefined,
  preparation: string | null
): void {
  // Only attempt logging if in Node.js environment
  if (!LOG_FILE) {
    if (!initializeNodeDeps()) {
      return; // Not in Node.js, silently skip
    }
  }

  if (!fs || !LOG_FILE) return;

  try {
    ensureCSVExists();

    const timestamp = new Date().toISOString();
    const qualiersStr = qualifiers && qualifiers.length > 0 ? qualifiers.join('; ') : '';

    const row = [
      timestamp,
      raw,
      quantity !== null ? String(quantity) : '',
      unit || '',
      ingredientName,
      qualiersStr,
      preparation || '',
    ]
      .map(escapeCSVField)
      .join(',');

    fs.appendFileSync(LOG_FILE, row + '\n', 'utf-8');
  } catch (error) {
    console.warn(`Failed to log parsed ingredient: ${error}`);
  }
}

/**
 * Get path to the CSV log file
 */
export function getLogFilePath(): string | null {
  if (!LOG_FILE && !initializeNodeDeps()) {
    return null;
  }
  return LOG_FILE;
}

/**
 * Clear the CSV log file (for testing or reset)
 */
export function clearLog(): void {
  if (!LOG_FILE && !initializeNodeDeps()) {
    return;
  }

  try {
    if (LOG_FILE && fs) {
      ensureCSVExists();
    }
  } catch (error) {
    console.warn(`Failed to clear ingredient parsing log: ${error}`);
  }
}
