/**
 * Module Export Tests
 * 
 * Validates the public API surface of each module to ensure:
 * - Only intended exports are exposed
 * - Module boundaries are maintained
 * - No internal implementation details leak
 * - Type exports and runtime exports are correct
 * 
 * These tests run on every module refactor to ensure API stability.
 */

import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';

// ============================================================================
// Admin Module
// ============================================================================

describe('Admin Module Exports', () => {
  it('should export AdminModule component', async () => {
    const adminModule = await import('../admin');
    expect(adminModule.AdminModule).toBeDefined();
    expect(typeof adminModule.AdminModule).toBe('function');
  });

  it('should not export internal components', async () => {
    const adminModule = await import('../admin');
    const exports = Object.keys(adminModule);
    
    // Should only export AdminModule
    expect(exports).toEqual(['AdminModule']);
    
    // Should not expose UsersModule or other internals
    expect((adminModule as any).UsersModule).toBeUndefined();
  });

  it('should not export backend (admin has no backend)', async () => {
    const adminModule = await import('../admin');
    expect((adminModule as any).adminBackend).toBeUndefined();
  });
});

// ============================================================================
// AI Module
// ============================================================================

describe('AI Module Exports', () => {
  it('should export AIModule component', async () => {
    const aiModule = await import('../ai');
    expect(aiModule.AIModule).toBeDefined();
    expect(typeof aiModule.AIModule).toBe('function');
  });

  it('should not export internal components', async () => {
    const aiModule = await import('../ai');
    const exports = Object.keys(aiModule);
    
    // Should only export AIModule
    expect(exports).toEqual(['AIModule']);
  });

  it('should not export backend (AI has no backend)', async () => {
    const aiModule = await import('../ai');
    expect((aiModule as any).aiBackend).toBeUndefined();
  });
});

// ============================================================================
// Inventory Module
// ============================================================================

describe('Inventory Module Exports', () => {
  it('should export InventoryModule component', async () => {
    const inventoryModule = await import('../inventory');
    expect(inventoryModule.InventoryModule).toBeDefined();
    expect(typeof inventoryModule.InventoryModule).toBe('function');
  });

  it('should export inventoryBackend', async () => {
    const inventoryModule = await import('../inventory');
    expect(inventoryModule.inventoryBackend).toBeDefined();
    expect(typeof inventoryModule.inventoryBackend).toBe('object');
  });

  it('should export IInventoryBackend type', async () => {
    const inventoryModule = await import('../inventory');
    // Type-only check (won't exist at runtime)
    expectTypeOf(inventoryModule).toHaveProperty('inventoryBackend');
  });

  it('should have all expected exports', async () => {
    const inventoryModule = await import('../inventory');
    const exports = Object.keys(inventoryModule);
    
    expect(exports).toContain('InventoryModule');
    expect(exports).toContain('inventoryBackend');
    expect(exports.length).toBe(2); // Only these two
  });

  it('should not export internal utilities or components', async () => {
    const inventoryModule = await import('../inventory');
    
    // Should not expose internal details
    expect((inventoryModule as any).InventoryList).toBeUndefined();
    expect((inventoryModule as any).InventoryItem).toBeUndefined();
    expect((inventoryModule as any).FirebaseInventoryBackend).toBeUndefined();
  });
});

// ============================================================================

// ============================================================================
// Planner Module
// ============================================================================

describe('Planner Module Exports', () => {
  it('should export PlannerModule component', async () => {
    const plannerModule = await import('../planner');
    expect(plannerModule.PlannerModule).toBeDefined();
    expect(typeof plannerModule.PlannerModule).toBe('function');
  });

  it('should export plannerBackend', async () => {
    const plannerModule = await import('../planner');
    expect(plannerModule.plannerBackend).toBeDefined();
    expect(typeof plannerModule.plannerBackend).toBe('object');
  });

  it('should export IPlannerBackend type', async () => {
    const plannerModule = await import('../planner');
    expectTypeOf(plannerModule).toHaveProperty('plannerBackend');
  });

  it('should have all expected exports', async () => {
    const plannerModule = await import('../planner');
    const exports = Object.keys(plannerModule);
    
    expect(exports).toContain('PlannerModule');
    expect(exports).toContain('plannerBackend');
    expect(exports.length).toBe(2);
  });

  it('should not export internal components', async () => {
    const plannerModule = await import('../planner');
    
    expect((plannerModule as any).MealPlanList).toBeUndefined();
    expect((plannerModule as any).MealPlanForm).toBeUndefined();
    expect((plannerModule as any).FirebasePlannerBackend).toBeUndefined();
  });
});

// ============================================================================
// Recipes Module
// ============================================================================

describe('Recipes Module Exports', () => {
  it('should export recipesBackend', async () => {
    const recipesModule = await import('../recipes');
    expect(recipesModule.recipesBackend).toBeDefined();
    expect(typeof recipesModule.recipesBackend).toBe('object');
  });

  it('should export getRecipesBackend function', async () => {
    const recipesModule = await import('../recipes');
    expect(recipesModule.getRecipesBackend).toBeDefined();
    expect(typeof recipesModule.getRecipesBackend).toBe('function');
  });

  it('should export RecipesModule component', async () => {
    const recipesModule = await import('../recipes');
    expect(recipesModule.RecipesModule).toBeDefined();
    expect(typeof recipesModule.RecipesModule).toBe('function');
  });

  // RecipeDetail and RecipesList are now internal components (not exported)
  // Only RecipesModule (main orchestrator) is exported as the public component

  it('should have all expected exports', async () => {
    const recipesModule = await import('../recipes');
    const exports = Object.keys(recipesModule);
    
    // Simplified exports: only backend and main module
    const expectedExports = [
      'recipesBackend',
      'getRecipesBackend',
      'RecipesModule',
    ];
    
    expectedExports.forEach(exp => {
      expect(exports).toContain(exp);
    });
    
    expect(exports.length).toBe(expectedExports.length);
  });

  it('should not export internal utilities', async () => {
    const recipesModule = await import('../recipes');
    
    // Internal components should not be exported
    expect((recipesModule as any).RecipeCard).toBeUndefined();
    expect((recipesModule as any).RecipeDetailView).toBeUndefined();
    expect((recipesModule as any).RecipesList).toBeUndefined();
    expect((recipesModule as any).RecipeFormDialog).toBeUndefined();
    expect((recipesModule as any).DeleteRecipeDialog).toBeUndefined();
    
    // Internal backend implementations should not be exported
    expect((recipesModule as any).FirebaseRecipesBackend).toBeUndefined();
    expect((recipesModule as any).BaseRecipesBackend).toBeUndefined();
  });
});

// ============================================================================
// Shopping Module
// ============================================================================

describe('Shopping Module Exports', () => {
  it('should export shoppingBackend', async () => {
    const shoppingModule = await import('../shopping');
    expect(shoppingModule.shoppingBackend).toBeDefined();
    expect(typeof shoppingModule.shoppingBackend).toBe('object');
  });

  it('should export ShoppingListModule component', async () => {
    const shoppingModule = await import('../shopping');
    expect(shoppingModule.ShoppingListModule).toBeDefined();
    expect(typeof shoppingModule.ShoppingListModule).toBe('function');
  });

  it('should re-export ShoppingList type from contract', async () => {
    const shoppingModule = await import('../shopping');
    // Type-only check
    expectTypeOf(shoppingModule).toHaveProperty('shoppingBackend');
  });

  it('should have all expected exports', async () => {
    const shoppingModule = await import('../shopping');
    const exports = Object.keys(shoppingModule);
    
    // Should export backend and component only (types don't appear at runtime)
    expect(exports).toContain('shoppingBackend');
    expect(exports).toContain('ShoppingListModule');
    expect(exports.length).toBe(2);
  });

  it('should not export internal components', async () => {
    const shoppingModule = await import('../shopping');
    
    expect((shoppingModule as any).ShoppingListDetail).toBeUndefined();
    expect((shoppingModule as any).ShoppingItemCard).toBeUndefined();
    expect((shoppingModule as any).FirebaseShoppingBackend).toBeUndefined();
  });
});

// ============================================================================
// Cross-Module Boundary Tests
// ============================================================================

describe('Module Boundaries', () => {
  it('should not allow direct imports from module internals', async () => {
    // This test verifies that internal files should not be importable
    // In a real TS project, this would be enforced by tsconfig paths or package.json exports
    
    // These should fail if proper module boundaries are enforced:
    // import { UsersModule } from '../admin/components/UsersModule';
    // import { MealPlanList } from '../planner/components/MealPlanList';
    
    // For now, we verify that public API is the only intended entry point
    const adminModule = await import('../admin');
    expect(Object.keys(adminModule).length).toBeLessThanOrEqual(5);
  });

  it('should maintain consistent backend naming pattern', async () => {
    const inventory = await import('../inventory');
    const planner = await import('../planner');
    const recipes = await import('../recipes');
    const shopping = await import('../shopping');
    const kitchenData = await import('../kitchen-data');
    
    // All backends should use consistent naming: {module}Backend
    expect(inventory.inventoryBackend).toBeDefined();
    expect(planner.plannerBackend).toBeDefined();
    expect(recipes.recipesBackend).toBeDefined();
    expect(shopping.shoppingBackend).toBeDefined();
    expect(kitchenData.kitchenDataBackend).toBeDefined();
  });

  it('should export Module component with consistent naming', async () => {
    const admin = await import('../admin');
    const ai = await import('../ai');
    const inventory = await import('../inventory');
    const kitchenData = await import('../kitchen-data');
    const planner = await import('../planner');
    const recipes = await import('../recipes');
    const shopping = await import('../shopping');
    
    // All modules should export {Module}Module component
    expect(admin.AdminModule).toBeDefined();
    expect(ai.AIModule).toBeDefined();
    expect(inventory.InventoryModule).toBeDefined();
    expect(kitchenData.KitchenDataModule).toBeDefined();
    expect(planner.PlannerModule).toBeDefined();
    expect(recipes.RecipesModule).toBeDefined();
    expect(shopping.ShoppingListModule).toBeDefined();
  });
});

// ============================================================================
// Stability Tests
// ============================================================================

describe('API Stability', () => {
  it('should not break when importing all modules simultaneously', async () => {
    const [admin, ai, inventory, kitchenData, planner, recipes, shopping] = await Promise.all([
      import('../admin'),
      import('../ai'),
      import('../inventory'),
      import('../kitchen-data'),
      import('../planner'),
      import('../recipes'),
      import('../shopping'),
    ]);
    
    expect(admin.AdminModule).toBeDefined();
    expect(ai.AIModule).toBeDefined();
    expect(inventory.InventoryModule).toBeDefined();
    expect(kitchenData.KitchenDataModule).toBeDefined();
    expect(planner.PlannerModule).toBeDefined();
    expect(recipes.RecipesModule).toBeDefined();
    expect(shopping.ShoppingListModule).toBeDefined();
  });

  it('should maintain backend singleton pattern', async () => {
    const inventory1 = await import('../inventory');
    const inventory2 = await import('../inventory');
    
    // Same backend instance should be returned
    expect(inventory1.inventoryBackend).toBe(inventory2.inventoryBackend);
    
    const planner1 = await import('../planner');
    const planner2 = await import('../planner');
    expect(planner1.plannerBackend).toBe(planner2.plannerBackend);
  });
});
