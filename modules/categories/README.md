# Categories
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for this module.

## Purpose

The categories module owns recipe categorisation data — meal types, cuisines, and other recipe groupings. It manages the full lifecycle of categories including creation, approval of AI-suggested categories, and deletion.

Categories management UI lives in the **Recipes module** — accessed via a "Categories" button in `RecipesList.tsx` that opens a Sheet containing `CategoriesManagement.tsx`.

## Ownership

This module owns:
- All data for the `categories` (or equivalent) Firestore collection.
- All business logic for categorisation, including uniqueness validation.
- The `CategoriesManagement.tsx` UI component (a full table view with search, filter, multiselect, bulk approve/delete).
- AI-powered recipe categorisation (`categorizeRecipe`).

This module does **not**:
- Write to any other module's data.
- Import any other module's internals.
- Expose an admin manifest entry — categories management is in the Recipes UI, not the admin dashboard.

## Folder Structure

    api.ts                          # Public API
    types.ts                        # Module-specific types
    logic/
      categorization.ts             # Pure logic: prompt building, parsing, validation
    data/
      firebase-provider.ts          # Firestore CRUD
      ai-provider.ts                # Cloud Function calls for AI categorisation
    ui/
      CategoriesManagement.tsx      # Full table view (search, filter, multiselect, bulk actions)
    __tests__/
      logic.test.ts                 # Pure logic tests

## Public API

### CRUD

```typescript
getCategories(): Promise<RecipeCategory[]>
getCategory(id: string): Promise<RecipeCategory | null>
createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory>
updateCategory(id: string, updates: Partial<RecipeCategory>): Promise<RecipeCategory>
deleteCategory(id: string): Promise<void>
```

### Approval Workflow

AI-suggested categories have `isApproved: false` and a `confidence` field. They must be approved before use.

```typescript
getPendingCategories(): Promise<RecipeCategory[]>
approveCategory(id: string): Promise<void>
```

### AI-Powered Categorisation

```typescript
categorizeRecipe(recipe: Recipe): Promise<string[]>
```

Analyses a recipe and returns a list of matching category IDs. Internally calls `buildCategorizationPrompt` (recipe-only prompt) and `buildCategorizationSystemInstruction` (categories list for AI context) — these are separate pure functions.

## Logic Rules

All business logic lives in `logic/categorization.ts`:

- `buildCategorizationPrompt(recipe)` — Constructs AI prompt from recipe data only (no category list).
- `buildCategorizationSystemInstruction(categories)` — Builds system instruction containing the category list for AI context.
- `parseAICategoryResponse(json)` — Safely parses AI response JSON.
- `validateCategoryNameUniqueness(name, existing)` — Checks for conflicts.

All functions are pure and deterministic.

## Types

- `RecipeCategory`, `Recipe` — from `types/contract.ts`.
- Module-specific internal types live in `types.ts`.

## Testing

```bash
npx vitest run modules/categories/__tests__/logic.test.ts
```

Pure functions only — no Firebase, no mocks, no network.

## Dependencies

- `types/contract.ts` — `RecipeCategory`, `Recipe`
- `shared/backend/firebase` — Firestore, Cloud Functions

## Architectural Source of Truth

All code in this module must follow the rules defined in `docs/salt-architecture.md`.
