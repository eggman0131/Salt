/**
 * Canon Module — Admin Manifest
 *
 * Declares the admin tools exposed by this module.
 * The admin module loads and mounts these entries dynamically.
 * No admin module is assumed to exist yet — this is ready for future mounting.
 */

export const canonAdminTools = [
  {
    id: 'canon.seeder',
    label: 'Canon Seeder',
    description: 'Seed canon aisles and units from JSON files into Firestore.',
    component: () =>
      import('./ui/admin/CanonSeeder').then(m => ({ default: m.default })),
  },
  {
    id: 'canon.aiParseTool',
    label: 'AI Ingredient Parser',
    description: 'Parse ingredient lines using AI and validate against canonical data.',
    component: () =>
      import('./ui/admin/AiIngredientParseTool').then(m => ({ default: m.default })),
  },
  {
    id: 'canon.cofid-mappings',
    label: 'CofID Aisle Mappings',
    description: 'Manage CofID group → aisle mappings with full CRUD and validation reporting.',
    component: () =>
      import('./ui/admin/CofidMappingsAdmin').then(m => ({ default: m.CofidMappingsAdmin })),
  },
  {
    id: 'canon.embedding-coverage',
    label: 'Embedding Coverage',
    description: 'Manage semantic matching embeddings for CofID and canon items.',
    component: () =>
      import('./ui/admin/EmbeddingCoverageDashboard').then(m => ({ default: m.EmbeddingCoverageDashboard })),
  },
  {
    id: 'canon.matching-performance',
    label: 'Matching Performance',
    description: 'CofID matching pipeline analytics, event monitoring, and performance metrics.',
    component: () =>
      import('./ui/admin/MatchingPerformanceAdmin').then(m => ({ default: m.MatchingPerformanceAdmin })),
  },
  {
    id: 'canon.embedding-sync',
    label: 'Embedding Sync Utility',
    description: 'Reconcile local IndexedDB embeddings with Firestore Canon Items and publish to Master.',
    component: () =>
      import('./ui/admin/EmbeddingSyncUtility').then(m => ({ default: m.EmbeddingSyncUtility })),
  },
];
