/**
 * Parser Test Utilities - Stage 0
 * 
 * Exports internal parser for testing and verification.
 * This is used exclusively for Stage 0-2 validation and will be
 * removed once matching integration is complete and parser behavior is stable.
 */

/**
 * Internal parse shape (mirrors BaseCanonBackend implementation)
 */
export type ParsedIngredientInternal = {
  quantityRaw: string | null;      // Original quantity string (e.g., "4 x 240g", "2-3")
  quantityValue: number | null;    // Parsed numeric value for maths
  unit: string | null;              // Unit (g, ml, tsp, tbsp, etc.)
  item: string;                     // Core canonicalisable noun
  qualifiers: string[];            // Modifiers, sub-varieties, parenthetical notes
  preparation: string | null;      // Action phrases (chopped, drained, etc.)
};

/**
 * Normalisation pass (Stage 1a)
 * Cleans unicode, standardises spacing and punctuation before parsing.
 */
export function normaliseIngredientString(raw: string): string {
  let text = raw
    // Unicode fraction handling: ½ → 1/2, ¼ → 1/4, etc.
    .replace(/½/g, '1/2')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/⅓/g, '1/3')
    .replace(/⅔/g, '2/3')
    // Multiplication symbol: × → x
    .replace(/×/g, 'x')
    // Multiple spaces → single space
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    .toLowerCase();

  return text;
}

/**
 * Preparation verb list (configurable, Stage 2)
 * Used to classify final tokens as preparation vs qualifiers.
 */
export function getPreparationTerms(): Set<string> {
  return new Set([
    'chopped', 'diced', 'minced', 'sliced', 'crushed', 'grated',
    'peeled', 'trimmed', 'torn', 'drained', 'finely', 'coarsely',
    'roughly', 'thinly', 'thickly', 'cubed', 'shredded', 'grated',
    'julienned', 'blanched', 'roasted', 'toasted', 'caramelised',
    'melted', 'whipped', 'beaten', 'whisked', 'folded', 'sifted',
    'strained', 'filtered', 'pressed', 'zested', 'deveined', 'pitted',
    'cored', 'deseeded', 'boned', 'flaked', 'crumbled', 'grated',
    'scattered', 'dusted', 'rinsed', 'drained', 'patted',
    'and', 'of', 'for', 'on', 'in', 'with', 'to' // Connectors
  ]);
}

/**
 * Parse quantity string into numeric value.
 * Handles: "100", "4 x 240", "2-3", "1/2", "1 1/2"
 */
export function parseQuantity(quantityStr: string): number | null {
  quantityStr = quantityStr.trim();

  // Mixed fraction first: "1 1/2" (must try before simple decimal which would match "1")
  const mixedMatch = quantityStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    return whole + numerator / denominator;
  }

  // Multiplier pattern: "4 x 240" or "4x240"
  const multiplierMatch = quantityStr.match(/^(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/);
  if (multiplierMatch) {
    const factor = parseFloat(multiplierMatch[1]);
    const base = parseFloat(multiplierMatch[2]);
    return factor * base;
  }

  // Range pattern: "2-3" → midpoint
  const rangeMatch = quantityStr.match(/^(\d+\.?\d*)\s*-\s*(\d+\.?\d*)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return (min + max) / 2;
  }

  // Simple fraction: "1/2"
  const fractionMatch = quantityStr.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    return numerator / denominator;
  }

  // Simple decimal: "100" or "100.5"
  const simpleMatch = quantityStr.match(/^(\d+\.?\d*)$/);
  if (simpleMatch) {
    return parseFloat(simpleMatch[1]);
  }

  return null;
}

/**
 * Parse raw ingredient (Stage 1 & 2: Regex upgrade + Second-pass classifier)
 * Produces rich internal model: quantity, unit, item, qualifiers[], preparation.
 * 
 * EXPORTED FOR TESTING ONLY - do not use in production code.
 * @param raw Raw ingredient string
 * @param units Optional list of units; uses comprehensive British cooking defaults if not provided
 */
export function parseIngredientEnhanced(raw: string, units?: ParsedIngredientInternal['unit'][]): ParsedIngredientInternal {
  let text = normaliseIngredientString(raw);

  // ===== STAGE 1: Quantity + Unit extraction (enhanced regex) =====
  // Use provided units or fallback to comprehensive British cooking units
  const unitNames = units ?? [
    // Weight
    'g', 'kg', 'mg',
    // Volume
    'ml', 'l', 'tsp', 'tsps', 'tbsp', 'tbsps',
    // Count
    'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces', 'stick', 'sticks',
    'tin', 'tins', 'can', 'cans', 'jar', 'jars', 'pack', 'packs',
    'packet', 'packets', 'bag', 'bags', 'bunch', 'head', 'fillet', 'fillets',
    'rasher', 'rashers', 'block', 'pot', 'tray', 'punnet',
    // Colloquial
    'pinch', 'dash', 'handful', 'sprig', 'sprigs', 'knob', 'sheet',
    'ball', 'round', 'joint', 'rib', 'ribs', 'cube'
  ];
  const unitPattern = unitNames.join('|');

  // Extended regex to handle:
  // - Simple: 100 g
  // - Multiplier: 4 x 240g
  // - Range: 2-3 tbsp
  // - Fractions: 1/2 tsp, 1 1/2 tbsp
  // NOTE: Order matters! Try compound patterns first (mixed fraction, range, multiplier) before simple decimal
  const quantityRegex = new RegExp(
    `^(\\d+\\s+\\d+\\/\\d+|\\d+\\s*-\\s*\\d+|(?:\\d+\\s*x\\s*)?\\d+\\.?\\d*|\\d*\\.\\d+|\\d+\\s*/\\s*\\d+)\\s*(${unitPattern})?\\s+(.+)$`
  );

  let quantityRaw: string | null = null;
  let quantityValue: number | null = null;
  let unit: string | null = null;

  const quantityMatch = text.match(quantityRegex);
  if (quantityMatch) {
    let baseQuantity = quantityMatch[1].trim();
    unit = quantityMatch[2] || null;
    text = quantityMatch[3].trim();

    // Determine if unit was directly attached (no space) in the original text
    // by comparing the matched portion structure
    const matchedUpto = quantityMatch[0].substring(0, quantityMatch[0].length - quantityMatch[3].length).trim();
    const shouldIncludeUnit = unit && matchedUpto === `${baseQuantity}${unit}`;
    
    quantityRaw = shouldIncludeUnit ? `${baseQuantity}${unit}` : baseQuantity;

    // Convert baseQuantity to numeric value
    quantityValue = parseQuantity(baseQuantity);
  }

  // ===== STAGE 2: Second-pass classifier (item + qualifiers + preparation) =====
  let qualifiers: string[] = [];
  let preparation: string | null = null;

  // Extract parenthetical notes first (treat as qualifiers)
  const parenRegex = /\(([^)]+)\)/g;
  let parenMatch;
  while ((parenMatch = parenRegex.exec(text)) !== null) {
    qualifiers.push(parenMatch[1].trim());
    text = text.replace(`(${parenMatch[1]})`, '').trim();
  }

  // Split by known prep term delimiters to separate preparation from main text
  const prepTerms = getPreparationTerms();
  let remainingText = text;
  let prepStartIdx = -1;

  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    if (prepTerms.has(tokens[i])) {
      // Found a prep signal; everything from here is preparation
      prepStartIdx = i;
      break;
    }
  }

  if (prepStartIdx > 0) {
    // Join tokens before prep signal as item, everything after as preparation
    const itemTokens = tokens.slice(0, prepStartIdx);
    const prepTokens = tokens.slice(prepStartIdx);

    // Extract qualifiers (adjectives before item)
    const adjectiveSet = new Set([
      'fresh', 'dried', 'raw', 'cooked', 'prepared', 'extra', 'virgin',
      'sweet', 'salty', 'spicy', 'hot', 'cold', 'warm', 'room',
      'temperature', 'light', 'dark', 'heavy', 'fine', 'coarse', 'rough',
      'thin', 'thick', 'sharp', 'mild', 'strong', 'weak', 'soft', 'hard',
      'ripe', 'unripe', 'tender', 'tough', 'mature', 'young'
    ]);

    let qualifierIdx = 0;
    let currentQualifier: string[] = [];
    for (let i = 0; i < itemTokens.length; i++) {
      if (adjectiveSet.has(itemTokens[i])) {
        currentQualifier.push(itemTokens[i]);
        qualifierIdx = i + 1;
      } else {
        // Found first non-adjective; group accumulated adjectives
        if (currentQualifier.length > 0) {
          qualifiers.unshift(currentQualifier.join(' '));
        }
        break;
      }
    }

    const item = itemTokens.slice(qualifierIdx).join(' ').trim();
    preparation = prepTokens.join(' ').trim();

    return {
      quantityRaw,
      quantityValue,
      unit,
      item: item || 'unknown',
      qualifiers,
      preparation: preparation || null,
    };
  }

  // No prep signal found; split by adjectives vs nouns
  const adjectiveSet = new Set([
    'fresh', 'dried', 'raw', 'cooked', 'prepared', 'extra', 'virgin',
    'sweet', 'salty', 'spicy', 'hot', 'cold', 'warm', 'room',
    'temperature', 'light', 'dark', 'heavy', 'fine', 'coarse', 'rough',
    'thin', 'thick', 'sharp', 'mild', 'strong', 'weak', 'soft', 'hard',
    'ripe', 'unripe', 'tender', 'tough', 'mature', 'young'
  ]);

  let qualifierIdx = 0;
  let currentQualifier: string[] = [];
  const textTokens = text.split(/\s+/);
  
  for (let i = 0; i < textTokens.length; i++) {
    if (adjectiveSet.has(textTokens[i])) {
      currentQualifier.push(textTokens[i]);
      qualifierIdx = i + 1;
    } else {
      // Found first non-adjective; group accumulated adjectives and stop
      if (currentQualifier.length > 0) {
        qualifiers.push(currentQualifier.join(' '));
      }
      break;
    }
  }

  const item = textTokens.slice(qualifierIdx).join(' ').trim() || text;

  return {
    quantityRaw,
    quantityValue,
    unit,
    item,
    qualifiers,
    preparation: null,
  };
}
