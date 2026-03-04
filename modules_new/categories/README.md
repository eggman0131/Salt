# Categories Module

Recipe categorisation domain for organising and filtering recipes.

## Architecture

```
modules_new/categories/
├── api.ts                      # Public API: pure functions
├── logic/
│   └── categorization.ts       # Pure logic (no I/O)
├── data/
│   ├── firebase-provider.ts    # Firestore CRUD
│   └── ai-provider.ts          # Gemini API calls
├── ui/
│   └── CategoriesManagement.tsx # Display component
├── admin.manifest.ts           # Admin tools
├── index.ts                    # Public exports
└── __tests__/                  # Unit and integration tests
```

## Module Guarantee

✅ **Strict Boundaries Enforced:**
- UI imports **only** from `api.ts`
- Logic never calls persistence or UI
- Persistence never contains business logic
- No cross-module imports except through `api.ts`

## Public API (`api.ts`)

### CRUD Operations

```typescript
// Fetch categories
getCategories(): Promise<RecipeCategory[]>

// Get single category
getCategory(id: string): Promise<RecipeCategory | null>

// Create category (validates uniqueness)
createCategory(category: Omit<RecipeCategory, 'id' | 'createdAt'>): Promise<RecipeCategory>

// Update category (revalidates name if changed)
updateCategory(id: string, updates: Partial<RecipeCategory>): Promise<RecipeCategory>

// Delete category
deleteCategory(id: string): Promise<void>
```

### Approval Workflow

```typescript
// Get pending categories
getPendingCategories(): Promise<RecipeCategory[]>

// Approve a pending category
approveCategory(id: string): Promise<void>
```

### AI-Powered Categorisation

```typescript
// Analyse recipe and suggest category IDs
categorizeRecipe(recipe: Recipe): Promise<string[]>
```

## How It Works

### Pure Logic Layer (`logic/categorization.ts`)
- `buildCategorizationPrompt()` — Constructs AI prompt deterministically
- `parseAICategoryResponse()` — Parses JSON from Gemini safely
- `validateCategoryNameUniqueness()` — Checks for conflicts
- All functions are **deterministic and side-effect-free**

### Persistence Layer (`data/`)
- `firebase-provider.ts` — All Firestore CRUD operations
- `ai-provider.ts` — Gemini API calls via Cloud Functions
- Called **only** by `api.ts`, never directly

### UI Layer (`ui/`)
- `CategoriesManagement.tsx` — Display component
- Calls **only** `api.ts` functions
- No logic, no persistence access

## Dependencies

- `types/contract.ts` — `RecipeCategory`, `Recipe`
- `shared/backend/firebase` — Firestore, Cloud Functions
- Gemini API (via Cloud Functions)

## Testing

### Logic Tests (`__tests__/logic.test.ts`)
```typescript
// Pure functions, no mocks needed
test('validates category name uniqueness', () => {
  const result = validateCategoryNameUniqueness(
    'Breakfast',
    [{ id: '1', name: 'Breakfast', ... }]
  );
  expect(result.valid).toBe(false);
});
```

### API Integration Tests (`__tests__/api.test.ts`)
```typescript
// Use Firebase emulator
test('createCategory validates name uniqueness', async () => {
  await createCategory({ name: 'Breakfast' });
  await expect(createCategory({ name: 'Breakfast' }))
    .rejects.toThrow('conflicts with existing');
});
```

## Admin Tools

Exposed via `admin.manifest.ts`:
- **Manage Categories** — CRUD, approval workflow, configuration

These are mounted by the Admin module, **not** imported directly.

## Module Rules

1. ✅ **Owns** recipe categorisation domain data and persistence
2. ✅ **Never** writes another module's data
3. ✅ **Never** imports another module's internals
4. ✅ **Exposes** pure, typed public API only
5. ✅ **Separates** logic from persistence from UI
6. ✅ **Maintains** deterministic, testable code

## Evolution

As the system grows:
- AI models can be upgraded without changing `api.ts`
- Firestore schema can evolve without touching logic
- UI can be completely rewritten without breaking anything
- Logic can be optimised without affecting other modules
