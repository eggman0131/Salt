# Recipes Module (Migration Baseline and API Stabilisation)

Status: Phase C complete
Date: 2026-03-07 (updated)

This document is the baseline inventory and migration map for moving Recipes from `modules/recipes` to `modules_new/recipes`, while integrating recipe-focused AI workflows into Recipes module ownership.

Scope constraint:
- UI/UX remains materially unchanged.
- Recipe logic behaviour remains materially unchanged.
- Refactor is structural to satisfy `docs/salt-architecture.md`.

## Migration Objective

Create `modules_new/recipes` as the authoritative domain module for recipe workflows:
- Own recipe data persistence.
- Own recipe workflow orchestration, including recipe-focused AI flows.
- Expose a single public API via `modules_new/recipes/api.ts`.
- Keep pure logic in `logic/` and I/O in `data/`.

## Current Baseline (Legacy Inventory)

### Legacy Module Roots
- `modules/recipes/index.ts`
- `modules/recipes/backend/*`
- `modules/recipes/components/*`
- `modules/ai/index.ts`
- `modules/ai/components/AIModule.tsx`

### Legacy Public Entry Points
- `modules/recipes/index.ts`
  - `recipesBackend`
  - `getRecipesBackend`
  - `IRecipesBackend`
  - `RecipesModule`
- `modules/ai/index.ts`
  - `AIModule`

### Active App-Level Call Sites
- `App.tsx`
  - imports `RecipesModule` and `recipesBackend` from `./modules/recipes`
  - imports `AIModule` from `./modules/ai`
  - mounts Recipes tab and AI tab separately
- `components/Dashboard.tsx`
  - imports `recipesBackend` from `@/modules/recipes/backend`
  - uses `resolveImagePath`

### Legacy Recipes Interface Surface (`IRecipesBackend`)

CRUD and lifecycle:
- `getRecipes`
- `getRecipe`
- `createRecipe`
- `updateRecipe`
- `resolveImagePath`
- `deleteRecipe`
- `repairRecipe`
- `onCanonItemsDeleted`

Recipe AI workflows:
- `generateRecipeFromPrompt`
- `chatWithRecipe`
- `summarizeAgreedRecipe`
- `chatForDraft`
- `generateRecipeImage`
- `importRecipeFromUrl`

### Legacy UI Components (Recipes)
- `RecipesModule.tsx`
- `RecipesList.tsx`
- `RecipeDetailView.tsx`
- `RecipeFormDialog.tsx`
- `RecipeChefChat.tsx`
- `RecipeCard.tsx`
- `DeleteRecipeDialog.tsx`
- `RepairRecipeModal.tsx`
- `RecipeIngredientsInput.tsx`
- `RecipeInstructionsInput.tsx`
- `RecipeEquipmentInput.tsx`
- `RecipeHistoryDialog.tsx`
- `CookTab.tsx`

### Legacy AI UI (To Be Integrated into Recipes UI)
- `modules/ai/components/AIModule.tsx`
  - Draft chat flow (`chatForDraft`)
  - Finalise flow (`summarizeAgreedRecipe` + `generateRecipeFromPrompt`)
  - Image generation (`generateRecipeImage`)
  - Save flow (`createRecipe`)
  - URL import flow (`importRecipeFromUrl` + `createRecipe`)

## Current Cross-Module Dependencies (Observed)

From recipes backend implementation:
- Canon: `../../canon` (legacy canon backend calls)
- Categories: category reads/creates
- Inventory: equipment reads
- Assist Mode: cook-guide cascade delete
- Firebase: Firestore, Storage, Cloud Functions transport
- Shared prompts/system instruction assembly

These dependencies will remain behaviourally equivalent but be re-wired to architecture-compliant `api.ts` boundaries in later phases.

## Phase A Mapping Matrix

## File-Level Mapping

| Legacy Path | Target Path | Target Layer | Migration Note |
| --- | --- | --- | --- |
| `modules/recipes/index.ts` | `modules_new/recipes/index.ts` | module root | Export only public API + public UI entry points. |
| `modules/recipes/backend/recipes-backend.interface.ts` | `modules_new/recipes/types.ts` + `modules_new/recipes/api.ts` | types + api | Interface contract split into domain DTO/types and API function signatures. |
| `modules/recipes/backend/base-recipes-backend.ts` | `modules_new/recipes/logic/*` + `modules_new/recipes/api.ts` | logic + api | Pure transformation and orchestration logic extracted from class shape to function modules. |
| `modules/recipes/backend/firebase-recipes-backend.ts` | `modules_new/recipes/data/*` | data | All Firebase/storage/cloud-function I/O consolidated in data providers. |
| `modules/recipes/backend/recipe-updates.ts` | `modules_new/recipes/logic/recipe-updates.ts` | logic | Keep existing behaviour for history entry generation. |
| `modules/recipes/components/RecipesModule.tsx` | `modules_new/recipes/ui/RecipesModule.tsx` | ui | Keep UX; update imports to Recipes API only. |
| `modules/recipes/components/RecipesList.tsx` | `modules_new/recipes/ui/RecipesList.tsx` | ui | Preserve list UX and filters. |
| `modules/recipes/components/RecipeDetailView.tsx` | `modules_new/recipes/ui/RecipeDetailView.tsx` | ui | Preserve detail UX and image flows. |
| `modules/recipes/components/RecipeChefChat.tsx` | `modules_new/recipes/ui/RecipeChefChat.tsx` | ui | Keep recipe chat UX; call new Recipes API functions. |
| `modules/recipes/components/RecipeFormDialog.tsx` | `modules_new/recipes/ui/RecipeFormDialog.tsx` | ui | No UX change, API-only imports. |
| `modules/recipes/components/DeleteRecipeDialog.tsx` | `modules_new/recipes/ui/DeleteRecipeDialog.tsx` | ui | No behaviour change. |
| `modules/recipes/components/RepairRecipeModal.tsx` | `modules_new/recipes/ui/RepairRecipeModal.tsx` | ui | No behaviour change. |
| `modules/recipes/components/RecipeCard.tsx` | `modules_new/recipes/ui/RecipeCard.tsx` | ui | Presentational component. |
| `modules/recipes/components/RecipeIngredientsInput.tsx` | `modules_new/recipes/ui/RecipeIngredientsInput.tsx` | ui | Presentational/input behaviour unchanged. |
| `modules/recipes/components/RecipeInstructionsInput.tsx` | `modules_new/recipes/ui/RecipeInstructionsInput.tsx` | ui | Presentational/input behaviour unchanged. |
| `modules/recipes/components/RecipeEquipmentInput.tsx` | `modules_new/recipes/ui/RecipeEquipmentInput.tsx` | ui | Presentational/input behaviour unchanged. |
| `modules/recipes/components/RecipeHistoryDialog.tsx` | `modules_new/recipes/ui/RecipeHistoryDialog.tsx` | ui | No behaviour change. |
| `modules/recipes/components/CookTab.tsx` | `modules_new/recipes/ui/CookTab.tsx` | ui | No behaviour change. |
| `modules/ai/components/AIModule.tsx` | `modules_new/recipes/ui/AIModule.tsx` (or `RecipesAIAssistant.tsx`) | ui | Move under Recipes ownership; keep UX and workflow intact. |
| `modules/ai/index.ts` | removed; exports replaced by `modules_new/recipes/index.ts` | module root | App imports recipe AI UI from Recipes module. |

## Function-Level Mapping

| Legacy Function | Legacy Owner | Target Owner | Target Layer | Notes |
| --- | --- | --- | --- | --- |
| `getRecipes` | recipes backend | recipes module | `api.ts` + `data/recipes-provider.ts` | No behaviour change. |
| `getRecipe` | recipes backend | recipes module | `api.ts` + `data/recipes-provider.ts` | No behaviour change. |
| `createRecipe` | recipes backend | recipes module | `api.ts` + `data/recipes-provider.ts` | Keep post-processing chain (categorise + ingredient matching). |
| `updateRecipe` | recipes backend | recipes module | `api.ts` + `data/recipes-provider.ts` | Keep incremental ingredient rematch behaviour. |
| `deleteRecipe` | recipes backend | recipes module | `api.ts` + `data/recipes-provider.ts` | Keep assist-mode cook-guide cascade behaviour. |
| `resolveImagePath` | recipes backend | recipes module | `api.ts` + `data/images-provider.ts` | Preserve dev/prod resolution logic. |
| `repairRecipe` | recipes backend | recipes module | `api.ts` + `logic/repairRecipe.ts` + `data/recipes-provider.ts` | Preserve categorize/relink options and progress semantics. |
| `onCanonItemsDeleted` | recipes backend | recipes module | `api.ts` + `data/recipes-provider.ts` | Keep unlink canonical IDs on notification. |
| `generateRecipeFromPrompt` | recipes backend | recipes module | `api.ts` + `logic/ai/generateRecipe.ts` + `data/ai-transport.ts` | Recipe AI orchestration owned by Recipes. |
| `chatWithRecipe` | recipes backend | recipes module | `api.ts` + `logic/ai/chatWithRecipe.ts` + `data/ai-transport.ts` | Preserve chat response behaviour. |
| `summarizeAgreedRecipe` | recipes backend | recipes module | `api.ts` + `logic/ai/summarizeRecipe.ts` + `data/ai-transport.ts` | Preserve summary shape handling. |
| `chatForDraft` | recipes backend | recipes module | `api.ts` + `logic/ai/chatForDraft.ts` + `data/ai-transport.ts` | Used by AI drafting UI. |
| `generateRecipeImage` | recipes backend | recipes module | `api.ts` + `data/ai-transport.ts` | Preserve Gemini image generation flow. |
| `importRecipeFromUrl` | recipes backend | recipes module | `api.ts` + `logic/ai/importRecipe.ts` + `data/url-import-provider.ts` | Keep import pipeline and source attribution. |
| `categorizeRecipe` | base recipes backend | recipes module | `logic/categorizeRecipe.ts` + `data/categories-provider.ts` | Keep confidence and category-creation behaviour. |
| `matchRecipeIngredients` | base recipes backend | recipes module | `logic/matchRecipeIngredients.ts` + Canon API call in `data/canon-provider.ts` | Route via `modules_new/canon/api.ts` only. |

## Callsite Mapping (App Shell and Shared UI)

| Current Import | Current File | Target Import | Note |
| --- | --- | --- | --- |
| `./modules/recipes` | `App.tsx` | `./modules_new/recipes` | Switch once public API parity exists. |
| `./modules/ai` | `App.tsx` | `./modules_new/recipes` | AI tab should mount Recipes-owned AI UI component. |
| `@/modules/recipes/backend` | `components/Dashboard.tsx` | `@/modules_new/recipes` | Dashboard image resolving should call Recipes API function, not backend internals. |

## Architecture Compliance Checklist for Phase A Baseline

- [x] Current entrypoints inventoried.
- [x] Current Recipes + AI workflow surface inventoried.
- [x] Legacy callsites identified for migration.
- [x] Old-to-new file mapping drafted.
- [x] Old-to-new function mapping drafted.
- [x] Explicit non-goals documented (no UX/logic redesign).

## Phase B Deliverables (Implemented)

Created in `modules_new/recipes`:
- `types.ts` (canonical API DTOs and shared workflow types)
- `data/recipes-provider.ts` (Phase B facade adapter)
- `data/crud-provider.ts` (CRUD and lifecycle provider)
- `data/ai-provider.ts` (recipe AI workflows provider)
- `data/notifications-provider.ts` (cross-module notifications provider)
- `logic/ai-inputs.ts` (pure input normalisation helpers)
- `api.ts` (stabilised public Recipes API, including AI workflows)
- `index.ts` (public exports)

Phase B notes:
- Current provider uses a temporary adapter into legacy recipes backend to stabilise callsites while preserving behaviour.
- Later phases replace this adapter with native `modules_new/recipes/data/*` providers.

Callsites rewired in this phase:
- `App.tsx`: recipe loading now calls `modules_new/recipes` (`getRecipes`) instead of legacy `recipesBackend.getRecipes()`.
- `components/Dashboard.tsx`: image URL resolution now calls `modules_new/recipes` (`resolveImagePath`) instead of importing legacy recipes backend internals.
- `App.tsx`: AI tab now mounts Recipes-owned `AIModule` exported from `modules_new/recipes` instead of `modules/ai`.
- `modules/recipes/components/RecipesModule.tsx`: CRUD/repair/image actions now call `modules_new/recipes` API functions.
- `modules/recipes/components/RecipeChefChat.tsx`: chat/summarise/generate calls now use `modules_new/recipes` API.
- `modules/recipes/components/RecipeDetailView.tsx`: image resolve/regenerate/update now use `modules_new/recipes` API.
- `App.tsx`: Recipes tab now imports `RecipesModule` from `modules_new/recipes` instead of direct legacy module import.

Transitional note:
- `modules_new/recipes/ui/RecipesModule.tsx` now contains the actual Recipes tab orchestration logic.
- It still imports child UI components from legacy module paths for now; those child components will be moved under `modules_new/recipes/ui` in subsequent steps.

Recipes-owned AI UI introduced:
- `modules_new/recipes/ui/AIModule.tsx` (migrated from `modules/ai/components/AIModule.tsx` with equivalent UX and workflow behaviour, now calling `modules_new/recipes/api.ts`).

## Phase C Complete (2026-03-07)

All child UI components migrated from `modules/recipes/components/` into `modules_new/recipes/ui/`:
- ✅ `RecipesList.tsx` - Recipe list view with search and filtering
- ✅ `RecipeDetailView.tsx` - Recipe detail view with tabbed interface
- ✅ `RepairRecipeModal.tsx` - Recipe repair dialog
- ✅ `RecipeFormDialog.tsx` - Main recipe create/edit form
- ✅ `DeleteRecipeDialog.tsx` - Delete confirmation dialog
- ✅ `CategoryPicker.tsx` - Category selection dialog
- ✅ `RecipeChefChat.tsx` - Recipe AI chat and proposal flow
- ✅ `RecipeHistoryDialog.tsx` - Recipe version history dialog
- ✅ `RecipeCard.tsx` - Recipe list card
- ✅ `RecipeIngredientsInput.tsx` - Ingredients input block
- ✅ `RecipeInstructionsInput.tsx` - Instructions input block
- ✅ `RecipeEquipmentInput.tsx` - Equipment input block
- ✅ `CookTab.tsx` + `cook-tab/*` - Cooking mode views and shared logic

Migration changes:
- Updated `modules_new/recipes/ui/RecipesModule.tsx`, `modules_new/recipes/ui/RecipesList.tsx`, and `modules_new/recipes/ui/RecipeDetailView.tsx` to use local `./` imports for all migrated child components
- Corrected import paths in migrated components to workspace aliases for shared UI/types (`@/components/ui/*`, `@/types/contract`, `@/hooks/*`, `@/lib/*`)
- Build validated successfully with no TypeScript errors (`npm run build`)

Status: Phase C complete. Recipes UI now runs from `modules_new/recipes/ui/` with no runtime imports from `modules/recipes/components/*`.

## Phase D Complete (2026-03-07)

Replaced all `legacy-backend-adapter.ts` delegation with native data providers. The adapter file has been deleted.

New files:
- `data/firestore-utils.ts` — pure Firestore encoding/decoding helpers (nested array codec, timestamp conversion, embedding sanitisation)
- `data/storage-provider.ts` — Firebase Storage: `resolveImagePath`, `uploadRecipeImage` (dev proxy + prod SDK paths)
- `data/ai-transport.ts` — Cloud Function transport: `callGenerateContent`, `callGenerateContentStream`, `fetchUrlContent`, `getSystemInstruction`
- `data/settings-provider.ts` — kitchen settings and inventory reads for AI context
- `logic/normalize-recipe.ts` — pure recipe data normalisation: `normalizeRecipeData`, `normalizeInstructions`, `sanitizeJson`, `pruneHistory`
- `logic/categorize-recipe.ts` — `categorizeRecipe`: calls `ai-transport` + `modules_new/categories/api`

Updated:
- `data/crud-provider.ts` — native Firebase CRUD + post-processing (categorise, match ingredients, cascade delete)
- `data/ai-provider.ts` — native AI workflows using `ai-transport` + `normalize-recipe`
- `data/notifications-provider.ts` — native Firestore batch update for canon item deletion

Cross-module notes:
- `categorize-recipe.ts` routes through `modules_new/categories/api` ✅
- `crud-provider.ts` routes through `modules_new/canon/api` for ingredient matching ✅
- `crud-provider.ts` imports `assistModeBackend` from `modules/assist-mode/backend` for cascade delete (temporary — resolves when assist-mode migrates)

Build validated: ✅ no TypeScript errors (`npm run build`)

Status: Phase D complete. `modules_new/recipes/data/` has no remaining imports from `modules/recipes/backend`.
