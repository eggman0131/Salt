/**
 * Admin Module Public API
 * 
 * Exports admin components and backend functions
 */

export { AdminModule } from './components/AdminModule';
export { FirestoreBrowser } from './components/FirestoreBrowser';
export {
  cleanupOrphanedRecipeImages,
  listCollections,
  getCollectionInfo,
  getCollectionDocuments,
  getDocument,
  exportCollectionAsJson,
  downloadCollectionJson,
  exportCofidBackup,
  importCofidBackup,
} from './backend';
export type { CleanupStats, FirestoreCollection, FirestoreDocument, CofidBackupData, CofidBackupDocument } from './backend';
