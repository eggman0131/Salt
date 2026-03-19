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

    // If measureUnit is "undetermined", try to extract unit from modifier
    if (name === 'undetermined' || abbr === 'undetermined') {
      const modLower = p.modifier.toLowerCase().trim();
      if (modLower.includes('tbsp') || modLower.includes('tablespoon')) {
        name = 'tablespoon'; abbr = 'tbsp';
      } else if (modLower.includes('tsp') || modLower.includes('teaspoon')) {
        name = 'teaspoon'; abbr = 'tsp';
      } else if (modLower.includes('cup')) {
        name = 'cup'; abbr = 'cup';
      } else if (modLower.includes('racc')) {
        name = 'racc'; abbr = 'racc';
      } else if (modLower.includes('each') || modLower.includes('whole')) {
        name = 'each'; abbr = 'each';
      }
    }

    // unit_weights — volume measures
    if (name === 'tablespoon' || abbr === 'tbsp') {
      if (existingUnit.unit_weights?.tbsp == null) patch['unit.unit_weights.tbsp'] = perUnit;
    } else if (name === 'teaspoon' || abbr === 'tsp') {
      if (existingUnit.unit_weights?.tsp == null) patch['unit.unit_weights.tsp'] = perUnit;
    } else if (name === 'cup') {
      if (existingUnit.unit_weights?.cup == null) patch['unit.unit_weights.cup'] = perUnit;
    }

    // density_g_per_ml — inferred from fluid measures
    const mlFactor = ML_PER_UNIT[name] ?? ML_PER_UNIT[abbr];
    if (mlFactor !== undefined && existingUnit.density_g_per_ml == null) {
      patch['unit.density_g_per_ml'] = p.gramWeight / (p.amount * mlFactor);
    }

    // unit_weights — count and size measures
    if (name === 'racc' || abbr === 'racc') {
      if (existingUnit.unit_weights?.medium == null) patch['unit.unit_weights.medium'] = perUnit;
      if (existingUnit.unit_weights?.default == null) patch['unit.unit_weights.default'] = perUnit;
    } else if (
      name === 'each' || name === 'whole' || name === 'piece' || name === 'item' ||
      name === 'fruit' || name === 'vegetable' || name === 'leaf' || name === 'clove' ||
      abbr === 'each' || abbr === 'piece'
    ) {
      const modLower = p.modifier.toLowerCase();
      if (modLower.includes('small')) {
        if (existingUnit.unit_weights?.small == null) patch['unit.unit_weights.small'] = perUnit;
      } else if (modLower.includes('medium')) {
        if (existingUnit.unit_weights?.medium == null) patch['unit.unit_weights.medium'] = perUnit;
      } else if (modLower.includes('large')) {
        if (existingUnit.unit_weights?.large == null) patch['unit.unit_weights.large'] = perUnit;
      } else {
        if (existingUnit.unit_weights?.default == null) patch['unit.unit_weights.default'] = perUnit;
      }
    }
  }

  return patch;
}
