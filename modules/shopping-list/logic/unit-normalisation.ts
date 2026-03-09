/**
 * Unit normalisation — pure functions, no I/O.
 *
 * UK recipe conventions only: metric, tsp, tbsp, count, colloquial.
 * No imperial (oz, lb, cup, fl oz) — these are not used in Salt recipes.
 */

type UnitCategory = 'weight' | 'volume' | 'count' | 'colloquial';

interface NormalisedQty {
  qty: number;
  baseUnit: string;
}

// Conversion factors to base units (grams for weight, ml for volume)
const WEIGHT_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
};

/**
 * Determine the category of a unit string.
 */
export function getUnitCategory(unit: string): UnitCategory {
  const u = unit.toLowerCase().trim();
  if (u in WEIGHT_TO_GRAMS) return 'weight';
  if (u in VOLUME_TO_ML) return 'volume';
  // count-like patterns
  if (['whole', 'piece', 'pieces', 'clove', 'cloves', 'stick', 'sticks',
       'sprig', 'sprigs', 'head', 'heads', 'bunch', 'bunches',
       'slice', 'slices', 'fillet', 'fillets', 'rasher', 'rashers',
       'tin', 'tins', 'can', 'cans', 'bag', 'bags', 'pack', 'packs',
       'jar', 'jars', 'bottle', 'bottles', 'sheet', 'sheets',
       ''].includes(u)) {
    return 'count';
  }
  return 'colloquial';
}

/**
 * Normalise a quantity + unit to a base unit.
 * Weight → grams, Volume → ml, count/colloquial → as-is.
 */
export function normaliseToBase(qty: number, unit: string): NormalisedQty {
  const u = unit.toLowerCase().trim();

  if (u in WEIGHT_TO_GRAMS) {
    return { qty: qty * WEIGHT_TO_GRAMS[u], baseUnit: 'g' };
  }
  if (u in VOLUME_TO_ML) {
    return { qty: qty * VOLUME_TO_ML[u], baseUnit: 'ml' };
  }

  // count and colloquial — return as-is with normalised unit string
  return { qty, baseUnit: u || 'whole' };
}

/**
 * Returns true if two units can be reconciled (summed together).
 * Units are reconcilable if they belong to the same category.
 */
export function canReconcile(unitA: string, unitB: string): boolean {
  const catA = getUnitCategory(unitA.toLowerCase().trim());
  const catB = getUnitCategory(unitB.toLowerCase().trim());

  // count and colloquial can only reconcile within themselves
  if (catA === 'count' && catB === 'count') return true;
  if (catA === 'colloquial' && catB === 'colloquial') return unitA.toLowerCase() === unitB.toLowerCase();
  if (catA === 'weight' && catB === 'weight') return true;
  if (catA === 'volume' && catB === 'volume') return true;

  return false;
}

/**
 * Format a base quantity for display.
 * Rounds to 1 decimal place if fractional, whole number otherwise.
 */
export function formatQty(qty: number): string {
  return qty % 1 === 0 ? String(qty) : qty.toFixed(1);
}
