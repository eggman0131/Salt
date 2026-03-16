/**
 * Planner sync provider.
 *
 * Reads the current week's plan via the planner api,
 * fetches recipe ingredients via the recipes api,
 * and writes/updates shoppingListItems.
 *
 * Staple items (CanonicalItem.isStaple) land in status: 'needs_review'.
 * Idempotent: re-running sync updates existing items, does not duplicate.
 */

import { auth } from '../../../shared/backend/firebase';
import { getPlanByDate } from '../../planner/api';
import { getRecipe } from '../../recipes/api';
import { getCanonItemById } from '../../canon/api';
import {
  upsertCanonItem,
  createUnmatchedItem,
  removeRecipeContributions,
  getItemsForList,
} from './items-provider';
import type { ShoppingListContribution, SyncResult } from '../types';

/**
 * Sync all recipes from a week's plan into the shopping list.
 *
 * @param weekStartDate - YYYY-MM-DD Friday start date of the week
 * @param listId - target shopping list ID
 */
export async function syncPlannerToList(
  weekStartDate: string,
  listId: string
): Promise<SyncResult> {
  const userId = auth.currentUser?.uid ?? 'system';
  const result: SyncResult = { added: 0, updated: 0, needsReview: 0, skipped: 0 };

  // Load the plan
  const plan = await getPlanByDate(weekStartDate);
  if (!plan) {
    return result;
  }

  // Collect all unique recipeIds from the week
  const allRecipeIds = plan.days.flatMap((d) => d.recipeIds ?? []);
  const uniqueRecipeIds = [...new Set(allRecipeIds)];

  if (uniqueRecipeIds.length === 0) {
    return result;
  }

  // Determine which recipes are already on the list (by checking existing contributions)
  const existingItems = await getItemsForList(listId);
  const existingRecipeIds = new Set(
    existingItems.flatMap((item) =>
      item.contributions
        .filter((c) => c.sourceType === 'recipe' && c.recipeId)
        .map((c) => c.recipeId!)
    )
  );

  for (const recipeId of uniqueRecipeIds) {
    // If already synced, skip (idempotent)
    if (existingRecipeIds.has(recipeId)) {
      result.skipped++;
      continue;
    }

    const recipe = await getRecipe(recipeId);
    if (!recipe) continue;

    for (const ingredient of recipe.ingredients) {
      const contribution: ShoppingListContribution = {
        sourceType: 'recipe',
        recipeId,
        recipeTitle: recipe.title,
        rawText: ingredient.raw,
        ...(ingredient.quantity != null && { qty: ingredient.quantity }),
        ...(ingredient.unit != null && { unit: ingredient.unit }),
        addedBy: userId,
        addedAt: new Date().toISOString(),
      };

      if (ingredient.canonicalItemId) {
        // Fetch canon item metadata
        const canonItem = await getCanonItemById(ingredient.canonicalItemId);
        if (canonItem) {
          await upsertCanonItem(
            listId,
            ingredient.canonicalItemId,
            contribution,
            { name: canonItem.name, aisle: canonItem.aisle.tier1 },
            canonItem.isStaple ?? false
          );
          if (canonItem.isStaple) {
            result.needsReview++;
          } else {
            result.added++;
          }
        } else {
          // Canon item not found — treat as unmatched
          await createUnmatchedItem(listId, contribution, ingredient.ingredientName);
          result.added++;
        }
      } else {
        // No canonical match — discrete unmatched item
        await createUnmatchedItem(listId, contribution, ingredient.ingredientName);
        result.added++;
      }
    }

    result.updated++;
  }

  return result;
}

/**
 * Add a single recipe's ingredients to a shopping list.
 * Used from the recipe detail view or direct recipe add.
 * Idempotent: if the recipe is already on the list, it skips.
 */
export async function addRecipeToList(
  recipeId: string,
  listId: string
): Promise<SyncResult> {
  const userId = auth.currentUser?.uid ?? 'system';
  const result: SyncResult = { added: 0, updated: 0, needsReview: 0, skipped: 0 };

  const existingItems = await getItemsForList(listId);
  const existingRecipeIds = new Set(
    existingItems.flatMap((item) =>
      item.contributions
        .filter((c) => c.sourceType === 'recipe' && c.recipeId)
        .map((c) => c.recipeId!)
    )
  );

  if (existingRecipeIds.has(recipeId)) {
    result.skipped++;
    return result;
  }

  const recipe = await getRecipe(recipeId);
  if (!recipe) return result;

  for (const ingredient of recipe.ingredients) {
    const contribution: ShoppingListContribution = {
      sourceType: 'recipe',
      recipeId,
      recipeTitle: recipe.title,
      rawText: ingredient.raw,
      qty: ingredient.quantity ?? undefined,
      unit: ingredient.unit ?? undefined,
      addedBy: userId,
      addedAt: new Date().toISOString(),
    };

    if (ingredient.canonicalItemId) {
      const canonItem = await getCanonItemById(ingredient.canonicalItemId);
      if (canonItem) {
        await upsertCanonItem(listId, ingredient.canonicalItemId, contribution, { name: canonItem.name, aisle: canonItem.aisle.tier1 }, canonItem.isStaple ?? false);
        canonItem.isStaple ? result.needsReview++ : result.added++;
      } else {
        await createUnmatchedItem(listId, contribution, ingredient.ingredientName);
        result.added++;
      }
    } else {
      await createUnmatchedItem(listId, contribution, ingredient.ingredientName);
      result.added++;
    }
  }

  result.updated++;
  return result;
}

/**
 * Remove a specific recipe's contributions from the list.
 * Used when a recipe is removed from the planner.
 */
export async function removePlannerRecipeFromList(
  listId: string,
  recipeId: string
): Promise<void> {
  await removeRecipeContributions(listId, recipeId);
}
