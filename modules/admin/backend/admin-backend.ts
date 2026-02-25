/**
 * Admin Backend
 * 
 * System administration functions including storage cleanup.
 */

import { db, storage } from '../../../shared/backend/firebase';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { collection, getDocs } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { Recipe } from '../../../types/contract';

export interface CleanupStats {
  totalFiles: number;
  orphanedFiles: string[];
  referencedFiles: string[];
  deletedCount: number;
  errors: string[];
}

/**
 * Identify and remove orphaned recipe images in Firebase Storage.
 * 
 * Orphaned files are image files that are no longer referenced by any recipe document.
 * This happens when:
 * - A recipe is deleted (image file remains)
 * - A new image is uploaded to replace an old one (old image remains)
 * 
 * @param dryRun - If true, only identify orphaned files without deleting them
 * @returns Cleanup statistics including list of deleted files and any errors
 */
export async function cleanupOrphanedRecipeImages(dryRun: boolean = true): Promise<CleanupStats> {
  const stats: CleanupStats = {
    totalFiles: 0,
    orphanedFiles: [],
    referencedFiles: [],
    deletedCount: 0,
    errors: [],
  };

  try {
    debugLogger.info('Admin', `Starting recipe image cleanup (dryRun: ${dryRun})`);

    // Get all files in recipes folder (recursively through subdirectories)
    const recipesFolderRef = ref(storage, 'recipes');
    const listResult = await listAll(recipesFolderRef);
    
    // Collect all files from recipe subdirectories
    const allFiles: any[] = [...listResult.items];
    
    // Recursively list files in all prefixes (subdirectories)
    for (const prefixRef of listResult.prefixes) {
      const subFolderResult = await listAll(prefixRef);
      allFiles.push(...subFolderResult.items);
      debugLogger.info('Admin', `Listed files in ${prefixRef.name}: ${subFolderResult.items.length} files`);
    }
    
    stats.totalFiles = allFiles.length;
    debugLogger.info('Admin', `Found ${stats.totalFiles} files across ${listResult.prefixes.length} recipe folders`);

    if (stats.totalFiles === 0) {
      debugLogger.info('Admin', 'No files to clean up');
      return stats;
    }

    // Get all recipes from Firestore
    const recipesSnapshot = await getDocs(collection(db, 'recipes'));
    const referencedPaths = new Set<string>();

    recipesSnapshot.forEach((doc) => {
      const recipe = doc.data() as Recipe;
      if (recipe.imagePath) {
        referencedPaths.add(recipe.imagePath);
      }
    });

    debugLogger.info('Admin', `Found ${referencedPaths.size} recipes with images`);

    // Identify orphaned files
    for (const fileRef of allFiles) {
      const filePath = fileRef.fullPath;
      
      if (referencedPaths.has(filePath)) {
        stats.referencedFiles.push(filePath);
      } else {
        stats.orphanedFiles.push(filePath);
        
        // Delete orphaned file
        if (!dryRun) {
          try {
            await deleteObject(fileRef);
            stats.deletedCount++;
            debugLogger.info('Admin', `Deleted orphaned file: ${filePath}`);
          } catch (error) {
            const errorMsg = `Failed to delete ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
            stats.errors.push(errorMsg);
            debugLogger.error('Admin', errorMsg);
          }
        }
      }
    }

    const actionText = dryRun ? 'identified' : 'deleted';
    debugLogger.info(
      'Admin',
      `Cleanup complete: ${stats.orphanedFiles.length} orphaned files ${actionText}, ` +
      `${stats.referencedFiles.length} referenced files kept`
    );

    return stats;
  } catch (error) {
    const errorMsg = `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
    stats.errors.push(errorMsg);
    debugLogger.error('Admin', errorMsg);
    return stats;
  }
}
