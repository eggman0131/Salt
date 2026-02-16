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
    index.ts                    ← Public exports
  backend/
    [Future: shopping-api.ts]   ← Shopping-specific API wrapper
  hooks/
    [Future: useShoppingLists.ts, useListItems.ts]
  utils.ts                      ← Shopping-specific utilities
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

## Data Flow

```
User Action
    ↓
View Component (Mobile/Desktop)
    ↓
ShoppingListModule handlers
    ↓
shared/backend/api (saltBackend)
    ↓
Firebase/Simulation Backend
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
