# Recipes
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for this module.

## Purpose

The recipes module owns all recipe data, transformations, and UI. It orchestrates AI-powered recipe workflows (generation, chef chat, repair, image generation, URL import), manages recipe images in Firebase Storage, integrates with the canon module for ingredient matching, and integrates with assist-mode for cook guides.

## Ownership

This module owns:
- The `recipes` Firestore collection.
- All recipe CRUD and lifecycle logic.
- All recipe AI workflows (generation, chat, summarise, repair, image).
- Recipe images in Firebase Storage.
- Recipe history tracking.
- The Storage Cleanup admin tool (finds and deletes orphaned recipe images).
- `CategoriesManagement.tsx` is surfaced via a Sheet in `RecipesList.tsx` — categories data is owned by the categories module, but the management UI entry point lives here.

This module does **not**:
- Write to the `categories` collection (calls `categories/api.ts`).
- Write to canon collections (calls `canon/api.ts`).
- Write to cook guides (calls `assist-mode/api.ts` for cascade delete only).

## Folder Structure

    api.ts                          # Public API
    types.ts                        # Module-specific types (CreateRecipeInput, UpdateRecipeInput, etc.)
    logic/
      recipe-updates.ts             # Pure: history entry generation
      normalize-recipe.ts           # Pure: recipe data normalisation
      categorize-recipe.ts          # Pure: categorisation orchestration
    data/
      crud-provider.ts              # Firestore CRUD + post-processing pipeline
      ai-provider.ts                # Recipe AI workflows
      ai-transport.ts               # Cloud Function transport (callGenerateContent, streaming)
      storage-provider.ts           # Firebase Storage: image upload/resolve
      settings-provider.ts          # Kitchen settings and inventory reads for AI context
      storage-cleanup.ts            # Orphaned image detection and deletion
    ui/
      RecipesModule.tsx             # Top-level module entry
      RecipesList.tsx               # Recipe list with search, filters, categories sheet
      RecipeDetailView.tsx          # Recipe detail with draggable chef chat panel (desktop)
      RecipeFormDialog.tsx          # Create/edit form
      RecipeChefChat.tsx            # Chef chat and proposal flow
      RecipeCard.tsx                # List card
      RepairRecipeModal.tsx         # Recipe repair dialog
      DeleteRecipeDialog.tsx        # Delete confirmation
      RecipeHistoryDialog.tsx       # Version history
      RecipeIngredientsInput.tsx    # Ingredients input block
      RecipeInstructionsInput.tsx   # Instructions input block
      RecipeEquipmentInput.tsx      # Equipment input block
      CookTab.tsx                   # Cooking mode view
      AIModule.tsx                  # AI draft and finalise flow
    admin.manifest.ts               # Declares Storage Cleanup admin tool
    __tests__/
      logic.test.ts                 # Pure logic tests

## Public API

### CRUD

```typescript
getRecipes(): Promise<Recipe[]>
getRecipe(id: string): Promise<Recipe | null>
createRecipe(recipe: CreateRecipeInput, imageData?: string, onProgress?: (progress: RecipeSaveProgress) => void): Promise<Recipe>
updateRecipe(id: string, updates: UpdateRecipeInput, imageData?: string, onProgress?: (progress: RecipeSaveProgress) => void): Promise<Recipe>
deleteRecipe(id: string): Promise<void>
resolveImagePath(path: string): Promise<string>
```

### Repair and Notifications

```typescript
repairRecipe(recipeId: string, options: RepairRecipeOptions, onProgress?: (progress: RecipeSaveProgress) => void): Promise<Recipe>
onCanonItemsDeleted(ids: string[]): Promise<void>
```

### AI Workflows

All AI calls go through `data/ai-transport.ts`, which calls the `cloudGenerateContent` Cloud Function. The assist-mode AI provider (`modules/assist-mode/data/ai-provider.ts`) uses the same transport pattern.

```typescript
generateRecipeFromPrompt(prompt: string, context?: RecipeGenerationContext): Promise<Partial<Recipe>>
chatWithRecipe(recipe: Recipe, message: string, history: RecipeConversationTurn[], onChunk?: (chunk: string) => void): Promise<string>
summarizeAgreedRecipe(history: RecipeConversationTurn[], currentRecipe?: Recipe): Promise<string>
chatForDraft(history: RecipeConversationTurn[]): Promise<string>
generateRecipeImage(recipeTitle: string, description?: string): Promise<string>
importRecipeFromUrl(url: string): Promise<Partial<Recipe>>
```

### Pure Logic Helpers

```typescript
buildManualEditSummary(updates: UpdateRecipeInput): string
createHistoryEntry(recipe: Recipe, summary: string): RecipeHistoryEntry
```

## Key Features

- **Recipe history tracking** — every save creates a history entry; `RecipeHistoryDialog.tsx` displays the diff.
- **AI chef chat panel** — `RecipeDetailView.tsx` has a draggable, minimisable chef chat panel on desktop.
- **Ingredient matching** — `createRecipe` and `updateRecipe` call `canon/api.ts` to match and link ingredients.
- **Auto-categorisation** — `createRecipe` calls `categories/api.ts` to suggest categories.
- **Cook guide cascade** — `deleteRecipe` calls `assist-mode/api.ts` to remove associated guides.
- **Categories sheet** — `RecipesList.tsx` contains a "Categories" button that opens `CategoriesManagement` in a Sheet.

## Admin Tools

Declared in `admin.manifest.ts`:

| Tool ID | Label | Purpose |
|---------|-------|---------|
| `recipes.storageCleanup` | Storage Cleanup | Find and delete orphaned recipe images in Firebase Storage |

Storage cleanup logic lives in `data/storage-cleanup.ts`.

## Types

Module-specific types in `types.ts`:
- `CreateRecipeInput`
- `UpdateRecipeInput`
- `RecipeConversationTurn`
- `RecipeGenerationContext`
- `RecipeSaveProgress`
- `RepairRecipeOptions`

Global types (`Recipe`) live in `types/contract.ts`.

## Testing

```bash
npx vitest run modules/recipes/__tests__/logic.test.ts
```

## Dependencies

- `types/contract.ts` — `Recipe`, `RecipeIngredient`, `RecipeCategory`
- `modules/categories/api.ts` — recipe categorisation
- `modules/canon/api.ts` — ingredient matching
- `modules/assist-mode/api.ts` — cook guide cascade delete
- Firebase Firestore, Firebase Storage, Cloud Functions (`cloudGenerateContent`)

## Architectural Source of Truth

All code in this module must follow the rules defined in `docs/salt-architecture.md`.
