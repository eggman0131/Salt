/**
 * Shopping list module-specific types.
 *
 * ShoppingListContribution is internal to this module.
 * ShoppingList and ShoppingListItem are shared contract types in types/contract.ts.
 */

export interface ShoppingListContribution {
  sourceType: 'recipe' | 'manual';
  recipeId?: string;
  recipeTitle?: string;
  rawText: string;         // original ingredient string, always preserved
  qty?: number;
  unit?: string;
  addedBy: string;
  addedAt: string;         // ISO timestamp
}

export interface SyncResult {
  added: number;
  updated: number;
  needsReview: number;
  skipped: number;
}
