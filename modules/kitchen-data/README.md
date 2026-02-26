# Kitchen Data Module

**DEPRECATED:** This module is being phased out. All functionality has been migrated to domain-specific modules.

## Purpose

Kitchen Data is the **legacy module** being **phased out**. Items, units, and aisles have been migrated to the **Canon** module.

**Current State:** Orchestrator only. All domain logic migrated to Canon (units, aisles, items) and Categories (recipe taxonomy).

**Migration Status:**
- ✅ Phase 1-3: Units, Aisles, Items → **Canon** module
- ✅ Phase 4: Categories → **Categories** module
- ✅ Phase 5-7: Shopping/Recipes backend hooks implemented
- ✅ Phase 8-10: Navigation updated, module fully deprecated

For new features, use the **Canon** module (units, aisles, items) or **Categories** module (recipe categories).

## Architecture

```
modules/kitchen-data/
├── backend/
│   ├── kitchen-data-backend.interface.ts       (21 methods - DEPRECATED)
│   ├── base-kitchen-data-backend.ts            (AI categorization logic)
│   ├── firebase-kitchen-data-backend.ts        (Firestore persistence)
│   └── index.ts                                (Public backend API)
└── components/
  └── KitchenDataModule.tsx                   (Tab navigation - imports from Canon + Categories)
```

**Migration Notes:**
- Units, Aisles, Items components → `@/modules/canon` (Phase 3)
- CategoriesManagement component → `@/modules/categories` (Phase 4)
- KitchenDataModule now imports from both Canon and Categories modules

## Backend Interface

The `IKitchenDataBackend` interface provides 21 methods across 4 domains:

### Units (4 methods)
- `getUnits()` - Fetch all units, sorted by sortOrder
- `createUnit(unit)` - Create a new unit
- `updateUnit(id, updates)` - Update unit properties
- `deleteUnit(id)` - Remove a unit

### Aisles (4 methods)
- `getAisles()` - Fetch all aisles, sorted by sortOrder
- `createAisle(aisle)` - Create a new aisle
- `updateAisle(id, updates)` - Update aisle properties
- `deleteAisle(id)` - Remove an aisle

### Canonical Items (5 methods)
- `getCanonicalItems()` - Fetch all canonical items
- `getCanonicalItem(id)` - Fetch single item by ID
- `createCanonicalItem(item)` - Create new canonical item
- `updateCanonicalItem(id, updates)` - Update item properties
- `deleteCanonicalItem(id)` - Remove item (unlinks from recipes)

### Categories (8 methods) - **MIGRATED TO CATEGORIES MODULE**
- `getCategories()` - Fetch all categories
- `getCategory(id)` - Fetch single category by ID
- `createCategory(category)` - Create new category
- `updateCategory(id, updates)` - Update category properties
- `deleteCategory(id)` - Remove category (unlinks from recipes)
- `approveCategory(id)` - Approve a pending AI-suggested category
- `getPendingCategories()` - Fetch categories awaiting approval
- `categorizeRecipe(recipe)` - AI suggests categories for a recipe

## Migration Guide

### Using Categories (Phase 4)
**OLD:**
```typescript
import { kitchenDataBackend } from '@/modules/kitchen-data';
const categories = await kitchenDataBackend.getCategories();
```

**NEW:**
```typescript
import { categoriesBackend } from '@/modules/categories';
const categories = await categoriesBackend.getCategories();
```

## Usage

### DEPRECATED - Import the Backend

```typescript
import { kitchenDataBackend } from '@/modules/kitchen-data';

// DEPRECATED - Use canonBackend instead
import { canonBackend } from '@/modules/canon';
const units = await canonBackend.getUnits();

// DEPRECATED - Use canonBackend instead
const newItem = await canonBackend.createCanonicalItem({ ... });

// DEPRECATED - Use categoriesBackend instead
import { categoriesBackend } from '@/modules/categories';
const suggestions = await categoriesBackend.categorizeRecipe(myRecipe);
```

### Import Components

```typescript
import { KitchenDataModule } from '@/modules/kitchen-data';

<KitchenDataModule onRefresh={handleRefresh} />
```

## Dependencies

This module imports from:
- `types/contract.ts` - Zod schemas (The Law)
- `backend/firebase.ts` - Firebase config
- `backend/prompts.ts` - AI system instructions (The Soul)
- `components/UI.tsx` - Shared UI components

This module is imported by:
- `modules/shopping` - Uses units, aisles, canonical items for shopping lists
- `modules/recipes` - Uses categories and canonical items for recipe management
- `modules/planner` - Uses categories for meal planning filters
- `modules/inventory` - Uses canonical items and aisles for stock management

## Data Model

### Unit
```typescript
{
  id: string;
  name: string;              // "g", "ml", "whole"
  sortOrder: number;         // Display order
  createdAt: string;
}
```

### Aisle
```typescript
{
  id: string;
  name: string;              // "Produce", "Dairy", "Pantry"
  sortOrder: number;         // Shop walk order
  createdAt: string;
}
```

### CanonicalItem
```typescript
{
  id: string;
  name: string;              // "Tomatoes"
  defaultUnit: string;       // Reference to unit.name
  aisleId?: string;          // Where to find in shop
  synonyms?: string[];       // Alternative names
  isStaple?: boolean;        // Common pantry item
  createdAt: string;
}
```

### RecipeCategory
```typescript
{
  id: string;
  name: string;              // "Mains", "Desserts"
  description?: string;
  synonyms?: string[];
  createdBy: 'ai' | 'admin';
  isApproved: boolean;       // AI suggestions need approval
  createdAt: string;
}
```

## Component Features

### KitchenDataModule
- Tab-based navigation (Categories, Items, Units, Aisles)
- Pending category count badge
- Responsive design for mobile/desktop

### CategoryManagement
- Dual view: Review pending AI categories | Manage approved categories
- Approve/reject AI suggestions
- Manual category creation with synonyms
- Shows which recipes use each category

### ItemsManagement
- Full CRUD for canonical items
- Synonym management
- Unit and aisle assignment
- Shows recipe usage count before deletion

### UnitsManagement
- Metric units only (g, kg, ml, l, etc.)
- Sort order management
- Used count tracking

### AislesManagement
- Shop layout management
- Sort order for walking path
- Linked canonical items count

## Constitutional Compliance

This module strictly adheres to Salt's constitution:

1. **The Law** (`types/contract.ts`) - All data validated by Zod schemas
2. **The Soul** (`shared/backend/prompts.ts`) - AI uses Head Chef voice
3. **The Brain** (base-kitchen-data-backend.ts) - Domain logic and AI synthesis
4. **The Hands** (firebase-kitchen-data-backend.ts) - Persistence only

### British Terms & Metric Units
- All UI and AI outputs use British English
- Only metric units (no cups, ounces, Fahrenheit)
- Culinary terms: Hob, Whisk, Sauté Pan, etc.

### No Tech-Bleed
- No software jargon in UI labels
- The AI speaks as "Head Chef", not an assistant
- Terms: "Equipment", "Prep", "Service" (not "Database", "Array", "Syncing")

## Testing

To test kitchen-data functionality:

```bash
# Run dev server
npm run dev

# Navigate to Admin panel
# Select "Kitchen Data" tab
# Test CRUD operations for each domain

# Check TypeScript compilation
npm run build

# Run parity checks (when simulation backend is added)
npm run parity
```

## Migration History

This module was extracted from the monolithic backend on [date]:
- 6 components migrated from `components/`
- 21 backend methods extracted from the retired monolith backend and `modules/shopping/backend/`
- Units, Aisles, and Canonical Items were moved from shopping backend (architectural correction)
- Categories were extracted from monolithic backend
- AI categorization logic preserved in base backend

## Future Enhancements

Potential improvements:
- Simulation backend for offline development
- Bulk import/export for canonical items
- AI synonym suggestions
- Category hierarchy (subcategories)
- Item images/photos
- Nutritional data per canonical item
- Seasonal availability flags
- Preferred suppliers per item
