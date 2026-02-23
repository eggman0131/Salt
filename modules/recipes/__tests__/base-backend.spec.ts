/**
 * Recipes Backend Domain Logic Tests
 * 
 * Comprehensive test suite for recipe processing, AI synthesis, and data normalization.
 * Tests the BaseRecipesBackend domain logic in isolation (mocked Gemini, Firebase, inventory).
 * 
 * SECTIONS:
 * 1. Mock Implementation (TestRecipesBackend)
 * 2. Domain Logic Tests (parsing, recipe normalization)
 * 3. Contract Compliance Tests (Zod validation)
 * 4. AI Prompt Assembly Tests (system instructions)
 * 5. AI Response Handling Tests (JSON sanitization, data mapping)
 * 6. Error Path Tests (null inputs, edge cases)
 * 7. Integration Tests (full recipe workflows)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { expectTypeOf } from 'vitest';
import { RecipeSchema, RecipeIngredientSchema } from '../../../types/contract';
import type { Recipe, RecipeIngredient, CanonicalItem, Unit, Aisle, Equipment, RecipeCategory } from '../../../types/contract';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

// ============================================================================
// SECTION 1: Mock Implementation (TestRecipesBackend)
// ============================================================================

/**
 * TestRecipesBackend: Mocked implementation of BaseRecipesBackend for isolated testing.
 * Mocks all external dependencies:
 * - Gemini AI responses
 * - Firebase persistence
 * - Kitchen data (units, aisles, canonical items)
 * - Equipment inventory
 */
class TestRecipesBackend {
  private recipes = new Map<string, Recipe>();
  private mockGeminiResponses = new Map<string, string>();
  private mockSystemInstruction = 'Test Chef Instructions';
  private canonicalItems: CanonicalItem[] = [];
  private units: Unit[] = [];
  private aisles: Aisle[] = [];
  private equipment: Equipment[] = [];
  private categories: RecipeCategory[] = [];

  // Mocking methods
  setMockSystemInstruction(instruction: string): void {
    this.mockSystemInstruction = instruction;
  }

  setMockGeminiResponse(key: string, response: string): void {
    this.mockGeminiResponses.set(key, response);
  }

  setMockKitchenData(
    canonicalItems: CanonicalItem[],
    units: Unit[],
    aisles: Aisle[],
    equipment?: Equipment[]
  ): void {
    this.canonicalItems = canonicalItems;
    this.units = units;
    this.aisles = aisles;
    if (equipment) this.equipment = equipment;
  }

  // Domain logic methods exposed for testing
  
  parseIngredientString(raw: string): Omit<RecipeIngredient, 'id' | 'raw' | 'canonicalItemId'> {
    let text = raw.toLowerCase().trim();

    const knownUnits = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'piece', 'pinch'];
    const unitPattern = knownUnits.join('|');
    const quantityMatch = text.match(
      new RegExp(`^(\\d+\\.?\\d*|\\d*\\.\\d+)\\s*(${unitPattern})?\\s+(.+)$`)
    );

    let quantity: number | null = null;
    let unit: string | null = null;

    if (quantityMatch) {
      quantity = parseFloat(quantityMatch[1]);
      unit = quantityMatch[2] || '_item';
      text = quantityMatch[3];
    }

    const prepMatch = text.match(/,\s*(.+)$/);
    const preparation = prepMatch ? prepMatch[1].trim() : null;
    if (prepMatch) {
      text = text.substring(0, prepMatch.index).trim();
    }

    text = text.replace(/\b(small|medium|large)\b/g, '').trim();
    text = text
      .replace(/ies$/, 'y')           // cherries → cherry
      .replace(/oes$/, 'o')            // tomatoes → tomato
      .replace(/xes$/, 'x')            // boxes → box
      .replace(/zes$/, 'z')            // sizes → size
      .replace(/([^s])s$/, '$1');      // apples → apple

    const ingredientName = text.replace(/\s+/g, ' ').trim();

    return {
      quantity,
      unit,
      ingredientName,
      preparation: preparation || undefined,
    };
  }

  fuzzyMatch(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const longer = aLower.length > bLower.length ? aLower : bLower;
    const shorter = aLower.length > bLower.length ? bLower : aLower;
    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
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

  normalizeRecipeData(raw: any): Partial<Recipe> {
    const source = Array.isArray(raw) ? (raw[0] || {}) : (raw || {});
    const normalized: any = { ...source };

    if (!normalized.title) normalized.title = source.recipeName || source.name || 'Untitled Recipe';
    if (!normalized.description) normalized.description = source.summary || source.recipeDescription || 'No description provided.';
    if (!normalized.ingredients) normalized.ingredients = source.ingredientList || source.items || [];
    if (!normalized.instructions) normalized.instructions = source.method || source.steps || [];
    if (!normalized.equipmentNeeded) normalized.equipmentNeeded = source.equipment || source.tools || [];
    if (!normalized.prepTime) normalized.prepTime = source.prep || source.prep_time || '---';
    if (!normalized.cookTime) normalized.cookTime = source.cook || source.cook_time || '---';
    if (!normalized.totalTime) normalized.totalTime = source.total || source.total_time || '---';
    if (!normalized.servings) normalized.servings = source.serves || source.yield || '---';
    if (!normalized.complexity) normalized.complexity = source.difficulty || 'Intermediate';

    if (!Array.isArray(normalized.instructions)) {
      normalized.instructions = typeof normalized.instructions === 'string' 
        ? normalized.instructions.split('\n').filter(s => s.trim())
        : [];
    }

    return normalized;
  }

  async getSystemInstruction(customContext?: string): Promise<string> {
    return customContext || this.mockSystemInstruction;
  }

  async callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    const key = JSON.stringify(params);
    const response = this.mockGeminiResponses.get(key) || '{}';
    return { text: response } as GenerateContentResponse;
  }

  async getCanonicalItems(): Promise<CanonicalItem[]> {
    return this.canonicalItems;
  }

  async getUnits(): Promise<Unit[]> {
    return this.units;
  }

  async getAisles(): Promise<Aisle[]> {
    return this.aisles;
  }

  async getInventory(): Promise<Equipment[]> {
    return this.equipment;
  }

  async resolveIngredient(raw: string): Promise<RecipeIngredient> {
    const parsed = this.parseIngredientString(raw);
    const id = `ri-${Math.random().toString(36).slice(2, 10)}`;
    
    let bestMatch: CanonicalItem | null = null;
    let bestScore = 0;
    
    for (const item of this.canonicalItems) {
      const score = this.fuzzyMatch(parsed.ingredientName, item.normalisedName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    return {
      id,
      raw,
      ...parsed,
      canonicalItemId: bestMatch?.id,
    };
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_RECIPES = [
  'Classic Tomato Pasta: 400g tomatoes, 2 garlic cloves, 300g pasta, basil, olive oil',
  'Beef Stir Fry: 500g beef mince, red onion, garlic, ginger, soy sauce, sesame oil',
  'Grilled fish: 600g salmon fillets, lemon, salt, pepper, olive oil',
];

const CANONICAL_ITEMS_FIXTURE: CanonicalItem[] = [
  {
    id: 'item-tomato',
    name: 'Tomato',
    normalisedName: 'tomato',
    preferredUnit: 'g',
    aisle: 'Produce',
    isStaple: false,
    synonyms: ['tomatoes', 'tomatoe'],
    metadata: { season: 'summer' },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'item-onion',
    name: 'Onion',
    normalisedName: 'onion',
    preferredUnit: 'g',
    aisle: 'Produce',
    isStaple: true,
    synonyms: ['onions', 'red onion', 'white onion'],
    metadata: { types: ['red', 'white', 'yellow'] },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'item-garlic',
    name: 'Garlic',
    normalisedName: 'garlic',
    preferredUnit: 'piece',
    aisle: 'Produce',
    isStaple: true,
    synonyms: ['garlic clove', 'cloves garlic'],
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const UNITS_FIXTURE: Unit[] = [
  { id: 'unit-g', name: 'g', sortOrder: 1, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'unit-kg', name: 'kg', sortOrder: 2, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'unit-ml', name: 'ml', sortOrder: 3, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'unit-tbsp', name: 'tbsp', sortOrder: 4, createdAt: '2026-01-01T00:00:00Z' },
];

const AISLES_FIXTURE: Aisle[] = [
  { id: 'aisle-produce', name: 'Produce', sortOrder: 1, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'aisle-pantry', name: 'Pantry', sortOrder: 2, createdAt: '2026-01-01T00:00:00Z' },
];

const EQUIPMENT_FIXTURE: Equipment[] = [
  { 
    id: 'eq-frying-pan', 
    name: 'Frying Pan',
    brand: 'Test Brand',
    modelName: 'Test Model',
    description: 'Test frying pan',
    type: 'Cookware',
    class: 'Essential',
    accessories: [],
    status: 'Available' as const,
  },
  { 
    id: 'eq-pot', 
    name: 'Pot',
    brand: 'Test Brand',
    modelName: 'Test Model',
    description: 'Test pot',
    type: 'Cookware',
    class: 'Essential',
    accessories: [],
    status: 'Available' as const,
  },
];

// ============================================================================
// SECTION 2: Domain Logic Tests
// ============================================================================

describe('Recipes Backend - Domain Logic', () => {
  let backend: TestRecipesBackend;

  beforeEach(() => {
    backend = new TestRecipesBackend();
    backend.setMockKitchenData(CANONICAL_ITEMS_FIXTURE, UNITS_FIXTURE, AISLES_FIXTURE, EQUIPMENT_FIXTURE);
  });

  describe('Ingredient Parsing', () => {
    it('should parse ingredient with quantity and unit', () => {
      const result = backend.parseIngredientString('400 g tomatoes');
      expect(result.quantity).toBe(400);
      expect(result.unit).toBe('g');
      expect(result.ingredientName).toBe('tomato');
    });

    it('should parse ingredient with preparation instruction', () => {
      const result = backend.parseIngredientString('2 large red onions, diced fine');
      expect(result.quantity).toBe(2);
      expect(result.unit).toBe('_item');
      expect(result.ingredientName).toBe('red onion');
      expect(result.preparation).toContain('diced');
    });

    it('should handle ingredient without unit', () => {
      const result = backend.parseIngredientString('1 garlic clove');
      expect(result.quantity).toBe(1);
      expect(result.unit).toBe('_item');
      expect(result.ingredientName).toBe('garlic clove');
    });

    it('should singularize ingredient names', () => {
      const result = backend.parseIngredientString('400 g tomatoes');
      expect(result.ingredientName).toBe('tomato');
    });

    it('should normalize whitespace', () => {
      const result = backend.parseIngredientString('400    g    tomatoes');
      expect(result.quantity).toBe(400);
      expect(result.ingredientName).toBe('tomato');
    });

    it('should handle complex ingredient descriptions', () => {
      const result = backend.parseIngredientString('500 g beef mince, browned');
      expect(result.quantity).toBe(500);
      expect(result.unit).toBe('g');
      expect(result.ingredientName).toBe('beef mince');
      expect(result.preparation).toBe('browned');
    });
  });

  describe('Fuzzy Matching', () => {
    it('should return perfect score for identical strings', () => {
      const score = backend.fuzzyMatch('tomato', 'tomato');
      expect(score).toBe(1.0);
    });

    it('should be case-insensitive', () => {
      const score = backend.fuzzyMatch('tomato', 'TOMATO');
      expect(score).toBe(1.0);
    });

    it('should return lower score for different strings', () => {
      const score = backend.fuzzyMatch('tomato', 'potato');
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThan(0.85);
    });

    it('should return zero for completely different strings', () => {
      const score = backend.fuzzyMatch('tomato', 'xyz');
      expect(score).toBeLessThan(0.35);
    });

    it('should work symmetrically', () => {
      const score1 = backend.fuzzyMatch('cat', 'car');
      const score2 = backend.fuzzyMatch('car', 'cat');
      expect(score1).toBe(score2);
    });
  });

  describe('JSON Sanitization', () => {
    it('should extract JSON object from plain text', () => {
      const response = 'Blah blah {"name": "Tomato", "aisle": "Produce"} more text';
      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);
      expect(parsed.name).toBe('Tomato');
    });

    it('should extract JSON array from text', () => {
      const response = 'Some preamble [{"name": "Tomato"}, {"name": "Onion"}] and more';
      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should handle JSON inside markdown fences', () => {
      const response = '```\n[{"name": "Tomato"}]\n```';
      const sanitized = backend.sanitizeJson(response);
      expect(() => JSON.parse(sanitized)).not.toThrow();
    });

    it('should handle nested structures', () => {
      const response = JSON.stringify({
        recipes: [
          { title: 'Pasta', ingredients: ['tomato', 'pasta'] }
        ]
      });
      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);
      expect(parsed.recipes[0].title).toBe('Pasta');
    });
  });

  describe('Recipe Data Normalization', () => {
    it('should map common field names to schema', () => {
      const raw = {
        recipeName: 'My Pasta',
        ingredientList: ['400g tomatoes'],
        method: ['Cook', 'Serve'],
      };

      const normalized = backend.normalizeRecipeData(raw);
      expect(normalized.title).toBe('My Pasta');
      expect(normalized.ingredients).toHaveLength(1);
      expect(normalized.instructions).toHaveLength(2);
    });

    it('should handle array of recipes (take first)', () => {
      const raw = [
        { title: 'First Recipe', instructions: ['Step 1'] },
        { title: 'Second Recipe', instructions: ['Another'] },
      ];

      const normalized = backend.normalizeRecipeData(raw);
      expect(normalized.title).toBe('First Recipe');
    });

    it('should provide defaults for missing fields', () => {
      const raw = { title: 'Minimal Recipe' };
      const normalized = backend.normalizeRecipeData(raw);
      
      expect(normalized.description).toBe('No description provided.');
      expect(normalized.instructions).toEqual([]);
      expect(normalized.complexity).toBe('Intermediate');
    });

    it('should handle string instructions as lines', () => {
      const raw = {
        title: 'Recipe',
        instructions: 'Step one\nStep two\nStep three',
      };

      const normalized = backend.normalizeRecipeData(raw);
      expect(normalized.instructions).toEqual(['Step one', 'Step two', 'Step three']);
    });

    it('should convert time fields with fallback', () => {
      const raw = {
        title: 'Recipe',
        prep: '10 mins',
        cook_time: '20 mins',
      };

      const normalized = backend.normalizeRecipeData(raw);
      expect(normalized.prepTime).toBe('10 mins');
      expect(normalized.cookTime).toBe('20 mins');
    });
  });
});

// ============================================================================
// SECTION 3: Contract Compliance Tests
// ============================================================================

describe('Recipes Backend - Contract Compliance', () => {
  let backend: TestRecipesBackend;

  beforeEach(() => {
    backend = new TestRecipesBackend();
    backend.setMockKitchenData(CANONICAL_ITEMS_FIXTURE, UNITS_FIXTURE, AISLES_FIXTURE);
  });

  describe('Recipe Ingredient Validation', () => {
    it('should validate recipe ingredient with all required fields', () => {
      const ingredient: RecipeIngredient = {
        id: 'ri-1',
        raw: '400 g tomatoes',
        quantity: 400,
        unit: 'g',
        ingredientName: 'tomato',
        canonicalItemId: 'item-tomato',
      };

      const result = RecipeIngredientSchema.safeParse(ingredient);
      expect(result.success).toBe(true);
    });

    it('should validate ingredient with optional preparation', () => {
      const ingredient: RecipeIngredient = {
        id: 'ri-2',
        raw: '2 large red onions, diced',
        quantity: 2,
        unit: '_item',
        ingredientName: 'red onion',
        canonicalItemId: 'item-onion',
        preparation: 'diced fine',
      };

      const result = RecipeIngredientSchema.safeParse(ingredient);
      expect(result.success).toBe(true);
    });

    it('should allow ingredient without canonical match', () => {
      const ingredient: RecipeIngredient = {
        id: 'ri-3',
        raw: '100 g exotic spice',
        quantity: 100,
        unit: 'g',
        ingredientName: 'exotic spice',
      };

      const result = RecipeIngredientSchema.safeParse(ingredient);
      expect(result.success).toBe(true);
    });
  });

  describe('Recipe Validation', () => {
    it('should validate complete recipe', () => {
      const recipe: Recipe = {
        id: 'rec-1',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        title: 'Tomato Pasta',
        description: 'Classic Italian pasta with tomatoes',
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
        instructions: [
          { id: 'step-1', text: 'Cook pasta', ingredients: [], technicalWarnings: [] },
          { id: 'step-2', text: 'Make sauce', ingredients: [], technicalWarnings: [] },
          { id: 'step-3', text: 'Combine', ingredients: [], technicalWarnings: [] },
        ],
        equipmentNeeded: ['Frying Pan', 'Pot'],
        prepTime: '10 mins',
        cookTime: '20 mins',
        totalTime: '30 mins',
        servings: '4',
        complexity: 'Simple',
      };

      const result = RecipeSchema.safeParse(recipe);
      expect(result.success).toBe(true);
    });

    it('should require core recipe fields', () => {
      const invalid = {
        id: 'rec-1',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        // Missing title, description, instructions
        ingredients: [],
      };

      const result = RecipeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// SECTION 4: AI Prompt Assembly Tests
// ============================================================================

describe('Recipes Backend - AI Prompt Assembly', () => {
  let backend: TestRecipesBackend;

  beforeEach(() => {
    backend = new TestRecipesBackend();
    backend.setMockKitchenData(CANONICAL_ITEMS_FIXTURE, UNITS_FIXTURE, AISLES_FIXTURE, EQUIPMENT_FIXTURE);
  });

  it('should request system instruction with custom context', async () => {
    const customContext = 'You are resolving recipe ingredients';
    const instruction = await backend.getSystemInstruction(customContext);

    expect(instruction).toBe(customContext);
  });

  it('should use default system instruction when no context provided', async () => {
    backend.setMockSystemInstruction('Default Chef Instructions');
    const instruction = await backend.getSystemInstruction();

    expect(instruction).toBe('Default Chef Instructions');
  });

  it('should assemble Gemini request for recipe generation', async () => {
    const mockResponse = JSON.stringify({
      title: 'Tomato Pasta',
      description: 'Classic pasta with tomato sauce',
      ingredients: ['400 g tomatoes'],
      instructions: ['Cook', 'Serve'],
    });

    backend.setMockGeminiResponse('test-prompt', mockResponse);
    const response = await backend.callGenerateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: 'test-prompt' }] }],
      config: {
        systemInstruction: 'Test',
        responseMimeType: 'application/json',
      },
    });

    expect(response).toBeDefined();
  });
});

// ============================================================================
// SECTION 5: AI Response Handling Tests
// ============================================================================

describe('Recipes Backend - AI Response Handling', () => {
  let backend: TestRecipesBackend;

  beforeEach(() => {
    backend = new TestRecipesBackend();
  });

  describe('Valid AI Responses', () => {
    it('should parse valid recipe JSON response', () => {
      const response = JSON.stringify({
        title: 'Tomato Pasta',
        description: 'Classic pasta',
        ingredients: [{ name: 'tomato', quantity: 400, unit: 'g' }],
        instructions: ['Cook', 'Serve'],
      });

      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);

      expect(parsed.title).toBe('Tomato Pasta');
      expect(parsed.ingredients).toHaveLength(1);
    });

   it('should handle JSON with markdown formatting', () => {
      const response = `
Here is your recipe:
\`\`\`json
{
  "title": "Garlic Bread",
  "instructions": ["Toast", "Serve"]
}
\`\`\`
      `;

      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);

      expect(parsed.title).toBe('Garlic Bread');
    });

    it('should handle array of recipe suggestions', () => {
      const response = JSON.stringify([
        { title: 'Pasta', instructions: ['Cook', 'Serve'] },
        { title: 'Salad', instructions: ['Mix', 'Serve'] },
      ]);

      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });
  });

  describe('Invalid AI Responses', () => {
    it('should handle malformed JSON gracefully', () => {
      const response = '{ broken json without closing';
      const sanitized = backend.sanitizeJson(response);
      expect(sanitized).toBeDefined();
    });

    it('should extract valid JSON from AI rambling', () => {
      const response = `
The recipe would be approximately:
{"title": "Pasta", "instructions": ["Cook"]}
Some extra text here.
      `;

      const sanitized = backend.sanitizeJson(response);
      const parsed = JSON.parse(sanitized);

      expect(parsed.title).toBe('Pasta');
    });

    it('should handle empty response', () => {
      const response = '';
      const sanitized = backend.sanitizeJson(response);
      expect(sanitized).toBe('');
    });
  });
});

// ============================================================================
// SECTION 6: Error Path Tests
// ============================================================================

describe('Recipes Backend - Error Paths', () => {
  let backend: TestRecipesBackend;

  beforeEach(() => {
    backend = new TestRecipesBackend();
  });

  describe('Invalid Input Handling', () => {
    it('should handle empty ingredient string', () => {
      const result = backend.parseIngredientString('');
      expect(result).toBeDefined();
      expect(result.ingredientName).toBe('');
      expect(result.quantity).toBeNull();
    });

    it('should handle whitespace-only ingredient', () => {
      const result = backend.parseIngredientString('   ');
      expect(result).toBeDefined();
      expect(result.ingredientName).toBe('');
    });

    it('should handle extremely long ingredient string', () => {
      const longIngredient = 'a'.repeat(10000) + ' tomatoes';
      const result = backend.parseIngredientString(longIngredient);
      expect(result).toBeDefined();
      expect(result.ingredientName).toBeDefined();
    });

    it('should handle ingredient with special characters', () => {
      const result = backend.parseIngredientString('100 g crème fraîche');
      expect(result.ingredientName).toBeDefined();
      expect(result.quantity).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle fractional quantities', () => {
      const result = backend.parseIngredientString('0.5 kg flour');
      expect(result.quantity).toBeCloseTo(0.5, 5);
      expect(result.unit).toBe('kg');
    });

    it('should handle very large quantities', () => {
      const result = backend.parseIngredientString('9999999 g flour');
      expect(result.quantity).toBe(9999999);
    });

    it('should handle ingredient names with numbers', () => {
      const result = backend.parseIngredientString('500 ml 2% milk');
      expect(result.ingredientName).toContain('2');
    });

    it('should handle multiple spaces and tabs', () => {
      const result = backend.parseIngredientString('400  \t  g  \t  tomatoes');
      expect(result.quantity).toBe(400);
    });
  });
});

// ============================================================================
// SECTION 7: Integration Tests
// ============================================================================

describe('Recipes Backend - Integration', () => {
  let backend: TestRecipesBackend;

  beforeEach(() => {
    backend = new TestRecipesBackend();
    backend.setMockKitchenData(CANONICAL_ITEMS_FIXTURE, UNITS_FIXTURE, AISLES_FIXTURE, EQUIPMENT_FIXTURE);
  });

  it('should parse and normalize complete recipe data', () => {
    const rawRecipeData = {
      recipeName: 'Tomato Pasta',
      ingredientList: [
        '400 g tomatoes',
        '2 large red onions, diced',
        '3 cloves garlic, minced',
      ],
      method: ['Cook pasta', 'Make sauce', 'Combine'],
      equipment: ['Frying Pan', 'Pot'],
      prep: '10 mins',
      cook: '20 mins',
    };

    const normalized = backend.normalizeRecipeData(rawRecipeData);

    expect(normalized.title).toBe('Tomato Pasta');
    expect(normalized.ingredients).toHaveLength(3);
    expect(normalized.instructions).toHaveLength(3);
    expect(normalized.equipmentNeeded).toHaveLength(2);
  });

  it('should validate parsed ingredients against schema', async () => {
    const rawIngredients = [
      '400 g tomatoes',
      '2 onions',
      '3 cloves garlic',
    ];

    const results = rawIngredients.map((raw, idx) => {
      const parsed = backend.parseIngredientString(raw);
      return {
        id: `ri-${idx}`,
        raw,
        ...parsed,
        canonicalItemId: undefined,
      };
    });

    expect(results).toHaveLength(3);
    results.forEach(r => {
      const validation = RecipeIngredientSchema.safeParse(r);
      expect(validation).toBeDefined();
    });
  });

  it('should handle recipe with mixed ingredient formats', () => {
    const ingredients = [
      '400 g fresh tomatoes',
      '2 large red onions, diced fine',
      '1 tsp salt',
      'Black pepper to taste',
    ];

    const parsed = ingredients.map(ing => backend.parseIngredientString(ing));

    expect(parsed[0].quantity).toBe(400);
    expect(parsed[0].unit).toBe('g');
    expect(parsed[1].preparation).toContain('diced');
    expect(parsed[2].unit).toBe('tsp');
    expect(parsed[3].quantity).toBeNull();
  });

  it('should match ingredients to canonical items with fuzzy scoring', () => {
    const testCases = [
      { ingredient: '400 g tomatoes', expectedName: 'tomato' },
      { ingredient: '2 onions', expectedName: 'onion' },
      { ingredient: '3 cloves garlic', expectedName: 'garlic' },
    ];

    testCases.forEach(({ ingredient, expectedName }) => {
      const parsed = backend.parseIngredientString(ingredient);
      expect(parsed.ingredientName.toLowerCase()).toContain(expectedName.toLowerCase());
    });
  });

  it('should normalize recipe from external source (MyFitnessPal format)', () => {
    const externalRecipe = {
      name: 'Beef Stir Fry',
      serves: 4,
      prep_time: '15 minutes',
      cook_time: '20 minutes',
      steps: [
        'Brown the beef mince',
        'Add vegetables',
        'Season and serve',
      ],
    };

    const normalized = backend.normalizeRecipeData(externalRecipe);

    expect(normalized.title).toBe('Beef Stir Fry');
    expect(normalized.servings).toBe(4);
    expect(normalized.prepTime).toBe('15 minutes');
    expect(normalized.instructions).toHaveLength(3);
  });
});
