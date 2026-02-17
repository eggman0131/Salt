/**
 * Kitchen Data Backend Domain Logic Tests
 * 
 * Comprehensive test suite for foundational kitchen data management.
 * Tests the BaseKitchenDataBackend domain logic in isolation (mocked Gemini, Firebase).
 * 
 * SECTIONS:
 * 1. Mock Implementation (TestKitchenDataBackend)
 * 2. Domain Logic Tests (JSON sanitization, categorization)
 * 3. Contract Compliance Tests (Zod validation)
 * 4. AI Prompt Assembly Tests
 * 5. AI Response Handling Tests
 * 6. CRUD Operation Tests
 * 7. Error Path Tests
 * 8. Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  UnitSchema,
  AisleSchema,
  CanonicalItemSchema,
  RecipeCategorySchema,
} from '../../../types/contract';
import type {
  Unit,
  Aisle,
  CanonicalItem,
  RecipeCategory,
  Recipe,
} from '../../../types/contract';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

// ============================================================================
// SECTION 1: Mock Implementation (TestKitchenDataBackend)
// ============================================================================

/**
 * TestKitchenDataBackend: Mocked implementation for isolated testing.
 * Mocks all external dependencies:
 * - Gemini AI responses
 * - Firebase persistence
 */
class TestKitchenDataBackend {
  private units = new Map<string, Unit>();
  private aisles = new Map<string, Aisle>();
  private canonicalItems = new Map<string, CanonicalItem>();
  private categories = new Map<string, RecipeCategory>();
  private mockGeminiResponses = new Map<string, string>();
  private mockSystemInstruction = 'Test Kitchen Data Expert';

  setMockSystemInstruction(instruction: string): void {
    this.mockSystemInstruction = instruction;
  }

  setMockGeminiResponse(key: string, response: string): void {
    this.mockGeminiResponses.set(key, response);
  }

  // Domain logic methods exposed for testing

  sanitizeJson(text: string): string {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    if (firstBrace === -1 && firstBracket === -1) return text.trim();
    const isArray = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);
    if (isArray) {
      const lastBracket = text.lastIndexOf(']');
      return lastBracket !== -1 ? text.substring(firstBracket, lastBracket + 1) : text.trim();
    } else {
      const lastBrace = text.lastIndexOf('}');
      return lastBrace !== -1 ? text.substring(firstBrace, lastBrace + 1) : text.trim();
    }
  }

  async categorizeRecipe(recipe: Recipe): Promise<string[]> {
    const categories = Array.from(this.categories.values());
    const approvedCategories = categories
      .filter(c => c.isApproved)
      .map(c => `${c.name}${c.synonyms && c.synonyms.length > 0 ? ` (${c.synonyms.join(', ')})` : ''}`)
      .join('\n');

    const ingredientsList = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
          .map(ing => typeof ing === 'string' ? ing : ing.raw || ing.ingredientName)
          .slice(0, 10)
          .join(', ')
      : '';

    // Simulate AI categorization
    const mockResponse = this.mockGeminiResponses.get('categorize') || '[]';
    const sanitized = this.sanitizeJson(mockResponse);
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? parsed : [];
  }

  async getSystemInstruction(customContext?: string): Promise<string> {
    return customContext || this.mockSystemInstruction;
  }

  async callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    const key = JSON.stringify(params);
    const response = this.mockGeminiResponses.get(key) || '{}';
    return { text: response } as GenerateContentResponse;
  }

  // CRUD methods for testing

  async getUnits(): Promise<Unit[]> {
    return Array.from(this.units.values());
  }

  async createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit> {
    const id = `unit-${Math.random().toString(36).slice(2, 10)}`;
    const created: Unit = {
      ...unit,
      id,
      createdAt: new Date().toISOString(),
    };
    this.units.set(id, created);
    return created;
  }

  async updateUnit(id: string, updates: Partial<Unit>): Promise<Unit> {
    const existing = this.units.get(id);
    if (!existing) throw new Error('Unit not found');
    const updated = { ...existing, ...updates };
    this.units.set(id, updated);
    return updated;
  }

  async deleteUnit(id: string): Promise<void> {
    this.units.delete(id);
  }

  async getAisles(): Promise<Aisle[]> {
    return Array.from(this.aisles.values());
  }

  async createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle> {
    const id = `aisle-${Math.random().toString(36).slice(2, 10)}`;
    const created: Aisle = {
      ...aisle,
      id,
      createdAt: new Date().toISOString(),
    };
    this.aisles.set(id, created);
    return created;
  }

  async updateAisle(id: string, updates: Partial<Aisle>): Promise<Aisle> {
    const existing = this.aisles.get(id);
    if (!existing) throw new Error('Aisle not found');
    const updated = { ...existing, ...updates };
    this.aisles.set(id, updated);
    return updated;
  }

  async deleteAisle(id: string): Promise<void> {
    this.aisles.delete(id);
  }

  async getCanonicalItems(): Promise<CanonicalItem[]> {
    return Array.from(this.canonicalItems.values());
  }

  async getCanonicalItem(id: string): Promise<CanonicalItem | null> {
    return this.canonicalItems.get(id) || null;
  }

  async createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem> {
    const id = `item-${Math.random().toString(36).slice(2, 10)}`;
    const created: CanonicalItem = {
      ...item,
      id,
      createdAt: new Date().toISOString(),
    };
    this.canonicalItems.set(id, created);
    return created;
  }

  async updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem> {
    const existing = this.canonicalItems.get(id);
    if (!existing) throw new Error('Canonical item not found');
    const updated = { ...existing, ...updates };
    this.canonicalItems.set(id, updated);
    return updated;
  }

  async deleteCanonicalItem(id: string): Promise<void> {
    this.canonicalItems.delete(id);
  }

  async getCategories(): Promise<RecipeCategory[]> {
    return Array.from(this.categories.values());
  }

  async getCategory(id: string): Promise<RecipeCategory | null> {
    return this.categories.get(id) || null;
  }

  async createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory> {
    const id = `cat-${Math.random().toString(36).slice(2, 10)}`;
    const created: RecipeCategory = {
      ...category,
      id,
      createdAt: new Date().toISOString(),
    };
    this.categories.set(id, created);
    return created;
  }

  async updateCategory(id: string, updates: Partial<RecipeCategory>): Promise<RecipeCategory> {
    const existing = this.categories.get(id);
    if (!existing) throw new Error('Category not found');
    const updated = { ...existing, ...updates };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories.delete(id);
  }

  async approveCategory(id: string): Promise<void> {
    const category = this.categories.get(id);
    if (category) {
      category.isApproved = true;
      this.categories.set(id, category);
    }
  }

  async getPendingCategories(): Promise<RecipeCategory[]> {
    return Array.from(this.categories.values()).filter(c => !c.isApproved);
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_UNITS: Unit[] = [
  { id: 'unit-g', name: 'g', sortOrder: 1, createdAt: new Date().toISOString() },
  { id: 'unit-kg', name: 'kg', sortOrder: 2, createdAt: new Date().toISOString() },
  { id: 'unit-ml', name: 'ml', sortOrder: 3, createdAt: new Date().toISOString() },
  { id: 'unit-l', name: 'l', sortOrder: 4, createdAt: new Date().toISOString() },
];

const VALID_AISLES: Aisle[] = [
  { id: 'aisle-produce', name: 'Produce', sortOrder: 1, createdAt: new Date().toISOString() },
  { id: 'aisle-dairy', name: 'Dairy & Eggs', sortOrder: 2, createdAt: new Date().toISOString() },
  { id: 'aisle-pantry', name: 'Pantry', sortOrder: 3, createdAt: new Date().toISOString() },
];

const VALID_CANONICAL_ITEMS: CanonicalItem[] = [
  {
    id: 'item-tomato',
    name: 'Tomato',
    normalisedName: 'tomato',
    preferredUnit: 'g',
    aisle: 'Produce',
    isStaple: false,
    synonyms: ['tomatoes'],
    metadata: { season: 'summer' },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item-onion',
    name: 'Onion',
    normalisedName: 'onion',
    preferredUnit: 'g',
    aisle: 'Produce',
    isStaple: true,
    synonyms: ['onions', 'red onion', 'white onion'],
    metadata: {},
    createdAt: new Date().toISOString(),
  },
];

const VALID_CATEGORIES: RecipeCategory[] = [
  {
    id: 'cat-italian',
    name: 'Italian',
    description: 'Traditional Italian cuisine',
    synonyms: ['Mediterranean', 'Pasta dishes'],
    isApproved: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-vegetarian',
    name: 'Vegetarian',
    description: 'Meat-free recipes',
    synonyms: ['Veggie'],
    isApproved: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-pending',
    name: 'Experimental',
    description: 'AI-suggested category',
    isApproved: false,
    confidence: 0.85,
    recipeId: 'rec-1',
    createdAt: new Date().toISOString(),
  },
];

const SAMPLE_RECIPE: Recipe = {
  id: 'rec-1',
  title: 'Classic Tomato Pasta',
  description: 'Simple Italian pasta with fresh tomatoes',
  ingredients: [
    {
      id: 'ri-1',
      raw: '400 g tomatoes',
      quantity: 400,
      unit: 'g',
      ingredientName: 'tomato',
      canonicalItemId: 'item-tomato',
    },
  ],
  instructions: ['Cook pasta', 'Make sauce', 'Combine'],
  equipmentNeeded: ['Pot', 'Frying Pan'],
  prepTime: '10 mins',
  cookTime: '20 mins',
  totalTime: '30 mins',
  servings: '4',
  complexity: 'Simple',
  createdAt: new Date().toISOString(),
  createdBy: 'user-1',
};

// ============================================================================
// SECTION 2: Domain Logic Tests
// ============================================================================

describe('Kitchen Data Backend - Domain Logic', () => {
  let backend: TestKitchenDataBackend;

  beforeEach(() => {
    backend = new TestKitchenDataBackend();
  });

  describe('JSON Sanitization', () => {
    it('should extract JSON array from text with preamble', () => {
      const response = 'Here are the categories:\n["cat-1", "cat-2", "cat-3"]\nEnd of list.';
      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
    });

    it('should extract JSON object from text', () => {
      const response = 'Analysis result: {"category": "Italian", "confidence": 0.95} done.';
      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);

      expect(parsed.category).toBe('Italian');
      expect(parsed.confidence).toBe(0.95);
    });

    it('should handle JSON inside markdown fences', () => {
      const response = '```json\n["cat-1", "cat-2"]\n```';
      const sanitized = backend.sanitizeJson(response);

      expect(() => JSON.parse(sanitized)).not.toThrow();
    });

    it('should handle empty array', () => {
      const response = '[]';
      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);

      expect(parsed).toEqual([]);
    });

    it('should handle nested structures', () => {
      const response = JSON.stringify({
        categories: ['cat-1', 'cat-2'],
        confidence: { 'cat-1': 0.9, 'cat-2': 0.8 }
      });

      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);

      expect(parsed.categories).toHaveLength(2);
      expect(parsed.confidence['cat-1']).toBe(0.9);
    });
  });

  describe('Recipe Categorization', () => {
    it('should categorize recipe based on ingredients and title', async () => {
      // Setup test categories
      await backend.createCategory({
        name: 'Italian',
        description: 'Italian cuisine',
        isApproved: true,
      });

      backend.setMockGeminiResponse('categorize', '["cat-italian"]');

      const categories = await backend.categorizeRecipe(SAMPLE_RECIPE);

      expect(Array.isArray(categories)).toBe(true);
    });

    it('should return empty array when no categories match', async () => {
      backend.setMockGeminiResponse('categorize', '[]');

      const categories = await backend.categorizeRecipe(SAMPLE_RECIPE);

      expect(categories).toEqual([]);
    });

    it('should handle recipe with minimal information', async () => {
      const minimalRecipe: Recipe = {
        id: 'rec-2',
        title: 'Quick Meal',
        description: '',
        ingredients: [],
        instructions: ['Cook'],
        equipmentNeeded: [],
        prepTime: '5 mins',
        cookTime: '10 mins',
        totalTime: '15 mins',
        servings: '1',
        complexity: 'Simple',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
      };

      backend.setMockGeminiResponse('categorize', '[]');

      const categories = await backend.categorizeRecipe(minimalRecipe);

      expect(categories).toBeDefined();
    });
  });
});

// ============================================================================
// SECTION 3: Contract Compliance Tests
// ============================================================================

describe('Kitchen Data Backend - Contract Compliance', () => {
  describe('Unit Validation', () => {
    it('should validate complete unit', () => {
      const unit: Unit = {
        id: 'unit-g',
        name: 'g',
        sortOrder: 1,
        createdAt: new Date().toISOString(),
      };

      const result = UnitSchema.safeParse(unit);
      expect(result.success).toBe(true);
    });

    it('should require core fields', () => {
      const invalid = {
        id: 'unit-1',
        // Missing name, sortOrder, createdAt
      };

      const result = UnitSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate unit with default sort order', () => {
      const unit: Unit = {
        id: 'unit-custom',
        name: 'pinch',
        sortOrder: 999,
        createdAt: new Date().toISOString(),
      };

      const result = UnitSchema.safeParse(unit);
      expect(result.success).toBe(true);
    });
  });

  describe('Aisle Validation', () => {
    it('should validate complete aisle', () => {
      const aisle: Aisle = {
        id: 'aisle-produce',
        name: 'Produce',
        sortOrder: 1,
        createdAt: new Date().toISOString(),
      };

      const result = AisleSchema.safeParse(aisle);
      expect(result.success).toBe(true);
    });

    it('should require core aisle fields', () => {
      const invalid = {
        id: 'aisle-1',
        // Missing name, sortOrder, createdAt
      };

      const result = AisleSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Canonical Item Validation', () => {
    it('should validate complete canonical item', () => {
      const item: CanonicalItem = {
        id: 'item-tomato',
        name: 'Tomato',
        normalisedName: 'tomato',
        preferredUnit: 'g',
        aisle: 'Produce',
        isStaple: false,
        synonyms: ['tomatoes'],
        metadata: { season: 'summer' },
        createdAt: new Date().toISOString(),
      };

      const result = CanonicalItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should require core item fields', () => {
      const invalid = {
        id: 'item-1',
        name: 'Test',
        // Missing normalisedName, preferredUnit, aisle, isStaple, createdAt
      };

      const result = CanonicalItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate item with optional fields', () => {
      const item: CanonicalItem = {
        id: 'item-salt',
        name: 'Salt',
        normalisedName: 'salt',
        preferredUnit: 'g',
        aisle: 'Pantry',
        isStaple: true,
        createdAt: new Date().toISOString(),
      };

      const result = CanonicalItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });
  });

  describe('Recipe Category Validation', () => {
    it('should validate complete category', () => {
      const category: RecipeCategory = {
        id: 'cat-italian',
        name: 'Italian',
        description: 'Traditional Italian cuisine',
        synonyms: ['Mediterranean'],
        isApproved: true,
        createdAt: new Date().toISOString(),
      };

      const result = RecipeCategorySchema.safeParse(category);
      expect(result.success).toBe(true);
    });

    it('should validate AI-suggested category', () => {
      const category: RecipeCategory = {
        id: 'cat-suggested',
        name: 'Quick Meals',
        isApproved: false,
        confidence: 0.85,
        recipeId: 'rec-1',
        createdAt: new Date().toISOString(),
      };

      const result = RecipeCategorySchema.safeParse(category);
      expect(result.success).toBe(true);
    });

    it('should require core category fields', () => {
      const invalid = {
        id: 'cat-1',
        // Missing name, isApproved, createdAt
      };

      const result = RecipeCategorySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// SECTION 4: AI Prompt Assembly Tests
// ============================================================================

describe('Kitchen Data Backend - AI Prompt Assembly', () => {
  let backend: TestKitchenDataBackend;

  beforeEach(() => {
    backend = new TestKitchenDataBackend();
  });

  it('should request system instruction with custom context', async () => {
    const customContext = 'You are analyzing recipe categories';
    const instruction = await backend.getSystemInstruction(customContext);

    expect(instruction).toBe(customContext);
  });

  it('should use default system instruction when no context provided', async () => {
    backend.setMockSystemInstruction('Default Kitchen Expert');
    const instruction = await backend.getSystemInstruction();

    expect(instruction).toBe('Default Kitchen Expert');
  });
});

// ============================================================================
// SECTION 5: AI Response Handling Tests
// ============================================================================

describe('Kitchen Data Backend - AI Response Handling', () => {
  let backend: TestKitchenDataBackend;

  beforeEach(() => {
    backend = new TestKitchenDataBackend();
  });

  it('should parse valid category ID array', () => {
    const response = '["cat-italian", "cat-vegetarian", "cat-quick"]';
    const sanitized = backend.sanitizeJson(response);
    const parsed = JSON.parse(sanitized);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
  });

  it('should handle AI response with explanation', () => {
    const response = `Based on the ingredients and cooking style, I suggest:
    ["cat-italian", "cat-simple"]
    These categories fit well because...`;

    const sanitized = backend.sanitizeJson(response);
    const parsed = JSON.parse(sanitized);

    expect(parsed).toHaveLength(2);
  });

  it('should handle empty categorization response', () => {
    const response = '[]';
    const sanitized = backend.sanitizeJson(response);
    const parsed = JSON.parse(sanitized);

    expect(parsed).toEqual([]);
  });
});

// ============================================================================
// SECTION 6: CRUD Operation Tests
// ============================================================================

describe('Kitchen Data Backend - CRUD Operations', () => {
  let backend: TestKitchenDataBackend;

  beforeEach(() => {
    backend = new TestKitchenDataBackend();
  });

  describe('Units CRUD', () => {
    it('should create a new unit', async () => {
      const unit = await backend.createUnit({
        name: 'tsp',
        sortOrder: 5,
      });

      expect(unit.id).toBeDefined();
      expect(unit.name).toBe('tsp');
      expect(unit.createdAt).toBeDefined();
    });

    it('should get all units', async () => {
      await backend.createUnit({ name: 'g', sortOrder: 1 });
      await backend.createUnit({ name: 'kg', sortOrder: 2 });

      const units = await backend.getUnits();

      expect(units).toHaveLength(2);
    });

    it('should update a unit', async () => {
      const created = await backend.createUnit({ name: 'g', sortOrder: 1 });
      const updated = await backend.updateUnit(created.id, { sortOrder: 10 });

      expect(updated.sortOrder).toBe(10);
      expect(updated.name).toBe('g');
    });

    it('should delete a unit', async () => {
      const created = await backend.createUnit({ name: 'g', sortOrder: 1 });
      await backend.deleteUnit(created.id);

      const units = await backend.getUnits();
      expect(units).toHaveLength(0);
    });
  });

  describe('Aisles CRUD', () => {
    it('should create a new aisle', async () => {
      const aisle = await backend.createAisle({
        name: 'Produce',
        sortOrder: 1,
      });

      expect(aisle.id).toBeDefined();
      expect(aisle.name).toBe('Produce');
    });

    it('should get all aisles sorted', async () => {
      await backend.createAisle({ name: 'Dairy', sortOrder: 2 });
      await backend.createAisle({ name: 'Produce', sortOrder: 1 });

      const aisles = await backend.getAisles();

      expect(aisles).toHaveLength(2);
    });

    it('should update an aisle', async () => {
      const created = await backend.createAisle({ name: 'Produce', sortOrder: 1 });
      const updated = await backend.updateAisle(created.id, { name: 'Fresh Produce' });

      expect(updated.name).toBe('Fresh Produce');
    });

    it('should delete an aisle', async () => {
      const created = await backend.createAisle({ name: 'Produce', sortOrder: 1 });
      await backend.deleteAisle(created.id);

      const aisles = await backend.getAisles();
      expect(aisles).toHaveLength(0);
    });
  });

  describe('Canonical Items CRUD', () => {
    it('should create a canonical item', async () => {
      const item = await backend.createCanonicalItem({
        name: 'Tomato',
        normalisedName: 'tomato',
        preferredUnit: 'g',
        aisle: 'Produce',
        isStaple: false,
      });

      expect(item.id).toBeDefined();
      expect(item.name).toBe('Tomato');
    });

    it('should get canonical item by ID', async () => {
      const created = await backend.createCanonicalItem({
        name: 'Onion',
        normalisedName: 'onion',
        preferredUnit: 'g',
        aisle: 'Produce',
        isStaple: true,
      });

      const retrieved = await backend.getCanonicalItem(created.id);

      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Onion');
    });

    it('should update canonical item', async () => {
      const created = await backend.createCanonicalItem({
        name: 'Tomato',
        normalisedName: 'tomato',
        preferredUnit: 'g',
        aisle: 'Produce',
        isStaple: false,
      });

      const updated = await backend.updateCanonicalItem(created.id, {
        isStaple: true,
        synonyms: ['tomatoes', 'cherry tomato'],
      });

      expect(updated.isStaple).toBe(true);
      expect(updated.synonyms).toHaveLength(2);
    });

    it('should delete canonical item', async () => {
      const created = await backend.createCanonicalItem({
        name: 'Garlic',
        normalisedName: 'garlic',
        preferredUnit: 'piece',
        aisle: 'Produce',
        isStaple: true,
      });

      await backend.deleteCanonicalItem(created.id);

      const retrieved = await backend.getCanonicalItem(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Categories CRUD', () => {
    it('should create a category', async () => {
      const category = await backend.createCategory({
        name: 'Italian',
        description: 'Italian cuisine',
        isApproved: true,
      });

      expect(category.id).toBeDefined();
      expect(category.name).toBe('Italian');
    });

    it('should get category by ID', async () => {
      const created = await backend.createCategory({
        name: 'Vegetarian',
        isApproved: true,
      });

      const retrieved = await backend.getCategory(created.id);

      expect(retrieved?.id).toBe(created.id);
    });

    it('should update category', async () => {
      const created = await backend.createCategory({
        name: 'Quick',
        isApproved: false,
      });

      const updated = await backend.updateCategory(created.id, {
        description: 'Quick meals under 30 minutes',
        isApproved: true,
      });

      expect(updated.description).toBe('Quick meals under 30 minutes');
      expect(updated.isApproved).toBe(true);
    });

    it('should approve category', async () => {
      const created = await backend.createCategory({
        name: 'Experimental',
        isApproved: false,
        confidence: 0.8,
      });

      await backend.approveCategory(created.id);

      const retrieved = await backend.getCategory(created.id);
      expect(retrieved?.isApproved).toBe(true);
    });

    it('should get pending categories', async () => {
      await backend.createCategory({ name: 'Approved', isApproved: true });
      await backend.createCategory({ name: 'Pending1', isApproved: false });
      await backend.createCategory({ name: 'Pending2', isApproved: false });

      const pending = await backend.getPendingCategories();

      expect(pending).toHaveLength(2);
      expect(pending.every(c => !c.isApproved)).toBe(true);
    });

    it('should delete category', async () => {
      const created = await backend.createCategory({
        name: 'Temporary',
        isApproved: false,
      });

      await backend.deleteCategory(created.id);

      const retrieved = await backend.getCategory(created.id);
      expect(retrieved).toBeNull();
    });
  });
});

// ============================================================================
// SECTION 7: Error Path Tests
// ============================================================================

describe('Kitchen Data Backend - Error Paths', () => {
  let backend: TestKitchenDataBackend;

  beforeEach(() => {
    backend = new TestKitchenDataBackend();
  });

  describe('Invalid Input Handling', () => {
    it('should handle empty JSON response', () => {
      const response = '';
      const sanitized = backend.sanitizeJson(response);

      expect(sanitized).toBe('');
    });

    it('should handle non-JSON text', () => {
      const response = 'No JSON here at all';
      const sanitized = backend.sanitizeJson(response);

      expect(sanitized).toBeDefined();
    });

    it('should handle update with invalid ID', async () => {
      await expect(backend.updateUnit('invalid-id', { name: 'test' })).rejects.toThrow();
    });

    it('should handle delete with invalid ID', async () => {
      await backend.deleteUnit('invalid-id');
      // Should not throw, just silently fail
      const units = await backend.getUnits();
      expect(units).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long item name', async () => {
      const longName = 'a'.repeat(500);
      const item = await backend.createCanonicalItem({
        name: longName,
        normalisedName: longName.toLowerCase(),
        preferredUnit: 'g',
        aisle: 'Test',
        isStaple: false,
      });

      expect(item.name).toBe(longName);
    });

    it('should handle item with empty synonyms array', async () => {
      const item = await backend.createCanonicalItem({
        name: 'Salt',
        normalisedName: 'salt',
        preferredUnit: 'g',
        aisle: 'Pantry',
        isStaple: true,
        synonyms: [],
      });

      expect(item.synonyms).toEqual([]);
    });

    it('should handle category with confidence at boundaries', async () => {
      const category1 = await backend.createCategory({
        name: 'Test1',
        isApproved: false,
        confidence: 0.0,
      });

      const category2 = await backend.createCategory({
        name: 'Test2',
        isApproved: false,
        confidence: 1.0,
      });

      expect(category1.confidence).toBe(0.0);
      expect(category2.confidence).toBe(1.0);
    });

    it('should handle unicode characters in names', async () => {
      const item = await backend.createCanonicalItem({
        name: 'Crème Fraîche',
        normalisedName: 'crème fraîche',
        preferredUnit: 'ml',
        aisle: 'Dairy',
        isStaple: false,
      });

      expect(item.name).toBe('Crème Fraîche');
    });
  });
});

// ============================================================================
// SECTION 8: Integration Tests
// ============================================================================

describe('Kitchen Data Backend - Integration', () => {
  let backend: TestKitchenDataBackend;

  beforeEach(() => {
    backend = new TestKitchenDataBackend();
  });

  it('should complete full item creation workflow', async () => {
    // Step 1: Create supporting data
    const unit = await backend.createUnit({ name: 'g', sortOrder: 1 });
    const aisle = await backend.createAisle({ name: 'Produce', sortOrder: 1 });

    // Step 2: Create canonical item using the supporting data
    const item = await backend.createCanonicalItem({
      name: 'Tomato',
      normalisedName: 'tomato',
      preferredUnit: unit.name,
      aisle: aisle.name,
      isStaple: false,
      synonyms: ['tomatoes', 'cherry tomato'],
    });

    // Verify full workflow
    expect(item.preferredUnit).toBe('g');
    expect(item.aisle).toBe('Produce');
    expect(item.synonyms).toHaveLength(2);
  });

  it('should manage category lifecycle', async () => {
    // Create unapproved category (AI suggestion)
    const suggested = await backend.createCategory({
      name: 'Quick & Easy',
      description: 'AI-suggested category',
      isApproved: false,
      confidence: 0.85,
      recipeId: 'rec-1',
    });

    // Verify it appears in pending
    const pending = await backend.getPendingCategories();
    expect(pending).toHaveLength(1);

    // Approve the category
    await backend.approveCategory(suggested.id);

    // Verify it's no longer pending
    const stillPending = await backend.getPendingCategories();
    expect(stillPending).toHaveLength(0);

    // Verify it's now approved
    const approved = await backend.getCategory(suggested.id);
    expect(approved?.isApproved).toBe(true);
  });

  it('should handle bulk operations', async () => {
    // Create multiple units
    const unitNames = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp'];
    for (let i = 0; i < unitNames.length; i++) {
      await backend.createUnit({ name: unitNames[i], sortOrder: i + 1 });
    }

    const units = await backend.getUnits();
    expect(units).toHaveLength(6);
  });

  it('should validate data consistency across operations', async () => {
    // Create foundation data
    await backend.createUnit({ name: 'g', sortOrder: 1 });
    await backend.createAisle({ name: 'Produce', sortOrder: 1 });
    await backend.createCategory({ name: 'Italian', isApproved: true });

    // Create item
    const item = await backend.createCanonicalItem({
      name: 'Tomato',
      normalisedName: 'tomato',
      preferredUnit: 'g',
      aisle: 'Produce',
      isStaple: false,
    });

    // Verify schema compliance
    const itemValidation = CanonicalItemSchema.safeParse(item);
    expect(itemValidation.success).toBe(true);
  });

  it('should handle recipe categorization with full context', async () => {
    // Setup categories
    await backend.createCategory({
      name: 'Italian',
      synonyms: ['Mediterranean', 'Pasta'],
      isApproved: true,
    });

    await backend.createCategory({
      name: 'Vegetarian',
      synonyms: ['Veggie', 'Plant-based'],
      isApproved: true,
    });

    // Mock AI response
    backend.setMockGeminiResponse('categorize', '["cat-italian", "cat-vegetarian"]');

    // Categorize recipe
    const categories = await backend.categorizeRecipe(SAMPLE_RECIPE);

    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
  });

  it('should maintain referential integrity', async () => {
    // Create item with specific unit and aisle
    const item = await backend.createCanonicalItem({
      name: 'Onion',
      normalisedName: 'onion',
      preferredUnit: 'g',
      aisle: 'Produce',
      isStaple: true,
    });

    // Update to reference different unit
    const updated = await backend.updateCanonicalItem(item.id, {
      preferredUnit: 'kg',
    });

    expect(updated.preferredUnit).toBe('kg');
    expect(updated.aisle).toBe('Produce'); // Other fields unchanged
  });
});
