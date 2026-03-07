import type { Recipe, RecipeHistoryEntry } from '@/types/contract';

/**
 * Builds a human-readable summary of manual edits made to a recipe.
 */
export function buildManualEditSummary(before: Recipe, after: Recipe): string {
  const changes: string[] = [];

  if (after.title !== before.title) {
    changes.push('title');
  }

  if (after.description !== before.description) {
    changes.push('description');
  }

  // Ordered array comparison is intentional because sequence matters.
  if (JSON.stringify(after.ingredients) !== JSON.stringify(before.ingredients)) {
    const beforeCount = before.ingredients.length;
    const afterCount = after.ingredients.length;
    const added = afterCount - beforeCount;
    if (added > 0) {
      changes.push(`ingredients (+${added})`);
    } else if (added < 0) {
      changes.push(`ingredients (-${Math.abs(added)})`);
    } else {
      changes.push('ingredients');
    }
  }

  if (JSON.stringify(after.instructions) !== JSON.stringify(before.instructions)) {
    const beforeCount = before.instructions.length;
    const afterCount = after.instructions.length;
    const added = afterCount - beforeCount;
    if (added > 0) {
      changes.push(`steps (+${added})`);
    } else if (added < 0) {
      changes.push(`steps (-${Math.abs(added)})`);
    } else {
      changes.push('steps');
    }
  }

  if (JSON.stringify(after.categoryIds) !== JSON.stringify(before.categoryIds)) {
    changes.push('categories');
  }

  return changes.length > 0
    ? `Edited: ${changes.join(', ')}`
    : 'Manually edited recipe';
}

/**
 * Creates a history entry with a lean snapshot.
 */
export function createHistoryEntry(
  before: Recipe,
  description: string,
  userName: string
): RecipeHistoryEntry {
  const leanSnapshot = { ...before };
  delete (leanSnapshot as { history?: RecipeHistoryEntry[] }).history;

  return {
    timestamp: new Date().toISOString(),
    userName,
    changeDescription: description,
    snapshot: leanSnapshot,
  };
}
