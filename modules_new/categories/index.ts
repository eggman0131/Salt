/**
 * Categories Module - Public Exports
 * 
 * Only api.ts functions and types are exported.
 * Internal logic, data, and ui imports are private.
 */

export { 
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getPendingCategories,
  approveCategory,
  categorizeRecipe,
  categoriesApi
} from './api';

export { CategoriesManagement } from './ui/CategoriesManagement';
