# Recipes Module

The **recipes domain** for Salt. Handles recipe creation, management, AI-powered generation, chat refinement, and content management.

## Purpose

The Recipes module manages the core recipe content in Salt:
- **Recipe CRUD** - Create, read, update, delete recipes with full metadata
- **AI Generation** - Generate recipes from prompts with iterative refinement
- **Recipe Chat** - Conversational iteration with the Head Chef AI
- **Image Management** - Generate and store recipe images
- **URL Imports** - Import recipes from external sources (MyFitnessPal, etc.)
- **Post-Processing** - Auto-categorize recipes and link ingredients to canonical items

## Architecture

```
modules/recipes/
├── backend/
│   ├── recipes-backend.interface.ts              (12 methods)
│   ├── base-recipes-backend.ts                   (AI logic + helpers)
│   ├── firebase-recipes-backend.ts               (Firebase persistence)
│   └── index.ts                                  (Public backend API)
├── components/
│   ├── RecipesModule.tsx                         (Main orchestrator)
│   ├── RecipeDetail.tsx                          (Edit view)
│   ├── RecipesList.tsx                           (List view)
│   ├── RecipeModals/                             (Form dialogs)
│   │   ├── AddToListModal.tsx
│   │   ├── CategoryPickerModal.tsx
│   │   ├── DeleteConfirmModal.tsx
│   │   ├── HistoryModal.tsx
│   │   ├── ImageEditorModalWrapper.tsx
│   │   ├── ImportMFPRecipeModal.tsx
│   │   ├── ProposalModal.tsx
│   │   ├── RepairRecipeModal.tsx
│   │   └── RollbackConfirmModal.tsx
│   └── RecipeSections/                           (Render components)
│       ├── AtAGlanceSection.tsx
│       ├── EditableMetadataSection.tsx
│       ├── RecipeCategoryDisplay.tsx
│       ├── RecipeChefSidebar.tsx
│       ├── RecipeEditModeBar.tsx
│       ├── RecipeHistorySection.tsx
│       ├── RecipeImageCard.tsx
│       ├── RecipeIngredientsSection.tsx
│       ├── RecipeInstructionsSection.tsx
│       ├── RecipeTabNavigation.tsx
│       └── WorkflowAdviceSection.tsx
├── index.ts                                      (Public exports)
└── README.md                                     (This file)
```

## Backend Interface

The `IRecipesBackend` interface provides 12 methods:

### Recipe CRUD (6 methods)
- `getRecipes()` - Fetch all recipes
- `getRecipe(id)` - Fetch single recipe
- `createRecipe(recipe, imageData?)` - Create new recipe
- `updateRecipe(id, updates, imageData?)` - Update recipe
- `resolveImagePath(path)` - Get signed download URL
- `deleteRecipe(id)` - Remove recipe

### AI-Powered Features (6 methods)
- `generateRecipeFromPrompt(prompt, currentRecipe?, history?)` - Generate recipe from text
- `chatWithRecipe(recipe, message, history, onChunk?)` - Stream-based recipe chat
- `summarizeAgreedRecipe(history, currentRecipe?)` - Finalize recipe from discussion
- `chatForDraft(history)` - Conversational drafting (pre-creation)
- `generateRecipeImage(title, description?)` - AI image generation
- `importRecipeFromUrl(url)` - Import from external sources

## Features

### AI-Powered Recipe Generation
- **Prompt-based**: "Create a 30-minute weeknight pasta"
- **Context-aware**: Uses kitchen inventory for equipment suggestions
- **Iterative**: Chat with AI to refine ingredients, instructions, timing
- **Auto-categorization**: AI suggests recipe categories post-creation
- **Ingredient linking**: Delegates matching and linking to the Canon module

### Recipe Chat
- **Streaming responses** for real-time interaction
- **Shared context** of current recipe and discussion history
- **Post-processing** options:
  - Update recipe from agreed changes
  - Categorize based on discussion
  - Finalize as new recipe

### Image Management
- **AI generation** using title and description
- **Upload storage** in Firebase Storage
- **Signed URLs** for secure access

### Workflow Features
- **Step-specific ingredients** for advanced recipes
- **Workflow advice** with technical warnings
- **Step-by-step alerts** for precision cooking
- **Ingredient preparation notes** (diced, minced, etc.)

### Post-Processing
- **Recipe categorization** - AI suggests categories based on title, ingredients, instructions
- **Ingredient resolution** - Sends recipe ingredients to the Canon module for matching/linking
- **Canonical item lifecycle** - Canon module handles canonical item creation, synonym updates, approvals, and embeddings
- **Batch processing** - Canon module handles unmatched ingredient resolution in a single AI call

## Usage

### Import the Backend

```typescript
import { recipesBackend } from '@/modules/recipes';

// Fetch recipes
const recipes = await recipesBackend.getRecipes();

// Generate recipe
const generated = await recipesBackend.generateRecipeFromPrompt(
  '30-minute stir fry with tofu'
);

// Chat with AI
const response = await recipesBackend.chatWithRecipe(
  myRecipe,
  'Can I use coconut milk instead of cream?',
  chatHistory,
  (chunk) => console.log(chunk)  // Stream chunks
);

// Generate image
const imageUrl = await recipesBackend.generateRecipeImage(
  'Thai Green Curry',
  'Aromatic green curry with tofu and basil'
);
```

### Import Components

```typescript
import { RecipesModule } from '@/modules/recipes';

<RecipesModule onRefresh={handleRefresh} />
```

## Dependencies

This module imports from:
- `types/contract.ts` - Zod schemas (The Law)
- `backend/firebase.ts` - Firebase config
- `backend/prompts.ts` - AI system instructions (The Soul)
- `components/UI.tsx` - Shared UI components
- `modules/kitchen-data` - Categories, units, aisles, canonical items (for post-processing)
- `modules/shopping` - Shopping list integration (add recipes to lists)

This module is imported by:
- `components/App.tsx` - Main app recipe section
- `modules/planner` - Meal planning uses recipes
- `modules/inventory` - Equipment validation for recipes

## Data Model

### Recipe
```typescript
{
  id: string;
  title: string;
  description: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];  // Self-contained with embedded ingredients/warnings
  prepTime: string;                   // "20 mins"
  cookTime: string;                   // "30 mins"
  totalTime: string;                  // "50 mins"
  servings: string;                   // "4 people"
  complexity: 'Easy' | 'Intermediate' | 'Advanced';
  categoryIds: string[];              // FK to RecipeCategory
  equipmentNeeded: string[];          // Equipment names
  imagePath?: string;                 // Firebase Storage path
  workflowAdvice?: {
    seasonalNotes?: string;
    serviceNotes?: string;
  };
  source?: string;                    // For imported recipes
  createdAt: string;
  createdBy: string;
}
```

### RecipeInstruction (Issue #57 - Persistent IDs)
```typescript
{
  id: string;                         // UUID - persistent anchor (prevents data loss on reordering)
  text: string;                       // The instruction text
  ingredients: RecipeIngredient[];    // Step-specific ingredients (embedded, no indices)
  technicalWarnings: string[];        // Step-specific warnings (embedded, no indices)
}
```

### RecipeIngredient
```typescript
{
  id: string;
  raw: string;                        // Original input
  quantity?: number;
  unit?: string;                      // "g", "ml", "_item"
  ingredientName: string;
  preparation?: string;               // "finely diced"
  canonicalItemId?: string;           // FK to CanonicalItem
}
```

## Constitutional Compliance

This module strictly adheres to Salt's constitution:

1. **The Law** (`types/contract.ts`) - All data validated by Zod schemas
2. **The Soul** (`shared/backend/prompts.ts`) - AI uses Head Chef voice
3. **The Brain** (base-recipes-backend.ts) - Domain logic and AI synthesis
4. **The Hands** (firebase-recipes-backend.ts) - Persistence only

### British Terms & Metric Units
- All UI and AI outputs use British English
- Only metric units (no cups, ounces, Fahrenheit)
- Culinary terms: Frying Pan, Sauté Pan, Whisk, Casserole

### No Tech-Bleed
- No software jargon in UI labels
- The AI speaks as "Head Chef", not an assistant
- Terms: "Kitchen prep", "Cooking steps" (not "Database", "Backend")

## Component Features

### RecipesModule
- Central state management
- Recipe list and detail views
- Modal dialogs for forms
- AI generation and chat interface

### RecipeDetail
- Full recipe display with all sections
- Edit mode for recipe properties
- Image management
- Category and equipment selectors

### RecipesList
- Filterable recipe catalog
- Sort by name, date, complexity
- Quick actions (edit, delete, add to list)

### AI Chat Interface
- Real-time streaming responses
- History tracking
- Actions: Refine recipe, approve, start over
- Error handling and fallbacks

## Testing

To test recipes functionality:

```bash
# Run dev server
npm run dev

# Navigate to Recipes section
# Test features:
# 1. Create recipe (manual form)
# 2. Generate recipe (AI prompt)
# 3. Chat with recipe
# 4. Generate image
# 5. Update and categorize
# 6. Delete recipe

# Check errors
npm run build

# Test shopping list integration
# Add recipe to shopping list → verify in shopping module
```

## Migration History

This module was extracted from the monolithic backend on [date]:
- 13 components migrated from `components/RecipeModals/` and `components/RecipeSections/`
- 3 main components migrated: RecipesModule, RecipeDetail, RecipesList
- 12 backend methods extracted for complete recipe domain
- AI chat and generation logic preserved in base backend
- Image and URL import functionality preserved

## Future Enhancements

Potential improvements:
- Recipe version history with rollback
- Collaborative recipe editing
- Nutritional information tracking
- Recipe scaling by servings
- Dietary filter tags (vegan, gluten-free, etc.)
- Recipe ratings and reviews
- Meal prep mode (batch ingredients by step)
- PDF export for printing
- Integration with nutrition APIs
