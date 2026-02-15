# Shopping Items Rebuild Plan

## Executive Summary

This document outlines the complete rebuild of the shopping list system with correct semantic terminology. The current branch (`36-shopping-list-v2`) will be abandoned in favor of a fresh implementation that distinguishes between:
- **RecipeIngredients** (culinary context - what you cook with)
- **CanonicalItems** (retail context - what you buy, including non-food items)

## Semantic Architecture

### The Correct Model

```
┌─────────────────────────────────────────────────────────────┐
│ RECIPE DOMAIN (Culinary Language)                           │
│                                                              │
│  Recipe                                                      │
│    └── ingredients: RecipeIngredient[]                      │
│          ├── ingredientName: "red onion"                    │
│          ├── quantity: 2                                     │
│          ├── unit: "piece"                                   │
│          ├── preparation: "diced"                            │
│          └── canonicalItemId: "item-xyz"  ──────┐           │
└──────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    │ Links to
                                                    │
┌───────────────────────────────────────────────────┼──────────┐
│ SHOPPING DOMAIN (Retail Language)                │          │
│                                                   ▼          │
│  CanonicalItem (Universal Catalog)                          │
│    ├── id: "item-xyz"                                       │
│    ├── name: "Red Onion"                                    │
│    ├── normalisedName: "red onion"                          │
│    ├── aisle: "Produce"                                     │
│    ├── preferredUnit: "piece"                               │
│    ├── isStaple: false                                      │
│    ├── synonyms: ["spanish onion"]                          │
│    └── metadata: {}                                         │
│                                                              │
│  ShoppingListItem                                            │
│    ├── canonicalItemId: "item-xyz"                          │
│    ├── name: "Red Onion"         (snapshot)                │
│    ├── aisle: "Produce"           (snapshot at creation)   │
│    ├── quantity: 4                                          │
│    ├── unit: "piece"                                        │
│    ├── checked: false                                       │
│    ├── sourceRecipeIds: ["rec-1", "rec-2"]                 │
│    └── sourceRecipeIngredientIds: ["ring-1", "ring-2"]     │
└─────────────────────────────────────────────────────────────┘
```

### Why This Matters

**Problem**: The system needs to track both cooking ingredients AND household items (toilet paper, cleaning supplies, etc.)

**Solution**: 
1. **Recipes** use culinary terminology ("ingredients")
2. **Shopping/Database** uses retail terminology ("items")
3. They connect via `canonicalItemId` links

**Result**: 
- Semantically correct throughout
- Recipes stay in cooking language
- Shopping lists can include non-food items
- Database is the universal catalog

## What Was Built in Branch 36-shopping-list-v2

### Achievements (Logic to Preserve)

1. **Dynamic Units & Aisles**
   - Units and Aisles stored in database (not hardcoded)
   - Full CRUD operations
   - `sortOrder` field for custom ordering
   - Management UI with inline editing and reorder arrows
   - Integrated into Kitchen Data module

2. **Shopping List v2 Structure**
   - Multiple shopping lists support
   - Default list concept
   - Empty list creation (no recipe required)
   - Manual item addition with search
   - Item merging by canonical ID
   - Recipe ingredient → shopping item conversion

3. **Recipe Ingredient Processing**
   - Deterministic parsing: quantity, unit, name, preparation
   - Fuzzy matching to canonical database
   - AI resolution for unmatched ingredients
   - Unit conversion logic
   - Synonym support

4. **UI Patterns**
   - Simplified dropdown + add button design
   - Type-ahead search for existing items
   - Custom unit input alongside dropdown
   - Aisle-grouped item display
   - Inline note editing

### What Needs Renaming

| Current (Wrong) | Future (Correct) |
|----------------|------------------|
| `CanonicalIngredient` | `CanonicalItem` |
| `canonical_ingredients` (collection) | `canonical_items` |
| `getCanonicalIngredients()` | `getCanonicalItems()` |
| `createCanonicalIngredient()` | `createCanonicalItem()` |
| `updateCanonicalIngredient()` | `updateCanonicalItem()` |
| `deleteCanonicalIngredient()` | `deleteCanonicalItem()` |
| `IngredientsManagementModule` | `ItemsManagementModule` |
| `canonicalIngredientId` (in ShoppingListItem) | `canonicalItemId` |
| "Ingredients" tab in UI | "Items" tab |
| "Canonical Ingredients" heading | "Item Database" or "Shopping Items" |

### What STAYS as "Ingredient"

| Context | Type/Field | Reason |
|---------|-----------|--------|
| Recipe | `RecipeIngredient` | This IS an ingredient in cooking context |
| Recipe | `ingredients: RecipeIngredient[]` | Array of recipe ingredients |
| Recipe | `legacyIngredients: string[]` | Legacy format |
| Recipe | `stepIngredients: number[][]` | Which ingredients used in which steps |
| Recipe field | `ingredientName: string` | The name of the ingredient in the recipe |
| Backend | `processRecipeIngredients()` | Processing recipe ingredients |
| AI Prompts | "ingredient" references | Culinary context in prompts |
| UI | Recipe ingredient lists | Display context is cooking |

## Database Schema Changes

### New Types in types/contract.ts

```typescript
// ===== SHOPPING DOMAIN =====

// Unit Schema
// Special unit: '_item' means "count of the item itself" (e.g., 1 Onion, 2 Onions)
// When displaying, if unit === '_item', show: "{quantity} {itemName}" with pluralization
// Otherwise show: "{quantity} {unit} {itemName}"
export const UnitSchema = z.object({
  id: z.string(),
  name: z.string(), // e.g., 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', '_item'
  sortOrder: z.number().default(999),
  createdAt: z.string(),
});
export type Unit = z.infer<typeof UnitSchema>;

// Aisle Schema (unchanged)
export const AisleSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().default(999),
  createdAt: z.string(),
});
export type Aisle = z.infer<typeof AisleSchema>;

// NEW: CanonicalItem (was CanonicalIngredient)
export const CanonicalItemSchema = z.object({
  id: z.string(),
  name: z.string(), // e.g., "Onion" (singular form preferred)
  normalisedName: z.string(),
  isStaple: z.boolean().default(false),
  aisle: z.string(), // Dynamic aisle name
  preferredUnit: z.string(), // Dynamic unit name (can be '_item' for countable items)
  synonyms: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  createdBy: z.string().optional(),
});
export type CanonicalItem = z.infer<typeof CanonicalItemSchema>;

// ===== RECIPE DOMAIN =====

// RecipeIngredient (KEEP THIS NAME - it's correct)
export const RecipeIngredientSchema = z.object({
  id: z.string(),
  raw: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  ingredientName: z.string(), // KEEP: this is an ingredient name in cooking context
  preparation: z.string().optional(),
  canonicalItemId: z.string().optional(), // RENAMED: links to CanonicalItem
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

// Shopping List Item (updated)
export const ShoppingListItemSchema = z.object({
  id: z.string(),
  shoppingListId: z.string(),
  canonicalItemId: z.string(), // RENAMED from canonicalIngredientId
  name: z.string(),
  aisle: z.string(),
  quantity: z.number(),
  unit: z.string(),
  checked: z.boolean(),
  isStaple: z.boolean(),
  sourceRecipeIds: z.array(z.string()).optional(),
  sourceRecipeIngredientIds: z.array(z.string()).optional(), // KEEP: these are recipe ingredients
  note: z.string().optional(),
});
export type ShoppingListItem = z.infer<typeof ShoppingListItemSchema>;
```

### Firestore Collections

```
canonical_items/          (NEW - was canonical_ingredients)
  ├── item-{timestamp}-{random}
  │   ├── name: "Red Onion"  (singular form)
  │   ├── normalisedName: "red onion"
  │   ├── aisle: "Produce"
  │   ├── preferredUnit: "_item"  (means countable - displays as "1 Onion" / "2 Onions")
  │   ├── isStaple: false
  │   └── createdAt: "2026-02-15T..."

recipes/                  (UNCHANGED)
  ├── rec-{id}
  │   ├── ingredients: RecipeIngredient[]
  │   │   ├── ingredientName: "red onion"
  │   │   ├── canonicalItemId: "item-xyz"  ← Links to canonical_items
  │   │   └── ...
  │   └── legacyIngredients: string[] (if migrated)

shopping_lists/           (UNCHANGED)
shopping_list_items/      (Field renamed)
  ├── sli-{id}
  │   ├── canonicalItemId: "item-xyz"  ← RENAMED
  │   └── ...

units/                    (UNCHANGED)
aisles/                   (UNCHANGED)
```

## Implementation Plan - Step by Step

### Phase 0: Branch Setup (5 mins)

```bash
# From branch 36-shopping-list-v2
git checkout main
git pull origin main
git checkout -b 37-shopping-items

# Reference old branch but don't merge
git log 36-shopping-list-v2 --oneline  # See what was done
```

### Phase 1: Core Types & Schema (30 mins)

**File**: `types/contract.ts`

1. Add `CanonicalItemSchema` (copy from CanonicalIngredientSchema logic)
2. Update `RecipeIngredientSchema`: `canonicalIngredientId` → `canonicalItemId`
3. Update `ShoppingListItemSchema`: `canonicalIngredientId` → `canonicalItemId`
4. Update `ISaltBackend` interface:
   ```typescript
   // Add new methods
   getCanonicalItems: () => Promise<CanonicalItem[]>;
   getCanonicalItem: (id: string) => Promise<CanonicalItem | null>;
   createCanonicalItem: (item: Omit<CanonicalItem, 'id' | 'createdAt'>) => Promise<CanonicalItem>;
   updateCanonicalItem: (id: string, updates: Partial<CanonicalItem>) => Promise<CanonicalItem>;
   deleteCanonicalItem: (id: string) => Promise<void>;
   
   // Keep existing
   processRecipeIngredients: (ingredients: string[], recipeId: string) => Promise<RecipeIngredient[]>;
   ```

### Phase 2: Backend - Base Implementation (1-2 hours)

**File**: `backend/base-backend.ts`

1. **Add abstract methods** (at bottom):
   ```typescript
   abstract getCanonicalItems(): Promise<CanonicalItem[]>;
   abstract getCanonicalItem(id: string): Promise<CanonicalItem | null>;
   abstract createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem>;
   abstract updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem>;
   abstract deleteCanonicalItem(id: string): Promise<void>;
   ```

2. **Update `processRecipeIngredients()` method**:
   - Change internal variable names: `allCanonical` stays but refers to items
   - Update comments: "Match to canonical items"
   - Keep method name (it's processing recipe ingredients)
   - Update field: `canonicalIngredientId` → `canonicalItemId` in RecipeIngredient objects
   - Update: `await this.getCanonicalIngredients()` → `await this.getCanonicalItems()`
   - Update: `await this.createCanonicalIngredient()` → `await this.createCanonicalItem()`

3. **Update `generateShoppingList()` method**:
   - Update: `getCanonicalIngredients()` → `getCanonicalItems()`
   - Update field references in item creation

4. **Update AI prompt call** in `processRecipeIngredients()`:
   - Update `INGREDIENT_PROMPTS.resolveUnresolved()` - prompt text still says "ingredient" (culinary context is correct)
   - Update return value handling: `canonicalIngredientId` → `canonicalItemId`

### Phase 3: Backend - Firebase Implementation (1-2 hours)

**File**: `backend/firebase-backend.ts`

1. **Implement CanonicalItem CRUD** (copy from current branch's CanonicalIngredient):
   ```typescript
   async getCanonicalItems(): Promise<CanonicalItem[]> {
     const snapshot = await getDocs(collection(db, 'canonical_items'));
     // ... map to CanonicalItem[]
   }
   
   async getCanonicalItem(id: string): Promise<CanonicalItem | null> {
     const docRef = doc(db, 'canonical_items', id);
     // ...
   }
   
   async createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem> {
     const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
     // Use 'item-' prefix, not 'cing-'
   }
   
   async updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem> {
     const docRef = doc(db, 'canonical_items', id);
     // ...
   }
   
   async deleteCanonicalItem(id: string): Promise<void> {
     await deleteDoc(doc(db, 'canonical_items', id));
   }
   ```

2. **Update `addRecipeToShoppingList()`**:
   - Update: `getCanonicalIngredients()` → `getCanonicalItems()`
   - Update map: `canonicalMap` still works but now maps CanonicalItem
   - Update field: `ing.canonicalIngredientId` → `ing.canonicalItemId`

3. **Update `addManualItemToShoppingList()`**:
   - Update: `getCanonicalIngredients()` → `getCanonicalItems()`
   - Update: `createCanonicalIngredient()` → `createCanonicalItem()`
   - Update field: `canonicalIngredientId` → `canonicalItemId`

4. **Update `exportSystemState()`**:
   - Update `knownCollections` array: `'canonicalIngredients'` → `'canonicalItems'`
   
5. **Update `importSystemState()`**:
   - Handle both old and new formats for backward compatibility:
     ```typescript
     if (data.canonicalIngredients) {
       // Import as canonical_items (migration)
       for (const item of data.canonicalIngredients) {
         batch.set(doc(db, 'canonical_items', item.id), item);
       }
     }
     if (data.canonicalItems) {
       for (const item of data.canonicalItems) {
         batch.set(doc(db, 'canonical_items', item.id), item);
       }
     }
     ```

6. **Update `migrateAllRecipesToNewIngredientsFormat()`**:
   - Keep method name (it's migrating recipe ingredients)
   - Update: `canonicalIngredientId` → `canonicalItemId` in created RecipeIngredient objects

### Phase 4: Item Management UI (1-2 hours)

**File**: `components/ItemsManagementModule.tsx` (NEW - copy from IngredientsManagementModule.tsx)

1. **Rename everything**:
   - Component name: `ItemsManagementModule`
   - State: `ingredients` → `items`
   - Display text: "Canonical Ingredients" → "Item Database"
   - Methods: `loadIngredients()` → `loadItems()`

2. **Update backend calls**:
   - `saltBackend.getCanonicalIngredients()` → `saltBackend.getCanonicalItems()`
   - `saltBackend.createCanonicalIngredient()` → `saltBackend.createCanonicalItem()`
   - `saltBackend.updateCanonicalIngredient()` → `saltBackend.updateCanonicalItem()`
   - `saltBackend.deleteCanonicalIngredient()` → `saltBackend.deleteCanonicalItem()`

3. **Update imports**:
   ```typescript
   import { CanonicalItem } from '../types/contract';
   ```

4. **Keep aisle/unit loading logic** from current branch

### Phase 5: Shopping List Module (2-3 hours)

**File**: `components/ShoppingListModule.tsx`

1. **Update imports**:
   ```typescript
   import { ShoppingList, ShoppingListItem, CanonicalItem, Unit, Aisle } from '../types/contract';
   ```

2. **Update state**:
   ```typescript
   const [canonicalItems, setCanonicalItems] = useState<CanonicalItem[]>([]);
   ```

3. **Update methods**:
   - `loadCanonicalIngredients()` → `loadCanonicalItems()`
   - `handleAddExistingIngredient()` → `handleAddExistingItem()`
   - Update all backend calls to use `getCanonicalItems()`

4. **Update field references**:
   - All `canonicalIngredientId` → `canonicalItemId`

5. **Update UI text**:
   - Keep "Add Ingredient" when adding from recipe context
   - Use "Add Item" for manual addition
   - Search placeholder: "Search items..." or "Search ingredients..."

6. **Add smart unit display logic**:
   ```typescript
   // Helper function for displaying quantities
   const formatQuantityDisplay = (quantity: number, unit: string, itemName: string): string => {
     if (unit === '_item') {
       // Smart pluralization: 1 Onion, 2 Onions
       if (quantity === 1) {
         return `${quantity} ${itemName}`;
       } else {
         // Simple pluralization (add 's' or 'es')
         // For more complex cases, consider using a library like 'pluralize'
         const plural = itemName.endsWith('s') || itemName.endsWith('sh') || itemName.endsWith('ch') || itemName.endsWith('x') || itemName.endsWith('z')
           ? `${itemName}es`
           : `${itemName}s`;
         return `${quantity} ${plural}`;
       }
     } else {
       // Standard unit display: "500 g Flour"
       return `${quantity} ${unit} ${itemName}`;
     }
   };
   ```

7. **Update item display**:
   ```typescript
   <p className="text-sm text-gray-600 mt-1">
     {formatQuantityDisplay(item.quantity, item.unit, item.name)}
   </p>
   ```

8. **Copy dynamic units/aisles logic** from current branch

### Phase 6: App Integration (30 mins)

**File**: `App.tsx`

1. **Update import**:
   ```typescript
   import { ItemsManagementModule } from './components/ItemsManagementModule';
   ```

2. **Update tab**:
   ```typescript
   {activeTab === 'items' && (
     <ItemsManagementModule onRefresh={loadData} />
   )}
   ```

3. **Update navigation**:
   - Tab label: "Ingredients" → "Items" (or "Shopping Items")

### Phase 7: Recipe Components (1 hour)

**File**: `components/RecipeSections/RecipeIngredientsSection.tsx`

1. **Keep component focused on recipe context**
2. **Update field reference**: When displaying linked status:
   ```typescript
   {ingredient.canonicalItemId && (
     <span className="badge">Linked to Item Database</span>
   )}
   ```
3. **Keep all "ingredient" terminology in UI** (this is correct for recipes)

**File**: `components/RecipeDetail.tsx`

1. **Update any CanonicalIngredient references** to CanonicalItem
2. **Keep RecipeIngredient as-is** (correct)

### Phase 8: Admin Module (30 mins)

**File**: `components/AdminModule.tsx`

1. **Update section title**: "Ingredient Migration" → "Recipe Item Migration" or keep as-is (it's migrating recipe ingredients)
2. **Update any imports** if AdminModule references canonical types

### PUpdate unit guidance**:
   ```
   SPECIAL UNIT: '_item'
   - Use '_item' for countable items: onions, eggs, lemons, cans, bottles, rolls
   - This displays as "1 Onion" or "2 Onions" (smart pluralization)
   - Use metric units (g, kg, ml, l) for measurable quantities
   - Use tsp/tbsp for small measures
   ```
5. **hase 9: Tests (1-2 hours)

**File**: `tests/backend-logic.spec.ts`

1. **Update test descriptions** where referring to canonical database:
   - "Ingredient Processing" stays (correct context)
   - Add tests for Item CRUD operations

**File**: `tests/shopping-list.spec.ts`

1. **Update locators**:
   ```typescript
   const itemsLink = page.locator('text=Items').or(page.getByRole('button', { name: /items/i }));
   ```
2. **Update expectations**:
   ```typescript
   await expect(page.locator('text="Item Database"')).toBeVisible();
   ```

### Phase 10: AI Prompts (30 mins)

**File**: `backend/prompts.ts`

1. **Keep `INGREDIENT_PROMPTS` object name** (culinary context)
2. **Update comments** to mention "canonical item database"
3. **Update AI instructions** to clarify:
   ```
   You are matching recipe ingredients to the canonical ITEM database.
   Items include both ingredients (food) and household goods (cleaning, toiletries).
   ```
4. **Keep "ingredient" in actual prompts** (AI is working in culinary context)

### Phase 11: Documentation (30 mins)

**Files to Update**:
- `IMPLEMENTATION_SUMMARY.md` - Update terminology
- `docs/modules/shopping-list.md` (if exists) - Update architecture
- `README.md` - Update any feature descriptions
- `.github/copilot-instructions.md` - Update terminology guidance

## Testing Checklist

### Unit Operation Tests
- [ ] Create a CanonicalItem via ItemsManagementModule
- [ ] Edit item name, aisle, unit
- [ ] Delete an item
- [ ] Verify Firestore collection is `canonical_items`

### Recipe Integration Tests
- [ ] Import a recipe with ingredient strings
- [ ] Verify `processRecipeIngredients()` creates RecipeIngredient[]
- [ ] Verify RecipeIngredient has `canonicalItemId` link
- [ ] Verify new items created in `canonical_items` collection
- [ ] Display recipe - verify ingredients show correctly

### Shopping List Tests
- [ ] Create empty shopping list
- [ ] Add recipe to list - verify items created
- [ ] Add manual item (food)
- [ ] Add manual item (household - toilet paper)
- [ ] Verify items grouped by aisle
- [ ] Check/uncheck items
- [ ] Delete items

### Units & Aisles Tests
- [ ] Add custom unit
- [ ] Reorder units
- [ ] Add custom aisle
- [ ] Reorder aisles
- [ ] Verify items use database units/aisles

### Export/Import Tests
- [ ] Export system state
- [ ] Verify JSON has `canonicalItems` key
- [ ] Import into fresh database
- [ ] Verify all items restored

### Cross-Domain Tests
- [ ] Recipe ingredient → Shopping list item (verify link maintained)
- [ ] Edit item in database → verify shopping list reflects snapshot correctly
- [ ] Delete item from database → shopping lists preserve historical data

### Unit Display Tests
- [ ] Item with `_item` unit shows: "1 Onion" (singular)
- [ ] Item with `_item` unit shows: "2 Onions" (plural)
- [ ] Item with `_item` unit shows: "1 Toilet Paper" (singular)
- [ ] Item with `_item` unit shows: "3 Rolls of Toilet Paper" (if name is "Roll of Toilet Paper")
- [ ] Item with `g` unit shows: "500 g Flour"
- [ ] Item with `ml` unit shows: "250 ml Milk"
- [ ] Units dropdown includes `_item` option
- [ ] Creating item with `_item` displays correctly in shopping list

## Migration Strategy (If Needed)

### For Clean Slate (Recommended)
1. Drop existing dev data
2. Build fresh with correct terminology
3. Seed test data

### For Preserving Dev Data (If Required)

**Script**: `scripts/migrate-ingredients-to-items.ts`

```typescript
// Firestore migration script
// 1. Read all documents from canonical_ingredients
// 2. Write to canonical_items with same IDs
// 3. Update all recipes: canonicalIngredientId → canonicalItemId
// 4. Update all shopping_list_items: canonicalIngredientId → canonicalItemId
// 5. Delete canonical_ingredients collection (after backup)
```

**Run**:
```bash
npm run migrate:items
```

## Estimated Time

| Phase | Time | Notes |
|-------|------|-------|
| Phase 0: Branch setup | 5 min | |
| Phase 1: Types | 30 min | Careful with field names |
| Phase 2: Base backend | 1-2 hours | Copy logic, rename carefully |
| Phase 3: Firebase backend | 1-2 hours | Collection names, field names |
| Phase 4: Items UI | 1-2 hours | Port from branch 36 |
| Phase 5: Shopping module | 2-3 hours | Most complex UI |
| Phase 6: App integration | 30 min | |
| Phase 7: Recipe components | 1 hour | Verify correct context |
| Phase 8: Admin module | 30 min | |
| Phase 9: Tests | 1-2 hours | Update expectations |
| Phase 10: Prompts | 30 min | |
| Phase 11: Docs | 30 min | |
| **Total Dev Time** | **10-14 hours** | |
| **Testing & Refinement** | **3-5 hours** | User verification |
| **GRAND TOTAL** | **13-19 hours** | Clean, correct implementation |

## Key Principles
8. **Smart unit display** - The `_item` pseudo-unit enables natural quantity display:
   - `_item` unit never shown to user
   - Display: "1 Onion" not "1 piece Onion"
   - Display: "2 Onions" not "2 pieces Onion"
   - Other units shown normally: "500 g Flour", "1 l Milk"

1. **Recipe context uses "ingredient"** - This is correct culinary terminology
2. **Shopping/database uses "item"** - Includes non-food household goods
3. **The link is semantic** - RecipeIngredient.canonicalItemId connects the domains
4. **UI reflects context** - Recipe pages say "ingredients", shopping says "items"
5. **Database is universal** - CanonicalItem is the single source of truth
6. **No hardcoded data** - Units and aisles in database
7. **Preserve snapshots** - Shopping list items store aisle/name at creation time

## Success Criteria

- ✅ Can create/edit/delete items in database
- ✅ Items include both food and household goods
- ✅ Recipe ingredients link to items correctly
- ✅ Shopping lists generated from recipes
- ✅ Can manually add any item to shopping list
- ✅ Custom units and aisles work
- ✅ Export/import preserves all data
- ✅ UI language is semantically correct throughout
- ✅ No references to "CanonicalIngredient" in codebase
- ✅ Firestore collection is `canonical_items`

## Reference: Current Branch Files to Port

Copy logic (not code verbatim) from these files in `36-shopping-list-v2`:

- `components/IngredientsManagementModule.tsx` → `ItemsManagementModule.tsx`
- `components/UnitsAndAislesManagement.tsx` → Copy as-is
- `components/ShoppingListModule.tsx` → Update field names
- `backend/firebase-backend.ts` → Canonical CRUD methods

### The `_item` Pseudo-Unit

The special unit `_item` solves the awkward "piece" problem:

**Problem**: 
- "1 piece Onion" is unnatural
- "2 pieces Onion" is grammatically wrong

**Solution**:
- Store unit as `_item` in database
- Display logic checks: if `unit === '_item'`, show only quantity + name with pluralization
- Example displays:
  - 1 _item → "1 Onion"
  - 2 _item → "2 Onions"
  - 1 _item → "1 Can of Tomatoes"
  - 6 _item → "6 Cans of Tomatoes"

**Implementation**:
- `_item` is a real unit in the `units` collection
- It has `sortOrder: 0` to appear first in dropdowns
- UI never displays the literal text "_item"
- Frontend formatting function handles pluralization
- AI is instructed to use `_item` for countable items (onions, eggs, cans, bottles, etc.)

**Pluralization Strategy**:
```typescript
// Simple English pluralization rules
if (quantity === 1) {
  return itemName; // "Onion"
}
// Add 'es' for words ending in s, sh, ch, x, z
if (/[sxz]$|[cs]h$/.test(itemName)) {
  return itemName + 'es'; // "Box" → "Boxes"
}
// Default: add 's'
return itemName + 's'; // "Onion" → "Onions"
```

For complex cases (goose→geese, knife→knives), consider using the `pluralize` npm package or storing plural forms in item metadata.
- `backend/base-backend.ts` → processRecipeIngredients logic

## Notes

- The AI prompts can keep saying "ingredient" when working in recipe context - this is semantically correct
- The database layer should consistently use "item" terminology
- RecipeIngredient.ingredientName is correct (it's the ingredient name in the recipe)
- RecipeIngredient.canonicalItemId is the link to the universal catalog
- Shopping lists display "items" because they can contain non-food goods
- This two-tier model is cleaner than trying to rename everything to one term
