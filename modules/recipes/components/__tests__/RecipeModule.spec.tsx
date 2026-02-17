/**
 * Recipes Module - Frontend Contract Tests
 *
 * Test suite for RecipeModule React component focusing on:
 * - Contract compliance (Zod schema validation)
 * - Type safety (TypeScript type checking)
 * - Data consistency (linked references)
 * - Edge cases and boundaries
 */

import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  Recipe,
  RecipeIngredient,
  RecipeCategory,
} from '../../../../types/contract';
import {
  RecipeSchema,
  RecipeIngredientSchema,
  RecipeCategorySchema,
} from '../../../../types/contract';

// ============================================================================
// SECTION 1: Test Fixtures (Contract-Shaped Data)
// ============================================================================

const RECIPE_CATEGORIES_FIXTURE: RecipeCategory[] = [
  {
    id: 'cat-1',
    name: 'Starter',
    isApproved: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cat-2',
    name: 'Main Course',
    isApproved: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const RECIPE_INGREDIENTS_FIXTURE: RecipeIngredient[] = [
  {
    id: 'ing-1',
    raw: '2 red onions, diced',
    quantity: 2,
    unit: 'items',
    ingredientName: 'Red Onion',
    preparation: 'diced',
    canonicalItemId: 'item-onion',
  },
  {
    id: 'ing-2',
    raw: '500 g carrots',
    quantity: 500,
    unit: 'g',
    ingredientName: 'Carrot',
    canonicalItemId: 'item-carrot',
  },
];

const RECIPE_FIXTURE: Recipe = {
  id: 'recipe-1',
  title: 'Classic Vegetable Soup',
  description: 'A warming vegetable soup for cool evenings',
  ingredients: RECIPE_INGREDIENTS_FIXTURE,
  instructions: [
    'Heat oil in large hob',
    'Sauté onions until soft',
    'Add carrots and stock',
    'Simmer until tender',
    'Season and serve',
  ],
  equipmentNeeded: ['Large saucepan', 'Wooden spoon', 'Knife'],
  prepTime: '15 minutes',
  cookTime: '30 minutes',
  totalTime: '45 minutes',
  servings: '4 people',
  complexity: 'Simple',
  categoryIds: [RECIPE_CATEGORIES_FIXTURE[0].id],
  createdAt: '2024-01-01T00:00:00Z',
  createdBy: 'chef-user',
};

// ============================================================================
// SECTION 2: Contract Compliance Tests
// ============================================================================

describe('RecipeModule - Contract Compliance', () => {
  describe('Recipe Schema', () => {
    it('should validate recipe fixture conforms to schema', () => {
      expect(() => RecipeSchema.parse(RECIPE_FIXTURE)).not.toThrow();
    });

    it('should have all required fields', () => {
      const recipe = RECIPE_FIXTURE;
      expect(recipe.id).toBeDefined();
      expect(recipe.title).toBeDefined();
      expect(recipe.description).toBeDefined();
      expect(recipe.ingredients).toBeDefined();
      expect(recipe.instructions).toBeDefined();
      expect(recipe.equipmentNeeded).toBeDefined();
      expect(recipe.prepTime).toBeDefined();
      expect(recipe.cookTime).toBeDefined();
      expect(recipe.totalTime).toBeDefined();
      expect(recipe.servings).toBeDefined();
      expect(recipe.complexity).toBeDefined();
      expect(recipe.createdAt).toBeDefined();
      expect(recipe.createdBy).toBeDefined();
    });

    it('should reject recipe without id', () => {
      const invalid = { ...RECIPE_FIXTURE, id: undefined };
      expect(() => RecipeSchema.parse(invalid)).toThrow();
    });

    it('should reject recipe without instructions', () => {
      const invalid = { ...RECIPE_FIXTURE, instructions: undefined };
      expect(() => RecipeSchema.parse(invalid)).toThrow();
    });

    it('should reject recipe with invalid complexity', () => {
      const invalid = {
        ...RECIPE_FIXTURE,
        complexity: 'Moderate' as any,
      };
      expect(() => RecipeSchema.parse(invalid)).toThrow();
    });

    it('should accept recipe with valid complexity levels', () => {
      ['Simple', 'Intermediate', 'Advanced'].forEach(complexity => {
        const recipe: Recipe = {
          ...RECIPE_FIXTURE,
          complexity: complexity as any,
        };
        expect(() => RecipeSchema.parse(recipe)).not.toThrow();
      });
    });

    it('should accept recipe with optional image path', () => {
      const withImage: Recipe = {
        ...RECIPE_FIXTURE,
        imagePath: '/images/soup.jpg',
      };
      expect(() => RecipeSchema.parse(withImage)).not.toThrow();
    });

    it('should accept recipe without optional fields', () => {
      const minimal: Recipe = {
        ...RECIPE_FIXTURE,
        source: undefined,
        collection: undefined,
        imagePath: undefined,
        categoryIds: undefined,
        history: undefined,
      };
      expect(() => RecipeSchema.parse(minimal)).not.toThrow();
    });
  });

  describe('RecipeIngredient Schema', () => {
    it('should validate all fixture ingredients conform to schema', () => {
      RECIPE_INGREDIENTS_FIXTURE.forEach(ing => {
        expect(() => RecipeIngredientSchema.parse(ing)).not.toThrow();
      });
    });

    it('should have all required fields', () => {
      const ing = RECIPE_INGREDIENTS_FIXTURE[0];
      expect(ing.id).toBeDefined();
      expect(ing.raw).toBeDefined();
      expect(ing.ingredientName).toBeDefined();
    });

    it('should accept ingredient with null quantity', () => {
      const nullQty: RecipeIngredient = {
        ...RECIPE_INGREDIENTS_FIXTURE[0],
        quantity: null,
      };
      expect(() => RecipeIngredientSchema.parse(nullQty)).not.toThrow();
    });

    it('should accept ingredient with null unit', () => {
      const nullUnit: RecipeIngredient = {
        ...RECIPE_INGREDIENTS_FIXTURE[0],
        unit: null,
      };
      expect(() => RecipeIngredientSchema.parse(nullUnit)).not.toThrow();
    });
  });

  describe('RecipeCategory Schema', () => {
    it('should validate all fixture categories conform to schema', () => {
      RECIPE_CATEGORIES_FIXTURE.forEach(cat => {
        expect(() => RecipeCategorySchema.parse(cat)).not.toThrow();
      });
    });

    it('should have all required fields', () => {
      const cat = RECIPE_CATEGORIES_FIXTURE[0];
      expect(cat.id).toBeDefined();
      expect(cat.name).toBeDefined();
      expect(cat.createdAt).toBeDefined();
    });

    it('should default isApproved to true', () => {
      const noApproval = {
        id: 'cat-test',
        name: 'Test',
        createdAt: '2024-01-01T00:00:00Z',
      };
      const parsed = RecipeCategorySchema.parse(noApproval);
      expect(parsed.isApproved).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 3: Type Safety Tests
// ============================================================================

describe('RecipeModule - Type Safety', () => {
  it('should maintain type safety with Recipe', () => {
    const recipe: Recipe = RECIPE_FIXTURE;
    expectTypeOf(recipe).toMatchTypeOf<Recipe>();
  });

  it('should maintain type safety with RecipeIngredient', () => {
    const ing: RecipeIngredient = RECIPE_INGREDIENTS_FIXTURE[0];
    expectTypeOf(ing).toMatchTypeOf<RecipeIngredient>();
  });

  it('should maintain type safety with RecipeCategory', () => {
    const cat: RecipeCategory = RECIPE_CATEGORIES_FIXTURE[0];
    expectTypeOf(cat).toMatchTypeOf<RecipeCategory>();
  });

  it('should maintain array type safety', () => {
    const recipes: Recipe[] = [RECIPE_FIXTURE];
    expectTypeOf(recipes).toMatchTypeOf<Recipe[]>();
  });
});

// ============================================================================
// SECTION 4: Data Mutations & Transformations
// ============================================================================

describe('RecipeModule - Data Mutations', () => {
  it('should validate recipe with updated complexity', () => {
    const updated: Recipe = {
      ...RECIPE_FIXTURE,
      complexity: 'Advanced',
    };
    expect(() => RecipeSchema.parse(updated)).not.toThrow();
  });

  it('should validate recipe with updated instructions', () => {
    const updated: Recipe = {
      ...RECIPE_FIXTURE,
      instructions: ['New instruction 1', 'New instruction 2'],
    };
    expect(() => RecipeSchema.parse(updated)).not.toThrow();
  });

  it('should validate recipe with updated servings', () => {
    const updated: Recipe = {
      ...RECIPE_FIXTURE,
      servings: '6 people',
    };
    expect(() => RecipeSchema.parse(updated)).not.toThrow();
  });

  it('should validate ingredient with updated quantity', () => {
    const updated: RecipeIngredient = {
      ...RECIPE_INGREDIENTS_FIXTURE[0],
      quantity: 3,
    };
    expect(() => RecipeIngredientSchema.parse(updated)).not.toThrow();
  });

  it('should reject recipe with invalid complexity', () => {
    const invalid = {
      ...RECIPE_FIXTURE,
      complexity: 'Moderate' as any,
    };
    expect(() => RecipeSchema.parse(invalid)).toThrow();
  });
});

// ============================================================================
// SECTION 5: Module Boundaries
// ============================================================================

describe('RecipeModule - Module Boundaries', () => {
  it('should use only contract types', () => {
    const recipe: Recipe = RECIPE_FIXTURE;
    const ingredients: RecipeIngredient[] = RECIPE_INGREDIENTS_FIXTURE;
    const categories: RecipeCategory[] = RECIPE_CATEGORIES_FIXTURE;

    expectTypeOf(recipe).toMatchTypeOf<Recipe>();
    expectTypeOf(ingredients).toMatchTypeOf<RecipeIngredient[]>();
    expectTypeOf(categories).toMatchTypeOf<RecipeCategory[]>();
  });

  it('should not expose internal backend types', () => {
    const recipe = RECIPE_FIXTURE;
    expect('_id' in recipe).toBe(false);
    expect('_timestamp' in recipe).toBe(false);
    expect('__typename' in recipe).toBe(false);
  });
});

// ============================================================================
// SECTION 6: Data Consistency
// ============================================================================

describe('RecipeModule - Data Consistency', () => {
  it('should maintain consistent ingredient IDs', () => {
    const recipe = RECIPE_FIXTURE;
    const ingredients = recipe.ingredients;

    const ingredientIds = new Set(ingredients.map(i => i.id));
    expect(ingredientIds.size).toBe(ingredients.length);
  });

  it('should reference valid categories', () => {
    const recipe = RECIPE_FIXTURE;
    const categoryIds = RECIPE_CATEGORIES_FIXTURE.map(c => c.id);

    if (recipe.categoryIds) {
      recipe.categoryIds.forEach(catId => {
        expect(categoryIds).toContain(catId);
      });
    }
  });
});

// ============================================================================
// SECTION 7: Edge Cases & Boundaries
// ============================================================================

describe('RecipeModule - Edge Cases', () => {
  it('should accept recipe with very long title', () => {
    const longTitle: Recipe = {
      ...RECIPE_FIXTURE,
      title: 'A'.repeat(500),
    };
    expect(() => RecipeSchema.parse(longTitle)).not.toThrow();
  });

  it('should accept recipe with special characters', () => {
    const special: Recipe = {
      ...RECIPE_FIXTURE,
      title: 'Crème Brûlée & Soufflé',
      description: 'Avec du citron frais',
    };
    expect(() => RecipeSchema.parse(special)).not.toThrow();
  });

  it('should accept recipe with unicode', () => {
    const unicode: Recipe = {
      ...RECIPE_FIXTURE,
      title: '日本料理',
      description: '寿司と天ぷら',
    };
    expect(() => RecipeSchema.parse(unicode)).not.toThrow();
  });

  it('should accept recipe with many instructions', () => {
    const manySteps: Recipe = {
      ...RECIPE_FIXTURE,
      instructions: Array.from({ length: 50 }, (_, i) => `Step ${i + 1}`),
    };
    expect(() => RecipeSchema.parse(manySteps)).not.toThrow();
  });

  it('should accept recipe with many ingredients', () => {
    const manyIng: Recipe = {
      ...RECIPE_FIXTURE,
      ingredients: Array.from({ length: 50 }, (_, i) => ({
        id: `ing-${i}`,
        raw: `Ingredient ${i}`,
        quantity: i,
        unit: 'g',
        ingredientName: `Item ${i}`,
      })),
    };
    expect(() => RecipeSchema.parse(manyIng)).not.toThrow();
  });

  it('should accept recipe with zero ingredient ingredients', () => {
    const noIng: Recipe = {
      ...RECIPE_FIXTURE,
      ingredients: [],
    };
    expect(() => RecipeSchema.parse(noIng)).not.toThrow();
  });

  it('should accept all complexity levels', () => {
    const complexities = ['Simple', 'Intermediate', 'Advanced'] as const;
    complexities.forEach(c => {
      const recipe: Recipe = {
        ...RECIPE_FIXTURE,
        complexity: c,
      };
      expect(() => RecipeSchema.parse(recipe)).not.toThrow();
    });
  });

  it('should accept recipe with empty equipment list', () => {
    const noEquip: Recipe = {
      ...RECIPE_FIXTURE,
      equipmentNeeded: [],
    };
    expect(() => RecipeSchema.parse(noEquip)).not.toThrow();
  });

  it('should accept recipe without categories', () => {
    const noCats: Recipe = {
      ...RECIPE_FIXTURE,
      categoryIds: undefined,
    };
    expect(() => RecipeSchema.parse(noCats)).not.toThrow();
  });
});
