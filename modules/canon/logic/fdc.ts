/**
 * FDC Logic — Pure domain logic for mapping USDA FDC portion data to
 * canon item unit intelligence fields.
 *
 * No I/O. Fully testable.
 */

import type { UnitIntelligence } from '../../../types/contract';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FdcPortion {
  gramWeight: number;
  amount: number;
  measureUnit: { id: number; name: string; abbreviation: string };
  modifier: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// ml per one unit of measure (for density computation)
export const ML_PER_UNIT: Record<string, number> = {
  'fluid ounce': 29.5735,
  'fl oz': 29.5735,
  'milliliter': 1,
  'ml': 1,
  'liter': 1000,
  'l': 1000,
};

// ── Mapping ───────────────────────────────────────────────────────────────────

/**
 * Map FDC food portions to a Firestore field-path patch for CanonicalItem.unit.
 * Returns only fields where the existing unit_weights value is absent.
 * Skips portions with a non-empty modifier (e.g. "packed", "drained") for primary fields.
 */
export function mapFdcPortionsToUnitPatch(
  portions: FdcPortion[],
  existingUnit: UnitIntelligence
): Record<string, number> {
  const patch: Record<string, number> = {};

  for (const p of portions) {
    const perUnit = p.gramWeight / p.amount;
    let name = p.measureUnit.name.toLowerCase().trim();
    let abbr = p.measureUnit.abbreviation.toLowerCase().trim();

    // Skip pure weight units — their gram-per-unit values are fixed constants, not food data
    const WEIGHT_UNITS = new Set(['gram', 'g', 'ounce', 'oz', 'pound', 'lb', 'kilogram', 'kg', 'milligram', 'mg', 'cup']);
    if (WEIGHT_UNITS.has(name) || WEIGHT_UNITS.has(abbr)) continue;

    // If measureUnit is "undetermined", try to resolve from modifier before continuing
    if (name === 'undetermined' || abbr === 'undetermined') {
      const modLower = p.modifier.toLowerCase().trim();
      if (modLower.includes('tbsp') || modLower.includes('tablespoon')) {
        name = 'tablespoon'; abbr = 'tbsp';
      } else if (modLower.includes('tsp') || modLower.includes('teaspoon')) {
        name = 'teaspoon'; abbr = 'tsp';
      } else if (modLower.includes('racc')) {
        name = 'racc'; abbr = 'racc';
      } else if (modLower.includes('each') || modLower.includes('whole')) {
        name = 'each'; abbr = 'each';
      } else if (modLower.startsWith('slice')) {
        name = 'slice'; abbr = 'slice';
      } else if (modLower.startsWith('large')) {
        name = 'large'; abbr = 'large';
      } else if (modLower.startsWith('medium')) {
        name = 'medium'; abbr = 'medium';
      } else if (modLower.startsWith('small')) {
        name = 'small'; abbr = 'small';
      } else {
        // Last resort: use the first word of the modifier as the key (e.g. "rings" → "ring")
        const firstWord = modLower.split(/[\s,(]/)[0];
        if (!firstWord) continue;
        // Naive depluralize: strip trailing 's' only if word is > 3 chars (avoids "as"→"a")
        name = (firstWord.length > 3 && firstWord.endsWith('s')) ? firstWord.slice(0, -1) : firstWord;
        abbr = name;
      }
    }

    // density_g_per_ml — inferred from fluid measures (before unit_weights so we don't also store tbsp etc. for fluids)
    const mlFactor = ML_PER_UNIT[name] ?? ML_PER_UNIT[abbr];
    if (mlFactor !== undefined) {
      if (existingUnit.density_g_per_ml == null) {
        patch['unit.density_g_per_ml'] = p.gramWeight / (p.amount * mlFactor);
      }
      continue; // fluid portions don't also need a unit_weights entry
    }

    // unit_weights — normalised key
    let key: string;
    if (name === 'tablespoon' || abbr === 'tbsp') {
      key = 'tbsp';
    } else if (name === 'teaspoon' || abbr === 'tsp') {
      key = 'tsp';
    } else if (name === 'racc' || abbr === 'racc') {
      // RACC = reference amount customarily consumed → treat as medium/default serving
      if (existingUnit.unit_weights?.medium == null) patch['unit.unit_weights.medium'] = perUnit;
      if (existingUnit.unit_weights?.default == null) patch['unit.unit_weights.default'] = perUnit;
      continue;
    } else if (name === 'slice' || abbr === 'slice') {
      // Slices come in sizes — derive a suffixed key from the modifier
      const modLower = p.modifier.toLowerCase();
      if (modLower.includes('thin') || modLower.includes('small')) {
        key = 'slice_thin';
      } else if (modLower.includes('large') || modLower.includes('thick')) {
        key = 'slice_large';
      } else {
        key = 'slice';
      }
    } else {
      // For everything else use the unit name directly as the key.
      // Prefer abbreviation when it's a short, clean token; fall back to name.
      key = (abbr && abbr.length <= 6 && abbr !== name) ? abbr : name;
      // Normalise spaces to underscores for Firestore field paths
      key = key.replace(/\s+/g, '_');
    }

    // For count-like units, check modifier for size variants
    const COUNT_UNITS = new Set([
      'each', 'whole', 'piece', 'item', 'fruit', 'vegetable', 'leaf', 'clove',
      'stalk', 'spear', 'ear', 'head', 'link', 'patty', 'fillet', 'filet',
      'egg', 'strip', 'segment',
    ]);
    if (COUNT_UNITS.has(name) || COUNT_UNITS.has(abbr)) {
      const modLower = p.modifier.toLowerCase();
      if (modLower.includes('small')) {
        key = 'small';
      } else if (modLower.includes('medium')) {
        key = 'medium';
      } else if (modLower.includes('large')) {
        key = 'large';
      } else {
        key = 'default';
      }
    }

    const existingValue = (existingUnit.unit_weights as Record<string, number> | undefined)?.[key];
    if (existingValue == null && patch[`unit.unit_weights.${key}`] == null) {
      patch[`unit.unit_weights.${key}`] = perUnit;
    }
  }

  return patch;
}
