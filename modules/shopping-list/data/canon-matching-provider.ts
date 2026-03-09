/**
 * Canon matching provider.
 *
 * Async, non-blocking canon match for manual shopping list entries.
 * If a match is found, upgrades the item to a canon-linked entry.
 * If no match, leaves the item as unmatched — no error thrown.
 */

import { getCanonItems, getCanonItemById, getCanonAisles, matchIngredientToCanonItem } from '../../canon/api';
import { linkItemToCanonItem } from './items-provider';

/**
 * Attempt to match a manual item to a canonical item.
 * Runs after item creation — never blocks the add flow.
 *
 * @param listId - the shopping list the item belongs to
 * @param itemId - the unmatched item's Firestore doc ID
 * @param rawText - the user's original input text
 */
export async function tryMatchManualItem(
  listId: string,
  itemId: string,
  rawText: string
): Promise<void> {
  try {
    const canonItems = await getCanonItems();
    const result = matchIngredientToCanonItem(rawText, canonItems);

    if (result.decision !== 'use_existing_canon' || !result.canonItemId) {
      return; // No confident match — leave as unmatched
    }

    const canonItem = await getCanonItemById(result.canonItemId);
    if (!canonItem) return;

    const aisles = await getCanonAisles();
    const aisleName = aisles.find((a) => a.id === canonItem.aisleId)?.name;

    await linkItemToCanonItem(listId, itemId, canonItem.id, {
      name: canonItem.name,
      aisle: aisleName,
    });
  } catch {
    // Non-blocking — matching failures are silent
  }
}
