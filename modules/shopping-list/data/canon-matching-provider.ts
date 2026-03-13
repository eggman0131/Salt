/**
 * Canon matching provider.
 *
 * Delegates to the canon module's full recipe ingredient pipeline, which
 * AI-parses the text (assigning aisle, unit, etc.), runs fuzzy + semantic
 * matching, creates a pending canon item if needed, and fires CofID
 * auto-linking. Never blocks — all errors are swallowed.
 */

import { processRawRecipeIngredients } from '../../canon/api';
import { linkItemToCanonItem } from './items-provider';

export async function tryMatchManualItem(
  listId: string,
  itemId: string,
  rawText: string
): Promise<void> {
  try {
    const results = await processRawRecipeIngredients([rawText]);
    const result = results[0];
    const canonicalItemId = result?.canonicalItemId;
    if (!canonicalItemId) return;

    await linkItemToCanonItem(listId, itemId, canonicalItemId, {
      name: result.ingredientName,
    });
  } catch {
    // Non-blocking — matching failures are silent
  }
}
