/**
 * Shopping list module public API.
 *
 * Single entry point for all shopping list operations.
 * Consumers must only import from this file.
 */

// ── Lists ─────────────────────────────────────────────────────────────────────
export {
  getShoppingLists,
  getDefaultShoppingList,
  createShoppingList,
} from './data/lists-provider';

// ── Items ─────────────────────────────────────────────────────────────────────
export {
  getItemsForList,
  upsertCanonItem,
  createUnmatchedItem,
  removeRecipeContributions,
  updateItemChecked,
  updateItemStatus,
  updateItemNote,
  deleteItem,
  clearCheckedItems,
  linkItemToCanonItem,
} from './data/items-provider';

// ── Planner sync ──────────────────────────────────────────────────────────────
export {
  syncPlannerToList,
  addRecipeToList,
  removePlannerRecipeFromList,
} from './data/planner-sync-provider';

// ── Canon matching ────────────────────────────────────────────────────────────
export { tryMatchManualItem } from './data/canon-matching-provider';

// ── Types ─────────────────────────────────────────────────────────────────────
export type { ShoppingListContribution, SyncResult } from './types';
