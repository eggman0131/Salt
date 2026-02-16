# Shopping Module

## Overview

The Shopping module handles shopping list creation, management, and item tracking. It provides separate mobile and desktop experiences optimized for their respective interaction patterns.

## Responsibilities

- **Shopping List CRUD** - Create, read, update, delete shopping lists
- **List Item Management** - Add, edit, remove, check/uncheck items
- **Mobile Experience** - Touch-optimized UI with swipe gestures
- **Desktop Experience** - Mouse/keyboard-optimized UI with hover states
- **Kitchen Data Integration** - Uses units and aisles from `kitchen-data` module (read-only)

## Architecture

```
modules/shopping/
  components/
    ShoppingListModule.tsx      ← Main orchestrator (state + API calls)
    MobileView.tsx              ← Mobile-optimized UI
    DesktopView.tsx             ← Desktop-optimized UI
    modals/
      ShoppingListModals.tsx    ← All modal dialogs
  backend/
    shopping-backend.interface.ts  ← IShoppingBackend interface (30 methods)
    base-shopping-backend.ts       ← AI-powered logic + abstract persistence
    firebase-shopping-backend.ts   ← Firebase Firestore implementation
    index.ts                       ← Public API (exports shoppingBackend)
  hooks/
    [Future: useShoppingLists.ts, useListItems.ts]
  utils.ts                      ← Shopping-specific utilities
  index.ts                      ← Public exports (ShoppingListModule + types)
  README.md                     ← This file
```

## Current State

**Status:** ✅ **Migrated to modules/shopping/**

The shopping module has been successfully extracted into the new modular architecture.

### Component Breakdown

#### `ShoppingListModule.tsx`
- Central state management
- All API calls to backend
- Screen size detection (mobile vs desktop)
- Delegates rendering to view components

#### `MobileView.tsx`
- Touch-optimized interactions
- Swipe-to-delete functionality
- Tap-to-edit item details
- Collapsible aisles
- Show/hide checked items toggle

#### `DesktopView.tsx`
- Mouse/keyboard interactions
- Edit buttons visible on hover
- Inline edit forms
- Bulk remove checked items action
- Delete list action

#### `ShoppingListModals.tsx`
- List selector modal
- New list creation modal
- Add item modal (with canonical item search)
- Delete list confirmation
- Delete item confirmation
- Remove checked items confirmation

#### `utils.ts`
- `ensureUnitExists()` - Create units if needed
- `ensureAisleExists()` - Create aisles if needed
- `groupItemsByAisle()` - Sort items by aisle
- `filterCanonicalItems()` - Search canonical items
- `calculateProgress()` - Compute completion percentage
- `validateItemData()` - Input validation

### Backend Architecture

The shopping module has its own backend implementation extracted from the monolithic Salt backend.

**Interface:** `IShoppingBackend` (30 methods)
- Canonical Items: CRUD operations (5 methods)
- Shopping Lists: CRUD + default list management (7 methods)
- Shopping List Items: CRUD operations (4 methods)
- Recipe Integration: AI-powered list generation (4 methods)
- Units & Aisles: CRUD operations (10 methods)

**Base Backend:** `BaseShoppingBackend`
- AI-Powered Features:
  - `processRecipeIngredients()`: Parse raw ingredients → structured data with canonical links
    - Fuzzy matching (85%+ similarity) against existing items
    - AI fallback for unmatched ingredients (batch resolution)
    - Auto-create missing units, aisles, canonical items
  - `resolveUnmatchedIngredients()`: Batch AI calls to resolve unknown items
  - `generateShoppingList()`: (placeholder) Convert recipes → consolidated list
- Helper Methods:
  - `parseIngredientString()`: Extract quantity, unit, name, preparation
  - `fuzzyMatch()`: Levenshtein distance for string similarity
  - `sanitizeJson()`: Extract JSON from AI responses

**Firebase Backend:** `FirebaseShoppingBackend`
- Firestore collections:
  - `canonical_items`: Universal item catalog (food + household)
  - `shopping_lists`: List metadata
  - `shopping_list_items`: Items in lists (with snapshot data)
  - `units`: Available units (g, kg, ml, l, items, etc.)
  - `aisles`: Store sections (Produce, Dairy, etc.)
- AI Transport: Uses Cloud Functions for authenticated Gemini API access
- Data Integrity:
  - Auto-creates missing units/aisles
  - Links shopping items to canonical catalog
  - Batch operations for list deletion (cascades to items)
  - Recipe deletion unlinks canonical items

**Public API:** `shoppingBackend` singleton
- Exported from `modules/shopping/backend/index.ts`
- Used by `ShoppingListModule.tsx` for all operations
- Configurable via `VITE_BACKEND_MODE` (firebase | simulation)

**Module Integration:**
```typescript
// In ShoppingListModule.tsx
import { shoppingBackend } from '../backend';

// Load lists
const lists = await shoppingBackend.getShoppingLists();

// Add item
const item = await shoppingBackend.addManualItemToShoppingList(
  listId, name, quantity, unit, aisle
);

// Process recipe ingredients (AI-powered)
const structured = await shoppingBackend.processRecipeIngredients(
  rawIngredients, recipeId
);
```

**Future Enhancements:**
- Simulation backend for offline development
- Custom hooks for shopping operations
- Optimistic updates with rollback
- Real-time sync via Firestore listeners

## Data Flow

```
User Action
    ↓
View Component (Mobile/Desktop)
    ↓
ShoppingListModule handlers
    ↓
modules/shopping/backend (shoppingBackend)
    ↓
FirebaseShoppingBackend / SimulationShoppingBackend
    ↓
Firebase Firestore / In-Memory Store
    ↓
State update in ShoppingListModule
    ↓
View re-renders
```

## Module Rules

### UI/UX Patterns

**Mobile:**
- Swipe left to reveal delete option
- Tap item name to edit
- Collapsible aisle groups
- Minimal chrome, focus on content
- Eye icon to show/hide checked items

**Desktop:**
- Edit/delete buttons appear on hover
- Full inline edit forms
- Toolbar with bulk actions
- Wider layout, more information density

**Both:**
- Checkbox toggles completion status
- Progress bar shows completion percentage
- Items grouped by aisle
- Aisles sorted by `sortOrder` from kitchen-data
- "Uncategorised" aisle always at bottom

### Data Integrity

- **Units must exist** before creating/editing items
- **Aisles must exist** for new canonical items
- Use `ensureUnitExists()` and `ensureAisleExists()` utilities
- Never bypass validation - all data goes through Zod schemas

### Dependencies

**Read-Only:**
- `kitchen-data` module for:
  - Units (g, kg, ml, l, items, etc.)
  - Aisles (Bakery, Frozen, etc.)
  - Canonical Items (known ingredients with preferred units/aisles)

**Writable:**
- Shopping lists (create, update, delete)
- Shopping list items (add, edit, remove, check/uncheck)
- Can create new canonical items if not found
- Can create new units/aisles if needed

### Integration Points

**Recipes Module** (future):
- Recipes can add their ingredients to shopping lists
- "Add to Shopping List" from recipe detail view

**Planner Module** (future):
- Planned meals can generate shopping lists
- Aggregate ingredients across multiple recipes

## Development Guidelines

### Adding New Features

1. Determine if it's mobile-only, desktop-only, or both
2. Add UI to appropriate view component
3. Add handler logic to `ShoppingListModule.tsx`
4. Create backend method if needed
5. Update this README with the new feature

### Modifying Existing Features

1. Check if it affects mobile, desktop, or both
2. Update view components as needed
3. Update handlers in `ShoppingListModule.tsx`
4. Test on both mobile and desktop
5. Verify data persistence with Firebase backend

### Testing

- Test both mobile and desktop views
- Test with empty lists, single items, many items
- Test swipe gestures on actual mobile device
- Test keyboard navigation on desktop
- Verify Firebase persistence (not just simulation)

## Common Patterns

### Adding a New Modal

1. Add modal state boolean to `ShoppingListModule.tsx`
2. Add modal to `ShoppingListModals.tsx`
3. Pass open/close handlers to view components
4. Add trigger buttons in mobile/desktop views

### Modifying Item Data

1. Always use handlers in `ShoppingListModule.tsx`
2. Call `saltBackend.updateShoppingListItem()`
3. Update local state immediately for optimistic UI
4. Handle errors gracefully

### Creating New Items

1. Check if canonical item exists (search by name)
2. Use existing item's preferred unit/aisle if found
3. For new items, ensure unit and aisle exist first
4. Call `saltBackend.addManualItemToShoppingList()`
5. Refresh canonical items list after creation

## Future Improvements

- [ ] Extract to `modules/shopping/` folder structure
- [ ] Create custom hooks (`useShoppingLists`, `useListItems`)
- [ ] Backend API wrapper (`shopping-api.ts`)
- [ ] Share shopping lists between users
- [ ] Recipe → Shopping list integration
- [ ] Planner → Shopping list integration
- [ ] Barcode scanning for items
- [ ] Estimated costs per list
- [ ] Shopping history analytics

## Questions?

If you're unsure about something in this module:
1. Check the code - it's the source of truth
2. Check `types/contract.ts` for data schemas
3. Check `shared/backend/` for API methods
4. Ask the human before making architectural changes
