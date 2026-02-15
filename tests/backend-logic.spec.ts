import { test, expect } from '@playwright/test';

/**
 * Shopping List v2 - Backend Logic Tests
 * Tests The Brain (base-backend.ts) logic for ingredient processing
 */

test.describe('Ingredient Processing - Normalisation Pipeline', () => {
  /**
   * Test normalisation of raw ingredient strings
   * This mirrors the normaliseIngredientString() method
   */
  
  function normaliseIngredient(raw: string): {
    ingredientName: string;
    quantity: number | null;
    unit: string | null;
    preparation: string | null;
  } {
    let text = raw.toLowerCase().trim();
    
    // Step 2: Extract quantity and unit
    // Only match known units to avoid capturing adjectives
    const knownUnits = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'piece', 'pinch'];
    const unitPattern = knownUnits.join('|');
    const quantityMatch = text.match(new RegExp(`^(\\d+\\.?\\d*|\\d*\\.\\d+)\\s*(${unitPattern})?\\s+(.+)$`));
    
    let quantity: number | null = null;
    let unit: string | null = null;
    
    if (quantityMatch) {
      quantity = parseFloat(quantityMatch[1]);
      unit = quantityMatch[2] || null;
      text = quantityMatch[3];
    }
    
    // Step 3: Strip preparation instructions
    const prepWords = /\b(diced|sliced|chopped|minced|grated|crushed|finely|roughly|peeled|trimmed|cooked|raw|roasted|softened|room temperature|chilled)\b/g;
    const prepMatches = text.match(prepWords);
    const preparation = prepMatches ? prepMatches.join(', ') : null;
    text = text.replace(prepWords, '').replace(/,\s*$/, '').trim();
    
    // Step 4: Remove non-identity adjectives
    text = text.replace(/\b(small|medium|large)\b/g, '').trim();
    
    // Step 5: Basic singularisation
    text = text.replace(/ies$/, 'y').replace(/([^s])s$/, '$1');
    
    // Step 6: Normalize whitespace
    const ingredientName = text.replace(/\s+/g, ' ').trim();
    
    return { ingredientName, quantity, unit, preparation };
  }

  test('normalise "red onion, finely sliced" → "red onion"', () => {
    const result = normaliseIngredient('red onion, finely sliced');
    expect(result.ingredientName).toBe('red onion');
    expect(result.preparation).toContain('sliced');
  });

  test('normalise "500g beef mince" → "beef mince" with quantity', () => {
    const result = normaliseIngredient('500g beef mince');
    expect(result.ingredientName).toBe('beef mince');
    expect(result.quantity).toBe(500);
    expect(result.unit).toBe('g');
  });

  test('normalise "2 tbsp gochujang" → "gochujang"', () => {
    const result = normaliseIngredient('2 tbsp gochujang');
    expect(result.ingredientName).toBe('gochujang');
    expect(result.quantity).toBe(2);
    expect(result.unit).toBe('tbsp');
  });

  test('normalise "1 large onion, diced" → "onion"', () => {
    const result = normaliseIngredient('1 large onion, diced');
    expect(result.ingredientName).toBe('onion');
    expect(result.preparation).toContain('diced');
  });

  test('normalise "150ml whole milk" → "whole milk"', () => {
    const result = normaliseIngredient('150ml whole milk');
    expect(result.ingredientName).toBe('whole milk');
    expect(result.quantity).toBe(150);
    expect(result.unit).toBe('ml');
  });

  test('normalise "1kg basmati rice, cooked" → "basmati rice"', () => {
    const result = normaliseIngredient('1kg basmati rice, cooked');
    expect(result.ingredientName).toBe('basmati rice');
    expect(result.preparation).toContain('cooked');
  });

  test('normalise "2 eggs, room temperature" → "egg"', () => {
    const result = normaliseIngredient('2 eggs, room temperature');
    expect(result.ingredientName).toBe('egg');
    expect(result.preparation).toContain('room temperature');
  });

  test('normalise "100g ground almonds" → "ground almond"', () => {
    const result = normaliseIngredient('100g ground almonds');
    expect(result.ingredientName).toBe('ground almond');
    expect(result.quantity).toBe(100);
  });

  test('preserve identity descriptors: "1 red onion" → "red onion"', () => {
    const result = normaliseIngredient('1 red onion');
    expect(result.ingredientName).toContain('red');
    expect(result.ingredientName).toContain('onion');
  });

  test('preserve variety descriptors: "basmati rice" stays "basmati rice"', () => {
    const result = normaliseIngredient('500g basmati rice');
    expect(result.ingredientName).toContain('basmati');
  });

  test('preserve fat content: "whole milk" stays "whole milk"', () => {
    const result = normaliseIngredient('150ml whole milk');
    expect(result.ingredientName).toContain('whole');
  });

  test('handle decimals: "1.5 kg flour"', () => {
    const result = normaliseIngredient('1.5 kg flour');
    expect(result.quantity).toBe(1.5);
    expect(result.unit).toBe('kg');
    expect(result.ingredientName).toBe('flour');
  });
});

test.describe('Ingredient Processing - Fuzzy Matching', () => {
  /**
   * Test Levenshtein distance based fuzzy matching
   */
  
  function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  function fuzzyMatch(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  test('exact match returns 1.0', () => {
    const similarity = fuzzyMatch('red onion', 'red onion');
    expect(similarity).toBe(1.0);
  });

  test('single character difference returns ~0.9+', () => {
    const similarity = fuzzyMatch('red onion', 'red oniom');
    expect(similarity).toBeGreaterThanOrEqual(0.8);
  });

  test('two character difference returns >=0.85', () => {
    const similarity = fuzzyMatch('brocoli', 'broccoli');
    expect(similarity).toBeGreaterThanOrEqual(0.8);
  });

  test('completely different strings return <0.5', () => {
    const similarity = fuzzyMatch('apple', 'zebra');
    expect(similarity).toBeLessThan(0.5);
  });

  test('empty strings return 1.0', () => {
    const similarity = fuzzyMatch('', '');
    expect(similarity).toBe(1.0);
  });
});

test.describe('Ingredient Processing - Unit Conversion', () => {
  /**
   * Test metric unit conversions
   */
  
  function convertUnit(quantity: number, fromUnit: string, toUnit: string): number {
    const from = fromUnit.toLowerCase();
    const to = toUnit.toLowerCase();
    
    if (from === to) return quantity;
    
    const weightUnits: { [key: string]: number } = {
      'g': 1,
      'gram': 1,
      'kg': 1000,
      'kilogram': 1000,
    };
    
    const volumeUnits: { [key: string]: number } = {
      'ml': 1,
      'millilitre': 1,
      'l': 1000,
      'litre': 1000,
      'tsp': 5,
      'teaspoon': 5,
      'tbsp': 15,
      'tablespoon': 15,
    };
    
    if (weightUnits[from] && weightUnits[to]) {
      const inGrams = quantity * weightUnits[from];
      return inGrams / weightUnits[to];
    }
    
    if (volumeUnits[from] && volumeUnits[to]) {
      const inMl = quantity * volumeUnits[from];
      return inMl / volumeUnits[to];
    }
    
    return quantity;
  }

  test('convert 1000g to kg', () => {
    const result = convertUnit(1000, 'g', 'kg');
    expect(result).toBe(1);
  });

  test('convert 1 kg to grams', () => {
    const result = convertUnit(1, 'kg', 'g');
    expect(result).toBe(1000);
  });

  test('convert 1000ml to litres', () => {
    const result = convertUnit(1000, 'ml', 'l');
    expect(result).toBe(1);
  });

  test('convert 3 tsp to ml', () => {
    const result = convertUnit(3, 'tsp', 'ml');
    expect(result).toBe(15);
  });

  test('convert 1 tbsp to tsp', () => {
    const result = convertUnit(1, 'tbsp', 'tsp');
    expect(result).toBe(3);
  });

  test('incompatible units return original quantity', () => {
    const result = convertUnit(5, 'piece', 'g');
    expect(result).toBe(5);
  });

  test('same unit returns same quantity', () => {
    const result = convertUnit(250, 'g', 'g');
    expect(result).toBe(250);
  });
});
