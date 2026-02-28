/**
 * Admin Backend
 * 
 * System administration functions including storage cleanup.
 */

import { db, storage } from '../../../shared/backend/firebase';
import { debugLogger } from '../../../shared/backend/debug-logger';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { Recipe, COLLECTION_REGISTRY } from '../../../types/contract';

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

/**
 * Firestore Browser - Query and export collections and documents
 */
export interface FirestoreCollection {
  name: string;
  docCount: number;
}

export interface FirestoreDocument {
  id: string;
  data: Record<string, any>;
}

/**
 * Get all collection names in the current Firestore database
 * @returns Array of collection names from the registry
 */
export async function listCollections(): Promise<string[]> {
  try {
    // Use COLLECTION_REGISTRY which is the source of truth for all collections
    const collectionNames = Object.keys(COLLECTION_REGISTRY);
    return collectionNames.sort();
  } catch (error) {
    const errorMsg = `Failed to list collections: ${error instanceof Error ? error.message : String(error)}`;
    debugLogger.error('Admin', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get information about a specific collection
 * @param collectionName - Name of the collection
 * @returns Collection info with document count
 */
export async function getCollectionInfo(collectionName: string): Promise<FirestoreCollection> {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return {
      name: collectionName,
      docCount: snapshot.size,
    };
  } catch (error) {
    const errorMsg = `Failed to get collection info: ${error instanceof Error ? error.message : String(error)}`;
    debugLogger.error('Admin', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get all documents from a collection
 * @param collectionName - Name of the collection
 * @returns Array of documents with IDs and data
 */
export async function getCollectionDocuments(collectionName: string): Promise<FirestoreDocument[]> {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
  } catch (error) {
    const errorMsg = `Failed to get documents: ${error instanceof Error ? error.message : String(error)}`;
    debugLogger.error('Admin', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get a specific document from a collection
 * @param collectionName - Name of the collection
 * @param docId - Document ID
 * @returns Document with ID and data
 */
export async function getDocument(collectionName: string, docId: string): Promise<FirestoreDocument | null> {
  try {
    const docSnap = await getDocs(collection(db, collectionName));
    const doc = docSnap.docs.find(d => d.id === docId);
    
    if (!doc) return null;
    
    return {
      id: doc.id,
      data: doc.data(),
    };
  } catch (error) {
    const errorMsg = `Failed to get document: ${error instanceof Error ? error.message : String(error)}`;
    debugLogger.error('Admin', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Export a collection as JSON
 * @param collectionName - Name of the collection
 * @returns JSON string representation of the collection
 */
export async function exportCollectionAsJson(collectionName: string): Promise<string> {
  try {
    const documents = await getCollectionDocuments(collectionName);
    const exportData = {
      collection: collectionName,
      timestamp: new Date().toISOString(),
      docCount: documents.length,
      documents: documents,
    };
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    const errorMsg = `Failed to export collection: ${error instanceof Error ? error.message : String(error)}`;
    debugLogger.error('Admin', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Download collection as JSON file
 * @param collectionName - Name of the collection
 * @param documents - Documents to download
 */
export function downloadCollectionJson(collectionName: string, jsonData: string): void {
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${collectionName}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface CofidBackupDocument {
  id: string;
  data: Record<string, any>;
}

export interface CofidBackupData {
  backupType: 'cofid';
  version: 1;
  exportedAt: string;
  itemCount: number;
  documents: CofidBackupDocument[];
}

/**
 * Export CoFID data only, separate from main backup/export flow.
 */
export async function exportCofidBackup(): Promise<CofidBackupData> {
  try {
    const snapshot = await getDocs(collection(db, 'cofid'));
    const documents = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data(),
    }));

    return {
      backupType: 'cofid',
      version: 1,
      exportedAt: new Date().toISOString(),
      itemCount: documents.length,
      documents,
    };
  } catch (error) {
    const errorMsg = `Failed to export CoFID backup: ${error instanceof Error ? error.message : String(error)}`;
    debugLogger.error('Admin', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Import CoFID backup data only, replacing the cofid collection.
 */
export async function importCofidBackup(payload: CofidBackupData): Promise<{ itemsImported: number }> {
  if (payload.backupType !== 'cofid') {
    throw new Error('Invalid CoFID backup file');
  }

  if (!Array.isArray(payload.documents)) {
    throw new Error('Invalid CoFID backup documents');
  }

  try {
    const existingSnapshot = await getDocs(collection(db, 'cofid'));

    let deleteBatch = writeBatch(db);
    let deleteCount = 0;

    for (const docSnap of existingSnapshot.docs) {
      deleteBatch.delete(doc(db, 'cofid', docSnap.id));
      deleteCount += 1;

      if (deleteCount >= 450) {
        await deleteBatch.commit();
        deleteBatch = writeBatch(db);
        deleteCount = 0;
      }
    }

    if (deleteCount > 0) {
      await deleteBatch.commit();
    }

    let importBatch = writeBatch(db);
    let importCount = 0;
    let imported = 0;

    for (const row of payload.documents) {
      if (!row?.id || typeof row.id !== 'string' || !row.data || typeof row.data !== 'object') {
        continue;
      }

      importBatch.set(doc(db, 'cofid', row.id), row.data);
      importCount += 1;
      imported += 1;

      if (importCount >= 450) {
        await importBatch.commit();
        importBatch = writeBatch(db);
        importCount = 0;
      }
    }

    if (importCount > 0) {
      await importBatch.commit();
    }

    return { itemsImported: imported };
  } catch (error) {
    const errorMsg = `Failed to import CoFID backup: ${error instanceof Error ? error.message : String(error)}`;
    debugLogger.error('Admin', errorMsg);
    throw new Error(errorMsg);
  }
}
