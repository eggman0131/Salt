/**
 * Recipe image storage cleanup.
 *
 * Identifies and removes orphaned recipe images — files in Firebase Storage
 * that are no longer referenced by any recipe document.
 */

import { db, storage } from '../../../shared/backend/firebase';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { collection, getDocs } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import type { Recipe } from '../../../types/contract';

export interface CleanupStats {
  totalFiles: number;
  orphanedFiles: string[];
  referencedFiles: string[];
  deletedCount: number;
  errors: string[];
}

/**
 * Identify and optionally remove orphaned recipe images.
 *
 * @param dryRun - If true, only identifies orphans without deleting them.
 */
export async function cleanupOrphanedRecipeImages(dryRun = true): Promise<CleanupStats> {
  const stats: CleanupStats = {
    totalFiles: 0,
    orphanedFiles: [],
    referencedFiles: [],
    deletedCount: 0,
    errors: [],
  };

  try {
    debugLogger.info('Recipes/StorageCleanup', `Starting cleanup (dryRun: ${dryRun})`);

    const recipesFolderRef = ref(storage, 'recipes');
    const listResult = await listAll(recipesFolderRef);

    const allFiles: ReturnType<typeof ref>[] = [...listResult.items];
    for (const prefixRef of listResult.prefixes) {
      const sub = await listAll(prefixRef);
      allFiles.push(...sub.items);
    }

    stats.totalFiles = allFiles.length;

    if (stats.totalFiles === 0) return stats;

    const recipesSnapshot = await getDocs(collection(db, 'recipes'));
    const referencedPaths = new Set<string>();
    recipesSnapshot.forEach(doc => {
      const recipe = doc.data() as Recipe;
      if (recipe.imagePath) referencedPaths.add(recipe.imagePath);
    });

    for (const fileRef of allFiles) {
      const filePath = fileRef.fullPath;
      if (referencedPaths.has(filePath)) {
        stats.referencedFiles.push(filePath);
      } else {
        stats.orphanedFiles.push(filePath);
        if (!dryRun) {
          try {
            await deleteObject(fileRef);
            stats.deletedCount++;
          } catch (error) {
            stats.errors.push(`Failed to delete ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    debugLogger.info('Recipes/StorageCleanup', `Done — ${stats.orphanedFiles.length} orphaned, ${stats.referencedFiles.length} in use`);
    return stats;
  } catch (error) {
    stats.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    return stats;
  }
}
