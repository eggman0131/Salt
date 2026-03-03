/**
 * Pure logic tests for categorization
 * 
 * No Firebase, no mocks, no side effects.
 * These run instantly and are completely deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCategorizationPrompt,
  extractIngredientNames,
  parseAICategoryResponse,
  sanitizeJson,
  validateCategoryNameUniqueness
} from '../logic/categorization';
import { Recipe, RecipeCategory } from '../../../types/contract';

describe('Categorisation Logic', () => {
  describe('extractIngredientNames', () => {
    it('extracts from string ingredients', () => {
      const recipe: Recipe = {
        id: '1',
        title: 'Test',
        ingredients: ['flour', 'butter', 'sugar'],
        cuisines: [],
        complexity: 'easy',
        servings: 4,
      } as Recipe;

      const names = extractIngredientNames(recipe);
      expect(names).toEqual(['flour', 'butter', 'sugar']);
    });

    it('extracts from object ingredients', () => {
      const recipe: Recipe = {
        id: '1',
        title: 'Test',
        ingredients: [
          { ingredientName: 'flour', quantity: 100 },
          { ingredientName: 'butter', quantity: 50 },
        ],
        cuisines: [],
        complexity: 'easy',
        servings: 4,
      } as Recipe;

      const names = extractIngredientNames(recipe);
      expect(names).toContain('flour');
      expect(names).toContain('butter');
    });

    it('returns empty array for no ingredients', () => {
      const recipe: Recipe = {
        id: '1',
        title: 'Test',
        ingredients: [],
        cuisines: [],
        complexity: 'easy',
        servings: 4,
      } as Recipe;

      const names = extractIngredientNames(recipe);
      expect(names).toEqual([]);
    });
  });

  describe('sanitizeJson', () => {
    it('extracts JSON array from markdown', () => {
      const text = 'Here is my response: ```json\n["cat-1", "cat-2"]\n```';
      const result = sanitizeJson(text);
      expect(result).toEqual('["cat-1", "cat-2"]');
    });

    it('extracts JSON object from text', () => {
      const text = 'The result is {"id": "cat-1"}';
      const result = sanitizeJson(text);
      expect(result).toEqual('{"id": "cat-1"}');
    });

    it('handles plain JSON', () => {
      const text = '["cat-1", "cat-2"]';
      const result = sanitizeJson(text);
      expect(result).toEqual('["cat-1", "cat-2"]');
    });
  });

  describe('parseAICategoryResponse', () => {
    it('parses valid JSON array', () => {
      const response = '["cat-1", "cat-2"]';
      const result = parseAICategoryResponse(response);
      expect(result).toEqual(['cat-1', 'cat-2']);
    });

    it('returns empty array for invalid JSON', () => {
      const response = 'not json at all';
      const result = parseAICategoryResponse(response);
      expect(result).toEqual([]);
    });

    it('returns empty array if parsed value is not an array', () => {
      const response = '{"id": "cat-1"}';
      const result = parseAICategoryResponse(response);
      expect(result).toEqual([]);
    });
  });

  describe('validateCategoryNameUniqueness', () => {
    const existing: RecipeCategory[] = [
      {
        id: 'cat-1',
        name: 'Breakfast',
        isApproved: true,
        synonyms: ['Morning', 'Brekkie'],
      } as RecipeCategory,
      {
        id: 'cat-2',
        name: 'Lunch',
        isApproved: true,
        synonyms: [],
      } as RecipeCategory,
    ];

    it('validates new unique names', () => {
      const result = validateCategoryNameUniqueness('Dinner', existing);
      expect(result.valid).toBe(true);
    });

    it('rejects duplicate category names', () => {
      const result = validateCategoryNameUniqueness('Breakfast', existing);
      expect(result.valid).toBe(false);
      expect(result.conflictingId).toBe('cat-1');
    });

    it('rejects names matching existing synonyms', () => {
      const result = validateCategoryNameUniqueness('Morning', existing);
      expect(result.valid).toBe(false);
      expect(result.conflictingId).toBe('cat-1');
    });

    it('is case-insensitive', () => {
      const result = validateCategoryNameUniqueness('BREAKFAST', existing);
      expect(result.valid).toBe(false);
    });

    it('trims whitespace', () => {
      const result = validateCategoryNameUniqueness('  Breakfast  ', existing);
      expect(result.valid).toBe(false);
    });
  });

  describe('buildCategorizationPrompt', () => {
    const recipe: Recipe = {
      id: '1',
      title: 'Scrambled Eggs',
      description: 'Fluffy eggs',
      ingredients: ['eggs', 'butter', 'salt'],
      complexity: 'easy',
      cuisines: [],
      servings: 2,
    } as Recipe;

    const existing: RecipeCategory[] = [
      {
        id: 'cat-1',
        name: 'Breakfast',
        isApproved: true,
        synonyms: [],
      } as RecipeCategory,
    ];

    it('includes recipe details', () => {
      const prompt = buildCategorizationPrompt(recipe, existing);
      expect(prompt).toContain('Scrambled Eggs');
      expect(prompt).toContain('Fluffy eggs');
      expect(prompt).toContain('eggs');
    });

    it('includes existing approved categories', () => {
      const prompt = buildCategorizationPrompt(recipe, existing);
      expect(prompt).toContain('Breakfast');
    });

    it('limits ingredients to first 10', () => {
      const manyIngredients: Recipe = {
        ...recipe,
        ingredients: Array.from({ length: 20 }, (_, i) => `ingredient-${i}`),
      } as Recipe;
      const prompt = buildCategorizationPrompt(manyIngredients, existing);
      expect(prompt).toContain('ingredient-9');
      expect(prompt).not.toContain('ingredient-15');
    });
  });
});
