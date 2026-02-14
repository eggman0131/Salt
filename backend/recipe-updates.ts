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
