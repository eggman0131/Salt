import { describe, it, expect, beforeEach } from 'vitest';
import { BaseRecipesBackend } from '../backend/base-recipes-backend';
import type { RecipesBackendInterface } from '../backend/recipes-backend.interface';
import type { Recipe } from '../../../types/contract';

/**
 * Recipes Backend Tests
 * Tests the base recipes backend interface and implementations
 */

describe('Recipes Backend - Recipe Management', () => {
  let backend: RecipesBackendInterface;

  beforeEach(() => {
    backend = new BaseRecipesBackend();
  });

  it('should create a new recipe', async () => {
    const recipe = await backend.createRecipe({
      title: 'Tomato Pasta',
      slug: 'tomato-pasta',
      category: 'Main Courses',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 20,
      ingredients: [
        {
          canonicalItemId: 'tomato',
          quantity: 400,
          unit: 'g',
        },
      ],
      instructions: ['Cook pasta', 'Make sauce', 'Combine'],
      userId: 'user-1',
    });

    expect(recipe).toBeDefined();
    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBe('Tomato Pasta');
    expect(recipe.ingredients).toHaveLength(1);
  });

  it('should retrieve recipe by ID', async () => {
    const created = await backend.createRecipe({
      title: 'Test Recipe',
      slug: 'test-recipe',
      category: 'Main Courses',
      servings: 2,
      prepMinutes: 5,
      cookMinutes: 15,
      ingredients: [],
      instructions: ['Step 1'],
      userId: 'user-1',
    });

    const retrieved = await backend.getRecipe(created.id);
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.title).toBe('Test Recipe');
  });

  it('should retrieve recipe by slug', async () => {
    const created = await backend.createRecipe({
      title: 'Unique Recipe',
      slug: 'unique-recipe-slug',
      category: 'Desserts',
      servings: 6,
      prepMinutes: 20,
      cookMinutes: 30,
      ingredients: [],
      instructions: ['Bake'],
      userId: 'user-1',
    });

    const retrieved = await backend.getRecipeBySlug('unique-recipe-slug');
    expect(retrieved.id).toBe(created.id);
  });

  it('should update recipe metadata', async () => {
    const recipe = await backend.createRecipe({
      title: 'Original Title',
      slug: 'original-slug',
      category: 'Main Courses',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 20,
      ingredients: [],
      instructions: ['Step 1'],
      userId: 'user-1',
    });

    const updated = await backend.updateRecipe(recipe.id, {
      title: 'Updated Title',
      servings: 6,
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.servings).toBe(6);
  });

  it('should delete a recipe', async () => {
    const recipe = await backend.createRecipe({
      title: 'To Delete',
      slug: 'to-delete',
      category: 'Main Courses',
      servings: 2,
      prepMinutes: 10,
      cookMinutes: 10,
      ingredients: [],
      instructions: ['Step 1'],
      userId: 'user-1',
    });

    await backend.deleteRecipe(recipe.id);

    expect(async () => {
      await backend.getRecipe(recipe.id);
    }).rejects.toThrow();
  });
});

describe('Recipes Backend - Recipe Search and Filtering', () => {
  let backend: RecipesBackendInterface;

  beforeEach(async () => {
    backend = new BaseRecipesBackend();

    // Create test recipes
    await backend.createRecipe({
      title: 'Quick Pasta',
      slug: 'quick-pasta',
      category: 'Main Courses',
      servings: 2,
      prepMinutes: 5,
      cookMinutes: 10,
      ingredients: [],
      instructions: ['Cook'],
      userId: 'user-1',
    });

    await backend.createRecipe({
      title: 'Slow Roast',
      slug: 'slow-roast',
      category: 'Main Courses',
      servings: 6,
      prepMinutes: 15,
      cookMinutes: 120,
      ingredients: [],
      instructions: ['Roast'],
      userId: 'user-1',
    });

    await backend.createRecipe({
      title: 'Chocolate Cake',
      slug: 'chocolate-cake',
      category: 'Desserts',
      servings: 8,
      prepMinutes: 20,
      cookMinutes: 45,
      ingredients: [],
      instructions: ['Bake'],
      userId: 'user-1',
    });
  });

  it('should get recipes by category', async () => {
    const recipes = await backend.getRecipesByCategory('Main Courses');
    expect(recipes.length).toBeGreaterThanOrEqual(2);
    expect(recipes.every(r => r.category === 'Main Courses')).toBe(true);
  });

  it('should get user recipes', async () => {
    const recipes = await backend.getUserRecipes('user-1');
    expect(recipes.length).toBeGreaterThanOrEqual(3);
  });

  it('should filter quick recipes (prep + cook < 30 mins)', async () => {
    const recipes = await backend.getUserRecipes('user-1');
    const quick = recipes.filter(r => (r.prepMinutes || 0) + (r.cookMinutes || 0) < 30);
    
    expect(quick.some(r => r.title === 'Quick Pasta')).toBe(true);
    expect(quick.every(r => (r.prepMinutes || 0) + (r.cookMinutes || 0) < 30)).toBe(true);
  });
});

describe('Recipes Backend - Ingredient Management', () => {
  let backend: RecipesBackendInterface;
  let testRecipe: Recipe;

  beforeEach(async () => {
    backend = new BaseRecipesBackend();
    testRecipe = await backend.createRecipe({
      title: 'Test Recipe',
      slug: 'test-recipe',
      category: 'Main Courses',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 20,
      ingredients: [
        {
          canonicalItemId: 'tomato',
          quantity: 400,
          unit: 'g',
        },
      ],
      instructions: ['Cook'],
      userId: 'user-1',
    });
  });

  it('should add ingredient to recipe', async () => {
    const updated = await backend.updateRecipe(testRecipe.id, {
      ingredients: [
        ...testRecipe.ingredients,
        {
          canonicalItemId: 'basil',
          quantity: 20,
          unit: 'g',
        },
      ],
    });

    expect(updated.ingredients).toHaveLength(2);
    expect(updated.ingredients.some(i => i.canonicalItemId === 'basil')).toBe(true);
  });

  it('should modify ingredient quantity', async () => {
    const updated = await backend.updateRecipe(testRecipe.id, {
      ingredients: [
        {
          canonicalItemId: 'tomato',
          quantity: 800,
          unit: 'g',
        },
      ],
    });

    const tomato = updated.ingredients.find(i => i.canonicalItemId === 'tomato');
    expect(tomato?.quantity).toBe(800);
  });

  it('should remove ingredient from recipe', async () => {
    const updated = await backend.updateRecipe(testRecipe.id, {
      ingredients: [],
    });

    expect(updated.ingredients).toHaveLength(0);
  });
});

describe('Recipes Backend - Error Handling', () => {
  let backend: RecipesBackendInterface;

  beforeEach(() => {
    backend = new BaseRecipesBackend();
  });

  it('should require recipe title', async () => {
    expect(async () => {
      await backend.createRecipe({
        title: '',
        slug: 'blank-title',
        category: 'Main Courses',
        servings: 2,
        prepMinutes: 10,
        cookMinutes: 10,
        ingredients: [],
        instructions: ['Step 1'],
        userId: 'user-1',
      });
    }).rejects.toThrow();
  });

  it('should require unique slug per user', async () => {
    await backend.createRecipe({
      title: 'Recipe',
      slug: 'unique-slug',
      category: 'Main Courses',
      servings: 2,
      prepMinutes: 10,
      cookMinutes: 10,
      ingredients: [],
      instructions: ['Step 1'],
      userId: 'user-1',
    });

    expect(async () => {
      await backend.createRecipe({
        title: 'Different Recipe',
        slug: 'unique-slug',
        category: 'Main Courses',
        servings: 2,
        prepMinutes: 10,
        cookMinutes: 10,
        ingredients: [],
        instructions: ['Step 1'],
        userId: 'user-1',
      });
    }).rejects.toThrow();
  });

  it('should handle invalid recipe ID', async () => {
    expect(async () => {
      await backend.getRecipe('invalid-id');
    }).rejects.toThrow();
  });
});
