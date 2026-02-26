# Categories Module

The **Categories** module manages recipe categorization and AI-powered category suggestions.

## Purpose

Categories provides recipe taxonomy for organizing and filtering recipes. It handles:

- Category CRUD operations (Breakfast, Dinner, Vegetarian, etc.)
- Pending category approval workflow
- AI-powered recipe categorization

## Architecture

```
modules/categories/
├── backend/
│   ├── categories-backend.interface.ts
│   ├── base-categories-backend.ts
│   ├── firebase-categories-backend.ts
│   └── index.ts
├── components/
│   └── CategoriesManagement.tsx
└── index.ts
```

## Usage

```typescript
import { categoriesBackend } from '@/modules/categories';

// Get all categories
const categories = await categoriesBackend.getCategories();

// AI-powered categorization
const suggestedCategories = await categoriesBackend.categorizeRecipe(recipe);

// Approve a pending category
await categoriesBackend.approveCategory(categoryId);
```

## Status

✅ **Phase 4 Complete**: Categories module extracted from kitchen-data

## Integration Points

- **Recipes Module**: Uses `categorizeRecipe()` for AI-powered suggestions
- **Kitchen-Data Module**: Legacy module being deprecated (categories migrated)

## Notes

- Categories are recipe-specific (separate from item domain)
- Pending categories require approval before use
- AI categorization analyzes title, description, and ingredients
