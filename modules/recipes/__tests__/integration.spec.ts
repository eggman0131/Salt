import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseRecipesBackend } from '../backend/base-recipes-backend';
import { canonBackend } from '../../canon';
import type {
  Aisle,
  CanonicalItem,
  Equipment,
  KitchenSettings,
  Recipe,
  RecipeCategory,
  RecipeIngredient,
  Unit,
} from '../../../types/contract';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

vi.mock('../../canon', () => ({
  canonBackend: {
    processIngredients: vi.fn(),
  },
}));

class IntegrationRecipesBackend extends BaseRecipesBackend {
  private recipes = new Map<string, Recipe>();

  protected async callGenerateContent(_params: GenerateContentParameters): Promise<GenerateContentResponse> {
    return { text: '{}' } as GenerateContentResponse;
  }

  protected async callGenerateContentStream(_params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
    return {
      async *[Symbol.asyncIterator]() {
        return;
      },
    };
  }

  protected async getSystemInstruction(): Promise<string> {
    return 'Test instruction';
  }

  protected async fetchUrlContent(): Promise<string> {
    return '';
  }

  async getRecipes(): Promise<Recipe[]> {
    return Array.from(this.recipes.values());
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    return this.recipes.get(id) || null;
  }

  async createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>): Promise<Recipe> {
    const created: Recipe = {
      ...recipe,
      id: `rec-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      createdBy: 'test-user',
    };
    this.recipes.set(created.id, created);
    return created;
  }

  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe> {
    const existing = this.recipes.get(id);
    if (!existing) {
      throw new Error(`Recipe not found: ${id}`);
    }

    const updated = { ...existing, ...updates } as Recipe;
    this.recipes.set(id, updated);
    return updated;
  }

  async deleteRecipe(id: string): Promise<void> {
    this.recipes.delete(id);
  }

  async resolveImagePath(): Promise<string> {
    return '';
  }

  async getInventory(): Promise<Equipment[]> {
    return [];
  }

  async getCategories(): Promise<RecipeCategory[]> {
    return [];
  }

  async createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory> {
    return {
      ...category,
      id: `cat-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
    };
  }

  async getCanonicalItems(): Promise<CanonicalItem[]> {
    return [];
  }

  async getCanonicalItem(): Promise<CanonicalItem | null> {
    return null;
  }

  async getUnits(): Promise<Unit[]> {
    return [];
  }

  async createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit> {
    return {
      ...unit,
      id: `unit-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
    };
  }

  async getAisles(): Promise<Aisle[]> {
    return [];
  }

  async createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle> {
    return {
      ...aisle,
      id: `aisle-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
    };
  }

  async getKitchenSettings(): Promise<KitchenSettings> {
    return {
      directives: 'Test kitchen directives',
      debugEnabled: false,
    };
  }
}

describe('Recipes-Canon Integration', () => {
  let backend: IntegrationRecipesBackend;

  beforeEach(() => {
    backend = new IntegrationRecipesBackend();
    vi.clearAllMocks();
  });

  it('delegates structured ingredient matching to canon', async () => {
    const input: RecipeIngredient[] = [
      {
        id: 'ri-1',
        raw: '2 red onions, finely diced',
        quantity: 2,
        unit: '',
        ingredientName: 'red onions',
        preparation: 'finely diced',
      },
    ];

    vi.mocked(canonBackend.processIngredients).mockResolvedValueOnce([
      {
        id: 'ring-rec-1-0',
        raw: '2 red onions, finely diced',
        quantity: 2,
        unit: '',
        ingredientName: 'red onion',
        preparation: 'finely diced',
        canonicalItemId: 'item-red-onion',
      },
    ]);

    const result = await backend.matchRecipeIngredients(input, 'rec-1');

    expect(canonBackend.processIngredients).toHaveBeenCalledWith(input, 'rec-1', undefined);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ring-rec-1-0');
    expect(result[0].canonicalItemId).toBe('item-red-onion');
  });

  it('delegates raw-string ingredient arrays to canon unchanged', async () => {
    const rawIngredients = ['500g beef mince', '1 red onion, finely diced'];

    vi.mocked(canonBackend.processIngredients).mockResolvedValueOnce([
      {
        id: 'ring-rec-raw-0',
        raw: '500g beef mince',
        quantity: 500,
        unit: 'g',
        ingredientName: 'beef mince',
        canonicalItemId: 'item-beef-mince',
      },
      {
        id: 'ring-rec-raw-1',
        raw: '1 red onion, finely diced',
        quantity: 1,
        unit: '',
        ingredientName: 'red onion',
        preparation: 'finely diced',
        canonicalItemId: 'item-red-onion',
      },
    ]);

    const result = await backend.matchRecipeIngredients(rawIngredients, 'rec-raw');

    expect(canonBackend.processIngredients).toHaveBeenCalledWith(rawIngredients, 'rec-raw', undefined);
    expect(result).toHaveLength(2);
    expect(result[0].canonicalItemId).toBe('item-beef-mince');
    expect(result[1].canonicalItemId).toBe('item-red-onion');
  });

  it('repairRecipe relinks ingredients via canon and updates instruction ingredient links', async () => {
    const recipe = await backend.createRecipe({
      title: 'Onion Soup',
      description: 'Test recipe',
      ingredients: [
        {
          id: 'ri-1',
          raw: '2 onions, sliced',
          quantity: 2,
          unit: '',
          ingredientName: 'onions',
          preparation: 'sliced',
        },
      ],
      instructions: [
        {
          id: 'step-1',
          text: 'Slice onions',
          ingredients: [
            {
              id: 'ri-1',
              raw: '2 onions, sliced',
              quantity: 2,
              unit: '',
              ingredientName: 'onions',
              preparation: 'sliced',
            },
          ],
          technicalWarnings: [],
        },
      ],
      equipmentNeeded: ['Saucepan'],
      prepTime: '10 mins',
      cookTime: '30 mins',
      totalTime: '40 mins',
      servings: '4',
      complexity: 'Simple',
      categoryIds: [],
    });

    vi.mocked(canonBackend.processIngredients).mockResolvedValueOnce([
      {
        id: 'ring-any',
        raw: '2 onions, sliced',
        quantity: 2,
        unit: '',
        ingredientName: 'onion',
        preparation: 'sliced',
        canonicalItemId: 'item-onion',
      },
    ]);

    const updated = await backend.repairRecipe(recipe.id, { relinkIngredients: true, categorize: false });

    expect(canonBackend.processIngredients).toHaveBeenCalledTimes(1);
    expect(updated.ingredients[0].id).toBe('ring-any');
    expect(updated.ingredients[0].canonicalItemId).toBe('item-onion');
    expect(updated.instructions[0].ingredients[0].id).toBe('ri-1');
    expect(updated.instructions[0].ingredients[0].canonicalItemId).toBeUndefined();
  });
});
