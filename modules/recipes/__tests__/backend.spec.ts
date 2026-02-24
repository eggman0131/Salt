import { describe, it, expect, beforeEach } from 'vitest';
import type { IRecipesBackend } from '../backend/recipes-backend.interface';
import type { Recipe } from '../../../types/contract';

/**
 * Recipes Backend Tests
 * Tests the recipes backend interface and implementations
 */

type RecipeInput = Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>;

const buildRecipeInput = (overrides: Partial<RecipeInput> = {}): RecipeInput => ({
  title: 'Tomato Pasta',
  description: 'Classic tomato pasta with basil.',
  ingredients: [
    {
      id: 'ri-1',
      raw: '400 g tomatoes',
      quantity: 400,
      unit: 'g',
      ingredientName: 'tomatoes',
      canonicalItemId: 'tomato',
    },
  ],
  instructions: ['Cook pasta', 'Make sauce', 'Combine'],
  equipmentNeeded: ['Frying Pan'],
  prepTime: '10 mins',
  cookTime: '20 mins',
  totalTime: '30 mins',
  servings: '4',
  complexity: 'Simple',
  ...overrides,
});

class InMemoryRecipesBackend implements IRecipesBackend {
  private recipes = new Map<string, Recipe>();

  async getRecipes(): Promise<Recipe[]> {
    return Array.from(this.recipes.values());
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    return this.recipes.get(id) ?? null;
  }

  async createRecipe(recipe: RecipeInput, imageData?: string): Promise<Recipe> {
    const id = `rec-${Math.random().toString(36).slice(2, 10)}`;
    const createdAt = new Date().toISOString();
    const createdBy = 'test';
    const imagePath = imageData ? `recipes/${id}/image.jpg` : undefined;
    const created: Recipe = { ...recipe, id, createdAt, createdBy, imagePath };
    this.recipes.set(id, created);
    return created;
  }

  async updateRecipe(id: string, updates: Partial<Recipe>, imageData?: string): Promise<Recipe> {
    const existing = this.recipes.get(id);
    if (!existing) {
      throw new Error('Recipe not found');
    }
    const imagePath = imageData ? `recipes/${id}/image.jpg` : (updates.imagePath ?? existing.imagePath);
    const updated: Recipe = { ...existing, ...updates, imagePath };
    this.recipes.set(id, updated);
    return updated;
  }

  async resolveImagePath(path: string): Promise<string> {
    return path ? `resolved:${path}` : '';
  }

  async deleteRecipe(id: string): Promise<void> {
    this.recipes.delete(id);
  }

  async generateRecipeFromPrompt(): Promise<Partial<Recipe>> {
    return {};
  }

  async chatWithRecipe(): Promise<string> {
    return '';
  }

  async summarizeAgreedRecipe(): Promise<string> {
    return '';
  }

  async chatForDraft(): Promise<string> {
    return '';
  }

  async generateRecipeImage(title: string, description?: string, ingredients?: string[]): Promise<string> {
    return '';
  }

  async importRecipeFromUrl(): Promise<Partial<Recipe>> {
    return {};
  }
}

describe('Recipes Backend - Recipe Management', () => {
  let backend: IRecipesBackend;

  beforeEach(() => {
    backend = new InMemoryRecipesBackend();
  });

  it('should create a new recipe', async () => {
    const recipe = await backend.createRecipe(buildRecipeInput());

    expect(recipe).toBeDefined();
    expect(recipe.id).toBeDefined();
    expect(recipe.title).toBe('Tomato Pasta');
    expect(recipe.ingredients).toHaveLength(1);
  });

  it('should retrieve recipe by ID', async () => {
    const created = await backend.createRecipe(
      buildRecipeInput({
        title: 'Test Recipe',
        ingredients: [],
        instructions: ['Step 1'],
      })
    );

    const retrieved = await backend.getRecipe(created.id);
    if (!retrieved) {
      throw new Error('Expected recipe to exist');
    }
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.title).toBe('Test Recipe');
  });

  it('should update recipe metadata', async () => {
    const recipe = await backend.createRecipe(
      buildRecipeInput({
        title: 'Original Title',
        ingredients: [],
        instructions: ['Step 1'],
      })
    );

    const updated = await backend.updateRecipe(recipe.id, {
      title: 'Updated Title',
      servings: '6',
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.servings).toBe('6');
  });

  it('should delete a recipe', async () => {
    const recipe = await backend.createRecipe(
      buildRecipeInput({
        title: 'To Delete',
        ingredients: [],
        instructions: ['Step 1'],
      })
    );

    await backend.deleteRecipe(recipe.id);

    const deleted = await backend.getRecipe(recipe.id);
    expect(deleted).toBeNull();
  });
});

describe('Recipes Backend - Ingredient Management', () => {
  let backend: IRecipesBackend;
  let testRecipe: Recipe;

  beforeEach(async () => {
    backend = new InMemoryRecipesBackend();
    testRecipe = await backend.createRecipe(
      buildRecipeInput({
        title: 'Test Recipe',
        instructions: ['Cook'],
      })
    );
  });

  it('should add ingredient to recipe', async () => {
    const updated = await backend.updateRecipe(testRecipe.id, {
      ingredients: [
        ...testRecipe.ingredients,
        {
          id: 'ri-2',
          raw: '20 g basil',
          quantity: 20,
          unit: 'g',
          ingredientName: 'basil',
          canonicalItemId: 'basil',
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
          id: 'ri-1',
          raw: '800 g tomatoes',
          quantity: 800,
          unit: 'g',
          ingredientName: 'tomatoes',
          canonicalItemId: 'tomato',
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
  let backend: IRecipesBackend;

  beforeEach(() => {
    backend = new InMemoryRecipesBackend();
  });

  it('should handle invalid recipe ID', async () => {
    const recipe = await backend.getRecipe('invalid-id');
    expect(recipe).toBeNull();
  });
});
