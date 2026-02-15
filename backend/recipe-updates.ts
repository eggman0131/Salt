/**
 * Recipe Update Helpers
 * 
 * Shared backend-facing helpers for recipe updates, history management,
 * and category changes. Used by RecipeDetail to maintain consistent
 * history descriptions and update patterns.
 */

import { Recipe, RecipeHistoryEntry } from '../types/contract';

/**
 * Builds a human-readable summary of manual edits made to a recipe.
 * Compares before and after states and generates a description like:
 * "Edited: title, ingredients (+2, −1), steps (+1), categories"
 */
export function buildManualEditSummary(before: Recipe, after: Recipe): string {
  const changes: string[] = [];
  
  // Check title
  if (after.title !== before.title) {
    changes.push('title');
  }
  
  // Check description
  if (after.description !== before.description) {
    changes.push('description');
  }
  
  // Check ingredients
  // Note: Using JSON.stringify for ordered array comparison as ingredient order matters
  if (JSON.stringify(after.ingredients) !== JSON.stringify(before.ingredients)) {
    const beforeCount = before.ingredients.length;
    const afterCount = after.ingredients.length;
    const added = afterCount - beforeCount;
    if (added > 0) {
      changes.push(`ingredients (+${added})`);
    } else if (added < 0) {
      changes.push(`ingredients (−${Math.abs(added)})`);
    } else {
      changes.push('ingredients');
    }
  }
  
  // Check instructions
  // Note: Using JSON.stringify for ordered array comparison as instruction order matters
  if (JSON.stringify(after.instructions) !== JSON.stringify(before.instructions)) {
    const beforeCount = before.instructions.length;
    const afterCount = after.instructions.length;
    const added = afterCount - beforeCount;
    if (added > 0) {
      changes.push(`steps (+${added})`);
    } else if (added < 0) {
      changes.push(`steps (−${Math.abs(added)})`);
    } else {
      changes.push('steps');
    }
  }
  
  // Check categories
  // Note: Using JSON.stringify for ordered array comparison
  if (JSON.stringify(after.categoryIds) !== JSON.stringify(before.categoryIds)) {
    changes.push('categories');
  }
  
  return changes.length > 0 
    ? `Edited: ${changes.join(', ')}`
    : 'Manually edited recipe';
}

/**
 * Creates a history entry object for a recipe update.
 * Creates a lean snapshot without the history field to avoid circular references.
 */
export function createHistoryEntry(
  before: Recipe,
  description: string,
  userName: string
): RecipeHistoryEntry {
  // Create lean snapshot without history
  const leanSnapshot = { ...before };
  delete (leanSnapshot as any).history;
  
  return {
    timestamp: new Date().toISOString(),
    userName,
    changeDescription: description,
    snapshot: leanSnapshot
  };
}

/**
 * Applies a category change (add or remove) to a recipe's category list.
 * Returns the updated category ID array.
 */
export function applyCategoryChange(
  recipe: Recipe,
  categoryId: string,
  action: 'add' | 'remove'
): string[] {
  const currentIds = recipe.categoryIds || [];
  
  if (action === 'add') {
    // Add only if not already present
    if (!currentIds.includes(categoryId)) {
      return [...currentIds, categoryId];
    }
    return currentIds;
  } else {
    // Remove
    return currentIds.filter(id => id !== categoryId);
  }
}

/**
 * Scales ingredient quantities based on servings change.
 * Extracts the first numeric value (int or decimal) from each ingredient
 * and scales it by the ratio of newServings to currentServings.
 * 
 * Examples:
 * - "500g beef" with 4→6 servings becomes "750g beef"
 * - "2 cups flour" with 2→4 servings becomes "4 cups flour"
 * - "1 onion, diced" with 1→2 servings becomes "2 onion, diced"
 */
export function scaleIngredients(
  ingredients: (string | any)[],
  currentServings: string,
  newServings: string
): (string | any)[] {
  // Parse servings numbers from strings like "4 servings" or just "4"
  const currentNum = parseFloat(currentServings);
  const newNum = parseFloat(newServings);
  
  if (isNaN(currentNum) || isNaN(newNum) || currentNum === 0) {
    return ingredients; // Can't scale if we can't parse the numbers
  }
  
  const scaleFactor = newNum / currentNum;
  
  return ingredients.map(ingredient => {
    // Handle new RecipeIngredient format
    if (typeof ingredient === 'object' && ingredient.quantity !== undefined) {
      return {
        ...ingredient,
        quantity: ingredient.quantity !== null ? ingredient.quantity * scaleFactor : null
      };
    }
    
    // Handle legacy string format
    if (typeof ingredient !== 'string') {
      return ingredient; // Unknown format, return as-is
    }
    
    // Match the first number (integer or decimal) in the ingredient string
    const match = ingredient.match(/^(\d+(?:\.\d+)?)/);
    
    if (!match) {
      return ingredient; // No number found, return as-is
    }
    
    const originalValue = parseFloat(match[1]);
    const scaledValue = originalValue * scaleFactor;
    
    // Round to reasonable precision (1 decimal place for most cases)
    const rounded = Math.round(scaledValue * 10) / 10;
    
    // Replace the original number with the scaled one
    return ingredient.replace(/^\d+(?:\.\d+)?/, rounded.toString());
  });
}
