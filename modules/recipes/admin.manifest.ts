/**
 * Recipes Module — Admin Manifest
 */

export const recipesAdminTools = [
  {
    id: 'recipes.storage-cleanup',
    label: 'Storage Cleanup',
    description: 'Find and delete orphaned recipe images from Firebase Storage',
    component: () => import('./ui/RecipeStorageAdmin').then(m => ({ default: m.RecipeStorageAdmin })),
  },
];
