/**
 * Categories Module Admin Manifest
 * 
 * Exposes admin tools for managing categories.
 * Admin module loads and mounts these dynamically.
 */

export const categoryAdminTools = [
  {
    id: 'categories.management',
    label: 'Manage Categories',
    description: 'CRUD operations, approval workflow, and category configuration',
    component: () => import('../ui/CategoriesManagement').then(m => ({ default: m.CategoriesManagement })),
  },
];
