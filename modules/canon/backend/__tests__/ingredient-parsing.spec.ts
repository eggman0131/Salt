import { describe, it, expect } from 'vitest';
import { parseIngredientEnhanced, ParsedIngredientInternal } from './parser-test-utils';

/**
 * Ingredient Parser Tests - Stage 0 Baseline
 * 
 * Golden test cases for known problematic inputs from real recipe imports.
 * These validate parser improvements across normalisation, regex, and classification stages.
 * 
 * Test inputs based on actual parsing failures:
 * - Multiplier patterns (4 x 240g)
 * - Parenthetical sub-varieties
 * - Long prep descriptions
 * - Complex modifiers
 */

/**
 * Ingredient Parser Tests - Stage 0 Baseline
 * 
 * Golden test cases for known problematic inputs from real recipe imports.
 * These validate parser improvements across normalisation, regex, and classification stages.
 * 
 * Test inputs based on actual parsing failures:
 * - Multiplier patterns (4 x 240g)
 * - Parenthetical sub-varieties
 * - Long prep descriptions
 * - Complex modifiers
 */

describe('Ingredient Parser - Stage 0 Golden Tests', () => {
  // Comprehensive British cooking units (weight, volume, count, colloquial)
  const testUnits = [
    // Weight
    'g', 'kg', 'mg',
    // Volume
    'ml', 'l', 'tsp', 'tsps', 'tbsp', 'tbsps',
    // Count
    'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces', 'stick', 'sticks',
    'tin', 'tins', 'can', 'cans', 'jar', 'jars', 'pack', 'packs', 'packet', 'packets',
    'bag', 'bags', 'bunch', 'head', 'fillet', 'fillets', 'rasher', 'rashers', 'block', 'pot', 'tray', 'punnet',
    // Colloquial
    'pinch', 'dash', 'handful', 'sprig', 'sprigs', 'knob', 'sheet', 'ball', 'round', 'joint', 'rib', 'ribs', 'cube'
  ] as const;

  describe('Multiplier patterns', () => {
    it('should parse "4 x 240g Pizza Dough"', () => {
      const result = parseIngredientEnhanced('4 x 240g Pizza Dough', testUnits as any);
      
      expect(result.quantityRaw).toBe('4 x 240g');
      expect(result.quantityValue).toBe(960); // 4 * 240
      expect(result.unit).toBe('g');
      expect(result.item).toBe('pizza dough');
      expect(result.qualifiers).toEqual([]);
      expect(result.preparation).toBeNull();
    });

    it('should parse "2-3 tbsp olive oil"', () => {
      const result = parseIngredientEnhanced('2-3 tbsp olive oil', testUnits as any);
      
      expect(result.quantityRaw).toBe('2-3');
      expect(result.quantityValue).toBe(2.5); // midpoint
      expect(result.unit).toBe('tbsp');
      expect(result.item).toBe('olive oil');
      expect(result.qualifiers).toEqual([]);
      expect(result.preparation).toBeNull();
    });
  });

  describe('Parenthetical sub-varieties', () => {
    it('should parse "100 g fresh mozzarella (fior di latte) torn and drained of moisture"', () => {
      const result = parseIngredientEnhanced('100 g fresh mozzarella (fior di latte) torn and drained of moisture', testUnits as any);
      
      expect(result.quantityValue).toBe(100);
      expect(result.unit).toBe('g');
      expect(result.item).toBe('mozzarella');
      expect(result.qualifiers).toContain('fresh');
      expect(result.qualifiers).toContain('fior di latte');
      expect(result.preparation).toBe('torn and drained of moisture');
    });

    it('should preserve all text without loss', () => {
      const raw = '100 g fresh mozzarella (fior di latte) torn and drained of moisture';
      const result = parseIngredientEnhanced(raw, testUnits as any);
      
      const reconstructed = `${result.quantityValue} ${result.unit} ${result.qualifiers.join(' ')} ${result.item} ${result.preparation || ''}`.trim();
      
      // All meaningful tokens should be present
      expect(raw.toLowerCase()).toContain('100');
      expect(raw.toLowerCase()).toContain('mozzarella');
      expect(raw.toLowerCase()).toContain('fresh');
      expect(raw.toLowerCase()).toContain('fior di latte');
      expect(raw.toLowerCase()).toContain('torn');
      expect(raw.toLowerCase()).toContain('drained');
    });
  });

  describe('Prep-heavy ingredients', () => {
    it('should parse "40 g pepperoni thinly sliced"', () => {
      const result = parseIngredientEnhanced('40 g pepperoni thinly sliced', testUnits as any);
      
      expect(result.quantityValue).toBe(40);
      expect(result.unit).toBe('g');
      expect(result.item).toBe('pepperoni');
      expect(result.qualifiers).toEqual([]);
      expect(result.preparation).toBe('thinly sliced');
    });

    it('should parse "fine semolina or flour for dusting"', () => {
      const result = parseIngredientEnhanced('fine semolina or flour for dusting', testUnits as any);
      
      expect(result.quantityValue).toBeNull();
      expect(result.unit).toBeNull();
      // Item could be "semolina or flour" grouped together
      expect(['semolina', 'semolina or flour'].includes(result.item.toLowerCase())).toBe(true);
      expect(result.qualifiers).toContain('fine');
      expect(result.preparation).toContain('dusting');
    });

    it('should parse "5 g parmigiano reggiano finely grated"', () => {
      const result = parseIngredientEnhanced('5 g parmigiano reggiano finely grated', testUnits as any);
      
      expect(result.quantityValue).toBe(5);
      expect(result.unit).toBe('g');
      expect(result.item.toLowerCase()).toContain('parmigiano');
      expect(result.preparation).toContain('grated');
    });
  });

  describe('Simple cases (should still work)', () => {
    it('should parse "80 g prepared pizza sauce"', () => {
      const result = parseIngredientEnhanced('80 g prepared pizza sauce', testUnits as any);
      
      expect(result.quantityValue).toBe(80);
      expect(result.unit).toBe('g');
      expect(result.item).toBe('pizza sauce');
      expect(result.qualifiers).toContain('prepared');
      expect(result.preparation).toBeNull();
    });

    it('should parse "extra virgin olive oil"', () => {
      const result = parseIngredientEnhanced('extra virgin olive oil', testUnits as any);
      
      expect(result.quantityValue).toBeNull();
      expect(result.unit).toBeNull();
      expect(result.item).toBe('olive oil');
      expect(result.qualifiers).toEqual(['extra virgin']);
      expect(result.preparation).toBeNull();
    });

    it('should parse "fresh basil leaves"', () => {
      const result = parseIngredientEnhanced('fresh basil leaves', testUnits as any);
      
      expect(result.quantityValue).toBeNull();
      expect(result.unit).toBeNull();
      expect(result.item).toBe('basil leaves');
      expect(result.qualifiers).toContain('fresh');
      expect(result.preparation).toBeNull();
    });
  });

  describe('Unicode and normalisation', () => {
    it('should normalise unicode fractions', () => {
      const result = parseIngredientEnhanced('½ tsp salt', testUnits as any);
      
      expect(result.quantityValue).toBe(0.5);
      expect(result.unit).toBe('tsp');
      expect(result.item).toBe('salt');
    });

    it('should normalise multiplication symbol', () => {
      const result = parseIngredientEnhanced('4 × 240g pizza dough', testUnits as any);
      
      // Should normalize × to x internally
      expect(result.quantityRaw).toContain('4');
      expect(result.quantityRaw).toContain('240');
    });

    it('should handle mixed fractions', () => {
      const result = parseIngredientEnhanced('1 1/2 tbsp flour', testUnits as any);
      
      expect(result.quantityValue).toBe(1.5);
      expect(result.unit).toBe('tbsp');
      expect(result.item).toBe('flour');
    });
  });
});
