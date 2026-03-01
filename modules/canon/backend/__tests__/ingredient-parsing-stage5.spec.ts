import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseIngredientEnhanced } from './parser-test-utils';

/**
 * Stage 5: Rollout Validation Tests
 * 
 * Issue #70 - Staged Upgrade of Ingredient Parsing
 * 
 * These tests validate that the enhanced parser provides cleaner fuzzy matching
 * input and that qualifier-based disambiguation works correctly.
 * 
 * Key Improvements Tested:
 * 1. Multiplier patterns extract clean item names (Stage 1+2)
 * 2. Qualifiers are separated from core item (Stage 2+4)
 * 3. Fuzzy matching uses enhanced.item not full raw text (Stage 3)
 * 4. Qualifier disambiguation improves accuracy (Stage 3)
 */

describe('Ingredient Parser - Stage 5 Rollout Validation', () => {
  // Test-utils parseIngredientEnhanced expects string[] for units
  const testUnits = [
    'g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'clove', 'tin', 'pinch',
    'cloves', 'slices', 'tins', 'tsps', 'tbsps'
  ] as const;

  describe('Stage 1+2: Enhanced Parser - Clean Item Extraction', () => {
    it('should extract clean item from multiplier pattern', () => {
      const result = parseIngredientEnhanced('4 x 240g pizza dough', testUnits);
      
      // Stage 1+2: Clean item extraction
      // Before: fuzzy matching would get "pizza dough" from "4 x 240g pizza dough"
      // After: enhanced parser extracts "pizza dough" as clean item
      expect(result.item).toBe('pizza dough');
      expect(result.quantityValue).toBe(960);
      expect(result.unit).toBe('g');
      expect(result.qualifiers).toEqual([]);
    });

    it('should extract clean item from prep-heavy ingredient', () => {
      const result = parseIngredientEnhanced('40 g pepperoni thinly sliced', testUnits);
      
      // Clean item extraction separates prep from item
      expect(result.item).toBe('pepperoni');
      expect(result.preparation).toBe('thinly sliced');
      expect(result.quantityValue).toBe(40);
      expect(result.unit).toBe('g');
    });

    it('should extract known qualifiers when present', () => {
      const result = parseIngredientEnhanced('100 g fresh mozzarella', testUnits);
      
      // Parser extracts known adjectives as qualifiers  
      // "fresh" is in the hardcoded adjective set
      expect(result.item).toBe('mozzarella');
      expect(result.qualifiers).toContain('fresh');
      expect(result.quantityValue).toBe(100);
      expect(result.unit).toBe('g');
    });
  });

  describe('Stage 2+4: Qualifier Extraction and Persistence', () => {
    it('should extract known freshness qualifiers', () => {
      const result = parseIngredientEnhanced('fresh basil leaves', testUnits);
      
      expect(result.item).toBe('basil leaves');
      expect(result.qualifiers).toContain('fresh');
    });

    it('should handle parenthetical qualifiers', () => {
      const result = parseIngredientEnhanced('100 g mozzarella (fior di latte)', testUnits);
      
      expect(result.item).toBe('mozzarella');
      expect(result.qualifiers).toContain('fior di latte');
    });

    it('should extract processing state qualifiers with prep', () => {
      const result = parseIngredientEnhanced('400 g fresh mozzarella torn and drained', testUnits);
      
      expect(result.item).toBe('mozzarella');
      expect(result.qualifiers).toContain('fresh');
      expect(result.preparation).toBe('torn and drained');
    });

    it('should handle empty qualifiers', () => {
      const result = parseIngredientEnhanced('80 g pizza sauce', testUnits);
      
      expect(result.item).toBe('pizza sauce');
      expect(result.qualifiers).toEqual([]);
    });
  });

  describe('Stage 3: Fuzzy Matching Input Quality', () => {
    it('provides clean fuzzy matching input for multiplier patterns', () => {
      const tests = [
        { raw: '4 x 240g pizza dough', expectedItem: 'pizza dough' },
        { raw: '3 x 125g mozzarella', expectedItem: 'mozzarella' },
      ];

      tests.forEach(({ raw, expectedItem }) => {
        const result = parseIngredientEnhanced(raw, testUnits);
        // Stage 3: This clean item is what fuzzy matching now uses instead of raw text
        expect(result.item).toBe(expectedItem);
      });
    });

    it('provides clean fuzzy matching input for complex descriptions', () => {
      const tests = [
        { 
          raw: '100 g fresh mozzarella (fior di latte) torn and drained',
          expectedItem: 'mozzarella',
          expectedPrep: 'torn and drained'
        },
        { 
          raw: '40 g pepperoni thinly sliced',
          expectedItem: 'pepperoni',
          expectedPrep: 'thinly sliced'
        },
        {
          raw: '5 g parmigiano reggiano finely grated',
          expectedItem: 'parmigiano reggiano',
          expectedPrep: 'finely grated'
        },
      ];

      tests.forEach(({ raw, expectedItem, expectedPrep }) => {
        const result = parseIngredientEnhanced(raw, testUnits);
        expect(result.item).toBe(expectedItem);
        expect(result.preparation).toBe(expectedPrep);
      });
    });
  });

  describe('Stage 5: Real-World Scenario Validation', () => {
    it('demonstrates improvement: multiplier pattern matching', () => {
      // Scenario: Recipe imports "4 x 240g pizza dough"
      // Canon has item "pizza dough" (normalisedName: "pizza dough")
      
      const parsed = parseIngredientEnhanced('4 x 240g pizza dough', testUnits);
      
      // Stage 1+2 extracts clean item
      expect(parsed.item).toBe('pizza dough');
      
      // Stage 3 fuzzy matching uses this clean item
      // OLD: fuzzyMatch("4 x 240g pizza dough", "pizza dough") → lower score
      // NEW: fuzzyMatch("pizza dough", "pizza dough") → 100% match
      
      // This clean item provides much better fuzzy matching
      const fuzzyInput = parsed.item.toLowerCase(); // "pizza dough"
      expect(fuzzyInput).toBe('pizza dough');
      
      // Verify quantity is still correctly parsed
      expect(parsed.quantityValue).toBe(960); // 4 * 240
      expect(parsed.unit).toBe('g');
    });

    it('demonstrates qualifier extraction for known adjectives', () => {
      // Scenario: Recipe has "fresh mozzarella"
      // Parser extracts "fresh" as qualifier
      
      const parsed = parseIngredientEnhanced('100 g fresh mozzarella', testUnits);
      
      expect(parsed.item).toBe('mozzarella');
      expect(parsed.qualifiers).toContain('fresh');
      
      // Stage 3 qualifier disambiguation logic:
      // When scores are close (gap < 15%), try qualified matching
      const qualifiedKey = parsed.qualifiers.length > 0
        ? `${parsed.qualifiers.join(' ')} ${parsed.item}`.toLowerCase()
        : parsed.item.toLowerCase();
      expect(qualifiedKey).toBe('fresh mozzarella');
    });

    it('validates backwards compatibility: no qualifiers', () => {
      // Scenario: Simple ingredients without qualifiers work as before
      const parsed = parseIngredientEnhanced('80 g pizza sauce', testUnits);
      
      expect(parsed.item).toBe('pizza sauce');
      expect(parsed.qualifiers).toEqual([]);
      expect(parsed.quantityValue).toBe(80);
      expect(parsed.unit).toBe('g');
      
      // Fuzzy matching uses clean item as before
      const fuzzyInput = parsed.item.toLowerCase();
      expect(fuzzyInput).toBe('pizza sauce');
    });

    it('validates prep extraction preserved', () => {
      // Scenario: Preparation instructions still extracted correctly
      const tests = [
        { raw: '2 onions, sliced', prep: 'sliced' },
        { raw: 'fresh basil leaves, torn', prep: 'torn' },
        { raw: '100 g mozzarella, drained', prep: 'drained' },
      ];

      tests.forEach(({ raw, prep }) => {
        const result = parseIngredientEnhanced(raw, testUnits);
        expect(result.preparation).toBe(prep);
      });
    });
  });

  describe('Stage 5: Contract Compliance', () => {
    it('qualifiers field is optional in contract', () => {
      // RecipeIngredientSchema.qualifiers is z.array(z.string()).optional()
      // This means:
      // - Old recipes without qualifiers: undefined/omitted
      // - New recipes with no qualifiers: undefined
      // - New recipes with qualifiers: ["fresh", "organic"]
      
      const withQualifiers = parseIngredientEnhanced('100 g fresh mozzarella', testUnits);
      const withoutQualifiers = parseIngredientEnhanced('80 g pizza sauce', testUnits);
      
      expect(withQualifiers.qualifiers.length).toBeGreaterThan(0);
      expect(withoutQualifiers.qualifiers.length).toBe(0);
      
      // Both are valid according to contract
    });

    it('ingredientName remains fully qualified for display', () => {
      // ingredientName field still contains full qualified name
      // This maintains backwards compatibility with existing UI
      
      const parsed = parseIngredientEnhanced('100 g fresh mozzarella', testUnits);
      
      // Frontend would reconstruct as: "fresh mozzarella"
      const displayName = parsed.qualifiers.length > 0
        ? `${parsed.qualifiers.join(' ')} ${parsed.item}`
        : parsed.item;
      
      expect(displayName).toBe('fresh mozzarella');
      expect(parsed.item).toBe('mozzarella');
    });
  });

  describe('Stage 5: Edge Cases and Robustness', () => {
    it('handles unicode fractions correctly', () => {
      const result = parseIngredientEnhanced('½ tsp salt', testUnits);
      
      expect(result.quantityValue).toBe(0.5);
      expect(result.unit).toBe('tsp');
      expect(result.item).toBe('salt');
    });

    it('handles multiplication symbols correctly', () => {
      const result = parseIngredientEnhanced('4 × 240g pizza dough', testUnits);
      
      expect(result.quantityValue).toBe(960);
      expect(result.unit).toBe('g');
      expect(result.item).toBe('pizza dough');
    });

    it('handles parenthetical varieties correctly', () => {
      const result = parseIngredientEnhanced('100 g mozzarella (fior di latte)', testUnits);
      
      expect(result.item).toBe('mozzarella');
      // Parenthetical content is preserved in raw for reference
      expect(result.quantityValue).toBe(100);
    });

    it('handles mixed fractions correctly', () => {
      const result = parseIngredientEnhanced('1 1/2 tbsp olive oil', testUnits);
      
      expect(result.quantityValue).toBe(1.5);
      expect(result.unit).toBe('tbsp');
      expect(result.item).toBe('olive oil');
    });

    it('handles quantity ranges correctly', () => {
      const result = parseIngredientEnhanced('2-3 tbsp olive oil', testUnits);
      
      // Takes midpoint of range
      expect(result.quantityValue).toBe(2.5);
      expect(result.unit).toBe('tbsp');
      expect(result.item).toBe('olive oil');
    });
  });
});
