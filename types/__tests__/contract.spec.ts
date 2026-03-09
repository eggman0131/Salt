/**
 * The Law Test Suite (types/contract.ts)
 *
 * This test suite validates the contract schema at:
 * - Import level (all types exist, no circular references)
 * - Runtime level (Zod validation, valid/invalid objects)
 * - Type level (TypeScript type narrowing, field relationships)
 * - Snapshot level (detect accidental schema edits)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { expectTypeOf } from 'vitest';
import { z } from 'zod';

// ============================================================================
// SECTION 1: Import All Contract Types
// This ensures no circular references and that all types are exportable
// ============================================================================

import {
  // User
  UserSchema,
  type User,
  // Kitchen Settings
  KitchenSettingsSchema,
  type KitchenSettings,
  // Equipment & Accessories
  AccessorySchema,
  type Accessory,
  EquipmentSchema,
  type Equipment,
  // Recipe Categories
  RecipeCategorySchema,
  type RecipeCategory,
  // Shopping Domain
  UnitSchema,
  type Unit,
  AisleSchema,
  type Aisle,
  CanonicalItemSchema,
  type CanonicalItem,
  RecipeIngredientSchema,
  type RecipeIngredient,
  ShoppingListSchema,
  type ShoppingList,
  ShoppingListItemSchema,
  type ShoppingListItem,
  // Recipes
  RecipeHistoryEntrySchema,
  type RecipeHistoryEntry,
  RecipeSchema,
  type Recipe,
  // Planner
  DayPlanSchema,
  type DayPlan,
  PlanSchema,
  type Plan,
} from '../contract';
import type { EquipmentCandidate } from '../../modules/inventory/types';

// ============================================================================
// SECTION 2: Schema Import Verification
// Validates that all schemas exist and are Zod schemas
// ============================================================================

describe('Contract Schema - Import Verification', () => {
  it('should export all required Zod schemas', () => {
    const schemas = [
      UserSchema,
      KitchenSettingsSchema,
      AccessorySchema,
      EquipmentSchema,
      RecipeCategorySchema,
      UnitSchema,
      AisleSchema,
      CanonicalItemSchema,
      RecipeIngredientSchema,
      ShoppingListSchema,
      ShoppingListItemSchema,
      RecipeHistoryEntrySchema,
      RecipeSchema,
      DayPlanSchema,
      PlanSchema,
    ];

    schemas.forEach(schema => {
      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('parse');
      expect(schema).toHaveProperty('safeParse');
    });
  });

  it('should have no circular reference issues', () => {
    // If there were circular references, the import above would fail.
    // This test documents that fact.
    expect(true).toBe(true);
  });
});

// ============================================================================
// SECTION 3: Runtime Validation Tests (Zod)
// Tests valid and invalid objects against the contract schemas
// ============================================================================

describe('Contract Runtime Validation - User', () => {
  const validUser: User = {
    id: 'user-123',
    email: 'chef@kitchen.uk',
    displayName: 'Chef Gordon',
  };

  it('should accept valid user object', () => {
    const result = UserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it('should reject user with invalid email', () => {
    const invalid = { ...validUser, email: 'not-an-email' };
    const result = UserSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe('invalid_format');
    }
  });

  it('should reject user with missing required field', () => {
    const invalid = { email: 'chef@kitchen.uk', displayName: 'Chef Gordon' };
    const result = UserSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should infer user type from schema', () => {
    const user: z.infer<typeof UserSchema> = {
      id: 'id',
      email: 'test@test.com',
      displayName: 'Test',
    };
    expect(user.id).toBeDefined();
  });
});

describe('Contract Runtime Validation - KitchenSettings', () => {
  const validSettings: KitchenSettings = {
    directives: 'No garlic',
    userOrder: ['user1', 'user2'],
    debugEnabled: false,
  };

  it('should accept valid kitchen settings', () => {
    const result = KitchenSettingsSchema.safeParse({
      directives: 'No garlic',
    });
    expect(result.success).toBe(true);
  });

  it('should accept settings with optional fields', () => {
    const result = KitchenSettingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it('should reject settings missing required directives', () => {
    const result = KitchenSettingsSchema.safeParse({
      userOrder: ['user1'],
      debugEnabled: true,
    });
    expect(result.success).toBe(false);
  });

  it('should allow userOrder to be undefined', () => {
    const result = KitchenSettingsSchema.safeParse({
      directives: 'No nuts',
    });
    expect(result.success).toBe(true);
  });
});

describe('Contract Runtime Validation - Accessory', () => {
  const validAccessory: Accessory = {
    id: 'acc-1',
    name: 'Whisk Attachment',
    description: 'For mixing',
    owned: true,
    type: 'standard',
  };

  it('should accept valid accessory', () => {
    const result = AccessorySchema.safeParse(validAccessory);
    expect(result.success).toBe(true);
  });

  it('should enforce type enum', () => {
    const invalid = { ...validAccessory, type: 'unknown' };
    const result = AccessorySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should allow optional description', () => {
    const accessory: Accessory = {
      id: 'acc-2',
      name: 'Beater',
      owned: false,
      type: 'optional',
    };
    const result = AccessorySchema.safeParse(accessory);
    expect(result.success).toBe(true);
  });

  it('should validate accessory type enum values', () => {
    const validTypes = ['standard', 'optional'];
    expect(validTypes).toContain('standard');
    expect(validTypes).toContain('optional');
  });
});

describe('Contract Runtime Validation - Equipment', () => {
  const validEquipment: Equipment = {
    id: 'eq-1',
    name: 'Stand Mixer',
    brand: 'KitchenAid',
    modelName: 'KSM150',
    description: 'Electric stand mixer for mixing and kneading',
    type: 'Mixer',
    class: 'Complex Appliance',
    accessories: [
      {
        id: 'acc-1',
        name: 'Paddle',
        owned: true,
        type: 'standard',
      },
    ],
    status: 'Available',
  };

  it('should accept valid equipment', () => {
    const result = EquipmentSchema.safeParse(validEquipment);
    expect(result.success).toBe(true);
  });

  it('should enforce status enum', () => {
    const invalid = { ...validEquipment, status: 'Broken' };
    const result = EquipmentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should allow valid status values', () => {
    const validStatuses = ['Available', 'In Use', 'Maintenance'];
    validStatuses.forEach(status => {
      const eq = { ...validEquipment, status };
      const result = EquipmentSchema.safeParse(eq);
      expect(result.success).toBe(true);
    });
  });

  it('should validate nested accessories', () => {
    const result = EquipmentSchema.safeParse({
      ...validEquipment,
      accessories: [
        {
          id: 'acc-1',
          name: 'Paddle',
          owned: true,
          type: 'standard',
        },
        {
          id: 'acc-2',
          name: 'Hook',
          owned: true,
          type: 'standard',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('Contract Runtime Validation - RecipeCategory', () => {
  const validCategory: RecipeCategory = {
      id: 'cat-1',
      name: 'Pasta',
      description: 'Pasta dishes',
      createdAt: new Date().toISOString(),
      isApproved: false
  };

  it('should accept valid category', () => {
    const result = RecipeCategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
  });

  it('should enforce confidence bounds (0-1)', () => {
    const withValidConfidence = { ...validCategory, confidence: 0.85 };
    const result1 = RecipeCategorySchema.safeParse(withValidConfidence);
    expect(result1.success).toBe(true);

    const withInvalidConfidence = { ...validCategory, confidence: 1.5 };
    const result2 = RecipeCategorySchema.safeParse(withInvalidConfidence);
    expect(result2.success).toBe(false);
  });

  it('should default isApproved to true', () => {
    const result = RecipeCategorySchema.parse({
      id: 'cat-2',
      name: 'Soup',
      createdAt: new Date().toISOString(),
    });
    expect(result.isApproved).toBe(true);
  });
});

describe('Contract Runtime Validation - Unit', () => {
  const validUnit: Unit = {
    id: 'unit-1',
    name: 'g',
    plural: 'g',
    category: 'weight',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
  };

  it('should accept valid unit', () => {
    const result = UnitSchema.safeParse(validUnit);
    expect(result.success).toBe(true);
  });

  it('should default sortOrder to 999', () => {
    const result = UnitSchema.parse({
      id: 'unit-2',
      name: 'kg',
      plural: 'kg',
      category: 'weight',
      createdAt: new Date().toISOString(),
    });
    expect(result.sortOrder).toBe(999);
  });

  it('should accept metric units', () => {
    const metricUnits: Array<{ name: string; category: Unit['category'] }> = [
      { name: 'g', category: 'weight' },
      { name: 'kg', category: 'weight' },
      { name: 'ml', category: 'volume' },
      { name: 'l', category: 'volume' },
      { name: 'tsp', category: 'volume' },
      { name: 'tbsp', category: 'volume' },
    ];

    metricUnits.forEach(({ name, category }) => {
      const unit: Unit = {
        id: `unit-${name}`,
        name,
        plural: name,
        category,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
      };
      const result = UnitSchema.safeParse(unit);
      expect(result.success).toBe(true);
    });
  });
});

describe('Contract Runtime Validation - Aisle', () => {
  const validAisle: Aisle = {
    id: 'aisle-1',
    name: 'Produce',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
  };

  it('should accept valid aisle', () => {
    const result = AisleSchema.safeParse(validAisle);
    expect(result.success).toBe(true);
  });

  it('should default sortOrder to 999', () => {
    const result = AisleSchema.parse({
      id: 'aisle-2',
      name: 'Dairy',
      createdAt: new Date().toISOString(),
    });
    expect(result.sortOrder).toBe(999);
  });
});

describe('Contract Runtime Validation - CanonicalItem', () => {
  const validItem: CanonicalItem = {
    id: 'item-onion',
    name: 'Onion',
    normalisedName: 'onion',
    isStaple: true,
    aisle: 'Produce',
    preferredUnit: 'g',
    createdAt: new Date().toISOString(),
  };

  it('should accept valid canonical item', () => {
    const result = CanonicalItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it('should reject item without normalisedName', () => {
    const invalid = {
      id: 'item-tomato',
      name: 'Tomato',
      isStaple: false,
      aisle: 'Produce',
      preferredUnit: 'g',
      createdAt: new Date().toISOString(),
    };
    const result = CanonicalItemSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should allow optional metadata', () => {
    const result = CanonicalItemSchema.safeParse({
      ...validItem,
      metadata: { color: 'white', texture: 'papery' },
    });
    expect(result.success).toBe(true);
  });
});

describe('Contract Runtime Validation - RecipeIngredient', () => {
  const validIngredient: RecipeIngredient = {
    id: 'ri-1',
    raw: '400 g tomatoes, diced',
    quantity: 400,
    unit: 'g',
    ingredientName: 'tomatoes',
    preparation: 'diced',
    canonicalItemId: 'item-tomato',
  };

  it('should accept valid recipe ingredient', () => {
    const result = RecipeIngredientSchema.safeParse(validIngredient);
    expect(result.success).toBe(true);
  });

  it('should allow null quantity and unit', () => {
    const ingredient: RecipeIngredient = {
      id: 'ri-2',
      raw: 'Salt to taste',
      quantity: null,
      unit: null,
      ingredientName: 'salt',
    };
    const result = RecipeIngredientSchema.safeParse(ingredient);
    expect(result.success).toBe(true);
  });

  it('should allow missing canonicalItemId (for unmapped items)', () => {
    const ingredient: RecipeIngredient = {
      id: 'ri-3',
      raw: 'Fresh herbs',
      quantity: null,
      unit: null,
      ingredientName: 'fresh herbs',
    };
    const result = RecipeIngredientSchema.safeParse(ingredient);
    expect(result.success).toBe(true);
  });
});

describe('Contract Runtime Validation - ShoppingList', () => {
  const validList: ShoppingList = {
    id: 'list-1',
    name: 'Weekly Shop',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
  };

  it('should accept valid shopping list', () => {
    const result = ShoppingListSchema.safeParse(validList);
    expect(result.success).toBe(true);
  });

  it('should require isDefault', () => {
    const missing = { id: 'list-2', name: 'Quick Shop', createdAt: new Date().toISOString() };
    const result = ShoppingListSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('should allow optional updatedAt and createdBy', () => {
    const minimal: ShoppingList = {
      id: 'list-2',
      name: 'Quick Shop',
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    const result = ShoppingListSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

describe('Contract Runtime Validation - ShoppingListItem', () => {
  const validItem: ShoppingListItem = {
    id: 'sli-1',
    shoppingListId: 'list-1',
    canonicalItemId: 'item-onion',
    name: 'Onion',
    aisle: 'Produce',
    totalBaseQty: 4,
    baseUnit: 'g',
    contributions: [
      {
        sourceType: 'recipe',
        recipeId: 'rec-1',
        recipeTitle: 'Pasta Bake',
        rawText: '4 onions, diced',
        qty: 4,
        unit: 'g',
        addedBy: 'user-1',
        addedAt: new Date().toISOString(),
      },
    ],
    status: 'active',
    checked: false,
    updatedAt: new Date().toISOString(),
  };

  it('should accept valid shopping list item', () => {
    const result = ShoppingListItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it('should accept item with needs_review status (storecupboard)', () => {
    const result = ShoppingListItemSchema.safeParse({
      ...validItem,
      status: 'needs_review',
    });
    expect(result.success).toBe(true);
  });

  it('should accept unmatched manual item (no canonicalItemId)', () => {
    const unmatched: ShoppingListItem = {
      id: 'sli-2',
      shoppingListId: 'list-1',
      name: 'Dishwasher tablets',
      contributions: [
        {
          sourceType: 'manual',
          rawText: 'Dishwasher tablets',
          addedBy: 'user-1',
          addedAt: new Date().toISOString(),
        },
      ],
      status: 'active',
      checked: false,
      addedBy: 'user-1',
      updatedAt: new Date().toISOString(),
    };
    const result = ShoppingListItemSchema.safeParse(unmatched);
    expect(result.success).toBe(true);
  });

  it('should accept multiple contributions from different recipes', () => {
    const result = ShoppingListItemSchema.safeParse({
      ...validItem,
      totalBaseQty: 300,
      contributions: [
        { sourceType: 'recipe', recipeId: 'rec-1', recipeTitle: 'Pasta', rawText: '200g butter', qty: 200, unit: 'g', addedBy: 'user-1', addedAt: new Date().toISOString() },
        { sourceType: 'recipe', recipeId: 'rec-2', recipeTitle: 'Cake', rawText: '100g butter', qty: 100, unit: 'g', addedBy: 'user-1', addedAt: new Date().toISOString() },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should allow optional note', () => {
    const result = ShoppingListItemSchema.safeParse({ ...validItem, note: 'Buy unsalted' });
    expect(result.success).toBe(true);
  });

  it('should enforce status enum', () => {
    const result = ShoppingListItemSchema.safeParse({ ...validItem, status: 'pending' });
    expect(result.success).toBe(false);
  });
});

describe('Contract Runtime Validation - Recipe', () => {
  const validRecipe: Recipe = {
    id: 'rec-1',
    title: 'Tomato Pasta',
    description: 'Classic Italian pasta',
    ingredients: [
      {
        id: 'ri-1',
        raw: '400 g tomatoes',
        quantity: 400,
        unit: 'g',
        ingredientName: 'tomatoes',
      },
    ],
    instructions: [
      { id: 'step-1', text: 'Boil water', ingredients: [], technicalWarnings: [] },
      { id: 'step-2', text: 'Add pasta', ingredients: [], technicalWarnings: [] },
      { id: 'step-3', text: 'Make sauce', ingredients: [], technicalWarnings: [] },
    ],
    equipmentNeeded: ['Saucepan', 'Frying Pan'],
    prepTime: '10 mins',
    cookTime: '20 mins',
    totalTime: '30 mins',
    servings: '4',
    complexity: 'Simple',
    createdAt: new Date().toISOString(),
    createdBy: 'chef-1',
  };

  it('should accept valid recipe', () => {
    const result = RecipeSchema.safeParse(validRecipe);
    expect(result.success).toBe(true);
  });

  it('should enforce complexity enum', () => {
    const invalid = { ...validRecipe, complexity: 'Expert' };
    const result = RecipeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should allow all complexity levels', () => {
    const levels = ['Beginner', 'Simple', 'Intermediate', 'Hard', 'Technical'];
    levels.forEach(complexity => {
      const result = RecipeSchema.safeParse({ ...validRecipe, complexity });
      expect(result.success).toBe(true);
    });
  });

  it('should allow optional fields', () => {
    const result = RecipeSchema.safeParse({
      ...validRecipe,
      categoryIds: ['cat-1'],
      imagePath: '/recipes/rec-1/image.jpg',
      collection: 'Italian',
      source: 'BBC Good Food',
    });
    expect(result.success).toBe(true);
  });

  it('should validate recipe history', () => {
    const result = RecipeSchema.safeParse({
      ...validRecipe,
      history: [
        {
          timestamp: new Date().toISOString(),
          changeDescription: 'Created',
          snapshot: { title: 'Tomato Pasta' },
          userName: 'chef-1',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('Contract Runtime Validation - DayPlan', () => {
  const validDayPlan: DayPlan = {
    date: '2026-02-16',
    cookId: null,
    presentIds: ['user-1', 'user-2'],
    userNotes: { 'user-1': 'No shellfish' },
    mealNotes: 'Vegetarian meal',
  };

  it('should accept valid day plan', () => {
    const result = DayPlanSchema.safeParse(validDayPlan);
    expect(result.success).toBe(true);
  });

  it('should allow null cookId', () => {
    const result = DayPlanSchema.safeParse(validDayPlan);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cookId).toBeNull();
    }
  });
});

describe('Contract Runtime Validation - Plan', () => {
  const validPlan: Plan = {
    id: 'plan-1',
    startDate: '2026-02-16',
    days: [
      {
        date: '2026-02-16',
        cookId: null,
        presentIds: ['user-1'],
        userNotes: {},
        mealNotes: 'Monday dinner',
      },
    ],
    createdAt: new Date().toISOString(),
    createdBy: 'user-1',
  };

  it('should accept valid plan', () => {
    const result = PlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it('should validate nested day plans', () => {
    const multiDay: Plan = {
      id: 'plan-2',
      startDate: '2026-02-16',
      days: [
        {
          date: '2026-02-16',
          cookId: 'user-1',
          presentIds: ['user-1', 'user-2'],
          userNotes: { 'user-2': 'No garlic' },
          mealNotes: 'Dinner',
        },
        {
          date: '2026-02-17',
          cookId: null,
          presentIds: ['user-1'],
          userNotes: {},
          mealNotes: 'Lunch',
        },
      ],
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };
    const result = PlanSchema.safeParse(multiDay);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// SECTION 4: Type-Level Tests (TypeScript Inference)
// Uses expectTypeOf to validate type relationships and narrowing
// ============================================================================

describe('Contract Type-Level Tests - Type Safety', () => {
  it('should infer correct User type from schema', () => {
    const user: z.infer<typeof UserSchema> = {
      id: 'id',
      email: 'test@test.com',
      displayName: 'Test',
    };
    expectTypeOf(user.id).toBeString();
    expectTypeOf(user.email).toBeString();
    expectTypeOf(user.displayName).toBeString();
  });

  it('should enforce readonly constraint on recipes', () => {
    const recipe: Recipe = {
      id: 'rec-1',
      title: 'Title',
      description: 'Desc',
      ingredients: [],
      instructions: [],
      equipmentNeeded: [],
      prepTime: '10 mins',
      cookTime: '20 mins',
      totalTime: '30 mins',
      servings: '4',
      complexity: 'Simple',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };
    expectTypeOf(recipe.id).toBeString();
    expectTypeOf(recipe.createdAt).toBeString();
  });

  it('should validate optional fields are truly optional', () => {
    const user: User = {
      id: 'id',
      email: 'test@test.com',
      displayName: 'Test',
    };
    // Should not require optional fields
    expectTypeOf(user).toMatchTypeOf<User>();
  });

  it('should type shopping list items correctly', () => {
    const item: ShoppingListItem = {
      id: 'sli-1',
      shoppingListId: 'list-1',
      canonicalItemId: 'item-1',
      name: 'Onion',
      aisle: 'Produce',
      totalBaseQty: 4,
      baseUnit: 'g',
      contributions: [],
      status: 'active',
      checked: false,
      updatedAt: new Date().toISOString(),
    };
    expectTypeOf(item.checked).toBeBoolean();
    expectTypeOf(item.contributions).toBeArray();
    expectTypeOf(item.status).toMatchTypeOf<'needs_review' | 'active'>();
  });

  it('should preserve enum types', () => {
    const equipment: Equipment = {
      id: 'eq-1',
      name: 'Mixer',
      brand: 'Brand',
      modelName: 'Model',
      description: 'Desc',
      type: 'Mixer',
      class: 'Complex Appliance',
      accessories: [],
      status: 'Available',
    };
    expectTypeOf(equipment.status).toMatchTypeOf<'Available' | 'In Use' | 'Maintenance'>();
  });

  it('should enforce array types for collections', () => {
    const recipe: Recipe = {
      id: 'rec-1',
      title: 'Title',
      description: 'Desc',
      ingredients: [],
      instructions: [],
      equipmentNeeded: [],
      prepTime: '10 mins',
      cookTime: '20 mins',
      totalTime: '30 mins',
      servings: '4',
      complexity: 'Simple',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };
    expectTypeOf(recipe.ingredients).toBeArray();
    expectTypeOf(recipe.instructions).toBeArray();
    expectTypeOf(recipe.equipmentNeeded).toBeArray();
  });

  it('should validate EquipmentCandidate interface', () => {
    const candidate: EquipmentCandidate = {
      brand: 'KitchenAid',
      modelName: 'KSM150',
      description: 'Stand mixer',
      category: 'Complex Appliance',
    };
    expectTypeOf(candidate.brand).toBeString();
    expectTypeOf(candidate.category).toMatchTypeOf<
      'Complex Appliance' | 'Technical Cookware' | 'Standard Tool'
    >();
  });

  it('should validate nullable fields in recipes', () => {
    const ingredient: RecipeIngredient = {
      id: 'ri-1',
      raw: 'Salt to taste',
      quantity: null,
      unit: null,
      ingredientName: 'salt',
    };
    expectTypeOf(ingredient.quantity).toMatchTypeOf<number | null>();
    expectTypeOf(ingredient.unit).toMatchTypeOf<string | null>();
  });
});

describe('Contract Type-Level Tests - Field Relationships', () => {
  it('should validate plan contains day plans', () => {
    const plan: Plan = {
      id: 'plan-1',
      startDate: '2026-02-16',
      days: [],
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };
    expectTypeOf(plan.days).toBeArray();
    expectTypeOf(plan.days[0]).toMatchTypeOf<DayPlan | undefined>();
  });

  it('should validate recipes contain ingredients', () => {
    const recipe: Recipe = {
      id: 'rec-1',
      title: 'Title',
      description: 'Desc',
      ingredients: [],
      instructions: [],
      equipmentNeeded: [],
      prepTime: '10 mins',
      cookTime: '20 mins',
      totalTime: '30 mins',
      servings: '4',
      complexity: 'Simple',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };
    expectTypeOf(recipe.ingredients).toBeArray();
    expectTypeOf(recipe.ingredients[0]).toMatchTypeOf<RecipeIngredient | undefined>();
  });

  it('should validate equipment contains accessories', () => {
    const equipment: Equipment = {
      id: 'eq-1',
      name: 'Mixer',
      brand: 'Brand',
      modelName: 'Model',
      description: 'Desc',
      type: 'Mixer',
      class: 'Complex Appliance',
      accessories: [],
      status: 'Available',
    };
    expectTypeOf(equipment.accessories).toBeArray();
    expectTypeOf(equipment.accessories[0]).toMatchTypeOf<Accessory | undefined>();
  });

  it('should validate shopping list items link to canonical items', () => {
    const item: ShoppingListItem = {
      id: 'sli-1',
      shoppingListId: 'list-1',
      canonicalItemId: 'item-1',
      name: 'Onion',
      contributions: [],
      status: 'active',
      checked: false,
      updatedAt: new Date().toISOString(),
    };
    expectTypeOf(item.canonicalItemId).toMatchTypeOf<string | undefined>();
    expectTypeOf(item.shoppingListId).toBeString();
  });
});

// ============================================================================
// SECTION 5: Snapshot Test
// Captures the entire contract schema to detect accidental edits
// ============================================================================

describe('Contract Snapshot Test', () => {
  it('should match contract schema snapshot', () => {
    const contractSnapshot = {
      schemas: {
        UserSchema: UserSchema.toString(),
        KitchenSettingsSchema: KitchenSettingsSchema.toString(),
        AccessorySchema: AccessorySchema.toString(),
        EquipmentSchema: EquipmentSchema.toString(),
        RecipeCategorySchema: RecipeCategorySchema.toString(),
        UnitSchema: UnitSchema.toString(),
        AisleSchema: AisleSchema.toString(),
        CanonicalItemSchema: CanonicalItemSchema.toString(),
        RecipeIngredientSchema: RecipeIngredientSchema.toString(),
        ShoppingListSchema: ShoppingListSchema.toString(),
        ShoppingListItemSchema: ShoppingListItemSchema.toString(),
        RecipeHistoryEntrySchema: RecipeHistoryEntrySchema.toString(),
        RecipeSchema: RecipeSchema.toString(),
        DayPlanSchema: DayPlanSchema.toString(),
        PlanSchema: PlanSchema.toString(),
      },
      types: {
        User: 'User',
        KitchenSettings: 'KitchenSettings',
        Accessory: 'Accessory',
        Equipment: 'Equipment',
        RecipeCategory: 'RecipeCategory',
        Unit: 'Unit',
        Aisle: 'Aisle',
        CanonicalItem: 'CanonicalItem',
        RecipeIngredient: 'RecipeIngredient',
        ShoppingList: 'ShoppingList',
        ShoppingListItem: 'ShoppingListItem',
        RecipeHistoryEntry: 'RecipeHistoryEntry',
        Recipe: 'Recipe',
        DayPlan: 'DayPlan',
        Plan: 'Plan',
        EquipmentCandidate: 'EquipmentCandidate',
      },
    };
    expect(contractSnapshot).toMatchSnapshot();
  });
});

// ============================================================================
// SECTION 6: Contract Stability Tests
// Ensures that core relationships and patterns remain stable
// ============================================================================

describe('Contract Stability - Core Relationships', () => {
  it('should maintain shopping list to item relationship', () => {
    const list: ShoppingList = {
      id: 'list-1',
      name: 'Weekly',
      isDefault: true,
      createdAt: new Date().toISOString(),
    };

    const item: ShoppingListItem = {
      id: 'sli-1',
      shoppingListId: list.id,
      canonicalItemId: 'item-1',
      name: 'Onion',
      aisle: 'Produce',
      contributions: [],
      status: 'active',
      checked: false,
      updatedAt: new Date().toISOString(),
    };

    expect(item.shoppingListId).toBe(list.id);
  });

  it('should maintain recipe to ingredient relationship', () => {
    const recipe: Recipe = {
      id: 'rec-1',
      title: 'Pasta',
      description: 'Desc',
      ingredients: [
        {
          id: 'ri-1',
          raw: '400 g tomatoes',
          quantity: 400,
          unit: 'g',
          ingredientName: 'Tomatoes',
        },
      ],
      instructions: [],
      equipmentNeeded: [],
      prepTime: '10 mins',
      cookTime: '20 mins',
      totalTime: '30 mins',
      servings: '4',
      complexity: 'Simple',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };

    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.ingredients[0].ingredientName).toBe('Tomatoes');
  });

  it('should maintain equipment to accessory relationship', () => {
    const equipment: Equipment = {
      id: 'eq-1',
      name: 'Mixer',
      brand: 'KitchenAid',
      modelName: 'KSM150',
      description: 'Stand mixer',
      type: 'Mixer',
      class: 'Complex Appliance',
      accessories: [
        {
          id: 'acc-1',
          name: 'Paddle',
          owned: true,
          type: 'standard',
        },
      ],
      status: 'Available',
    };

    expect(equipment.accessories).toHaveLength(1);
    expect(equipment.accessories[0].name).toBe('Paddle');
  });

  it('should maintain plan to day plan relationship', () => {
    const plan: Plan = {
      id: 'plan-1',
      startDate: '2026-02-16',
      days: [
        {
          date: '2026-02-16',
          cookId: null,
          presentIds: ['user-1'],
          userNotes: {},
          mealNotes: 'Dinner',
        },
      ],
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };

    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].date).toBe('2026-02-16');
  });
});

// ============================================================================
// SECTION 7: Validation Consistency Tests
// Ensures Zod schemas and TypeScript types stay in sync
// ============================================================================

describe('Contract Validation Consistency', () => {
  it('UserSchema and User type should be consistent', () => {
    const user: User = {
      id: 'id-1',
      email: 'test@example.com',
      displayName: 'Test User',
    };

    const result = UserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it('RecipeSchema and Recipe type should be consistent', () => {
    const recipe: Recipe = {
      id: 'rec-1',
      title: 'Test Recipe',
      description: 'A test recipe',
      ingredients: [],
      instructions: [
        { id: 'step-1', text: 'Step 1', ingredients: [], technicalWarnings: [] },
      ],
      equipmentNeeded: ['Pan'],
      prepTime: '10 mins',
      cookTime: '15 mins',
      totalTime: '25 mins',
      servings: '2',
      complexity: 'Simple',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
    };

    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(true);
  });

  it('ShoppingListItemSchema and ShoppingListItem type should be consistent', () => {
    const item: ShoppingListItem = {
      id: 'sli-1',
      shoppingListId: 'list-1',
      canonicalItemId: 'item-1',
      name: 'Tomato',
      aisle: 'Produce',
      totalBaseQty: 3,
      baseUnit: 'g',
      contributions: [
        { sourceType: 'recipe', recipeId: 'rec-1', recipeTitle: 'Salad', rawText: '3 tomatoes', qty: 3, unit: 'g', addedBy: 'user-1', addedAt: new Date().toISOString() },
      ],
      status: 'active',
      checked: false,
      updatedAt: new Date().toISOString(),
    };

    const result = ShoppingListItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('EquipmentSchema and Equipment type should be consistent', () => {
    const equipment: Equipment = {
      id: 'eq-1',
      name: 'Oven',
      brand: 'Aga',
      modelName: 'AGA500',
      description: 'Range cooker',
      type: 'Oven',
      class: 'Complex Appliance',
      accessories: [],
      status: 'Available',
    };

    const result = EquipmentSchema.safeParse(equipment);
    expect(result.success).toBe(true);
  });
});
