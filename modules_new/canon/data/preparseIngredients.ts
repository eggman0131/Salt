/**
 * Canon Module – Optional Deterministic Pre-parse
 *
 * Uses `recipe-ingredient-parser-v3` to extract quantity, unit, and residual
 * text from ingredient lines before sending them to the AI.
 *
 * This is an optional optimisation step; the AI parse pipeline works without
 * it.  Pre-parsing can improve AI accuracy by providing structured hints.
 *
 * I/O only (library call) – no business logic here.
 */

import { parse as parseIngredient } from 'recipe-ingredient-parser-v3';
import type { UnitRef, PreParsedIngredient } from '../types';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface LibParseResult {
  quantity: number | string | null;
  unit: string | null;
  ingredient: string;
  minQty?: number;
  maxQty?: number;
}

// ---------------------------------------------------------------------------
// Unit normalisation helper
// ---------------------------------------------------------------------------

/**
 * Attempts to match a library-extracted unit string against the canon unit
 * refs by name or plural (case-insensitive).
 *
 * Returns the matched unit ID, or null if no match is found.
 */
function resolveUnitId(
  rawUnit: string | null,
  unitRefs: UnitRef[],
): string | null {
  if (!rawUnit) return null;
  const lower = rawUnit.toLowerCase();
  for (const ref of unitRefs) {
    if (ref.name.toLowerCase() === lower) return ref.id;
    if (ref.plural !== null && ref.plural.toLowerCase() === lower) return ref.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public data function
// ---------------------------------------------------------------------------

/**
 * Runs the deterministic parser over each ingredient line to extract
 * quantity, unit, and residual text.
 *
 * Falls back gracefully: if the parser throws for a line, that line's result
 * will have all fields set to null / the original raw line as residualText.
 *
 * @param lines     - Raw ingredient lines.
 * @param unitRefs  - Canon unit refs used to normalise parsed unit names.
 * @returns One PreParsedIngredient per input line (same order).
 */
export function preparseIngredients(
  lines: string[],
  unitRefs: UnitRef[],
): PreParsedIngredient[] {
  return lines.map((rawLine) => {
    try {
      const result: LibParseResult = parseIngredient(rawLine, 'eng');

      const quantity =
        result.quantity !== null && result.quantity !== undefined
          ? Number(result.quantity)
          : null;

      const unit = result.unit ?? null;
      const unitId = resolveUnitId(unit, unitRefs);

      // Residual text: the ingredient field stripped of the original line's
      // quantity/unit prefix.
      const residualText = result.ingredient?.trim() || rawLine;

      return { rawLine, quantity, unit, unitId, residualText };
    } catch {
      // Parser could not handle this line – return safe defaults
      return {
        rawLine,
        quantity: null,
        unit: null,
        unitId: null,
        residualText: rawLine,
      };
    }
  });
}
