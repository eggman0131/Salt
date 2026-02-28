/**
 * Admin Backend - Public API
 */

export { cleanupOrphanedRecipeImages } from './admin-backend';
export type { CleanupStats } from './admin-backend';

// Firestore Browser
export {
  listCollections,
  getCollectionInfo,
  getCollectionDocuments,
  getDocument,
  exportCollectionAsJson,
  downloadCollectionJson,
  exportCofidBackup,
  importCofidBackup,
} from './admin-backend';
export type { FirestoreCollection, FirestoreDocument, CofidBackupData, CofidBackupDocument } from './admin-backend';
