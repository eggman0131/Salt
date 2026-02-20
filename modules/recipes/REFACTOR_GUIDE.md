# Recipe Module Refactor - Migration Guide

## Overview

The recipe module has been refactored to a simplified, maintainable implementation following shadcn/ui best practices. The focus is on core CRUD functionality with clean, simple components.

## What's New

### Component Structure

**Simplified from 23 components to 5 core components:**

1. **RecipesModule.new.tsx** - Main orchestrator with state management
2. **RecipesList.new.tsx** - Grid view with search and category filters
3. **RecipeCard.tsx** - Individual recipe card for list view
4. **RecipeDetailView.tsx** - Full recipe display with actions
5. **RecipeFormDialog.tsx** - Create/edit form (shadcn Dialog)
6. **DeleteRecipeDialog.tsx** - Delete confirmation (shadcn AlertDialog)

### Features Included (Simple CRUD)

✅ **List View**
- Recipe grid with responsive layout
- Search by title/description
- Filter by category
- Category badges
- Complexity indicators
- Empty state with CTA

✅ **Detail View**
- Full recipe display
- Recipe image (if exists)
- At-a-glance metadata (prep/cook/total time, servings)
- Ingredients list with quantities and units
- Numbered instructions
- Equipment list
- Category tags
- Edit and Delete actions

✅ **Create/Edit**
- Single form dialog for both modes
- Basic metadata fields (title, description, times, servings, complexity)
- Category multi-select (checkboxes)
- Dynamic ingredient list (add/remove rows)
- Dynamic instructions list (numbered steps)
- Dynamic equipment list
- Validation and error handling

✅ **Delete**
- AlertDialog confirmation (proper destructive pattern)
- Can't dismiss by clicking outside
- Clear warning message

### Features Removed (Complexity)

❌ **AI Features** (can be re-added later):
- Recipe generation from prompts
- Chat interface with AI
- Recipe refinement
- Image generation
- URL imports

❌ **Advanced Recipe Features** (can be re-added later):
- Step-specific ingredients
- Step alerts
- Workflow advice
- Technical warnings
- Seasonal notes
- Cook mode
- History/rollback
- Repair modal
- Recipe proposals

## Architectural Decisions

### Decision Hierarchy Applied

1. **The Law** (`types/contract.ts`) - All data conforms to Recipe and RecipeIngredient schemas
2. **Constitution Hierarchy** - Backend interfaces preserved, only UI simplified
3. **Module Boundaries** - Only imports from `shared/*`, `types/contract.ts`, and `kitchen-data` (read-only)
4. **shadcn/ui Components** - Proper semantic usage:
   - `Dialog` for forms (non-critical)
   - `AlertDialog` for destructive confirmations (delete)
   - `Card`, `Badge`, `Button`, `Input`, `Textarea`, `Select`, `Checkbox`
5. **Clean Slate Philosophy** - Built for what we need now, not what existed before
6. **Design Tokens** - Semantic colors (`bg-primary`, `text-muted-foreground`, etc.)
7. **British English & Metric** - All UI text follows conventions
8. **No Tech-Bleed** - No jargon in user-facing strings

### Component Patterns

**Toast Notifications:**
```typescript
import { toast, Toaster } from 'sonner';
toast.success('Recipe created');
toast.error('Failed to create recipe');
```
- `<Toaster position="top-right" />` added to both list and detail views

**Hover States:**
```typescript
className="hover:shadow-md transition-shadow"
className="group-hover:scale-105 transition-transform duration-300"
```

**Empty States:**
```typescript
<Card className="p-12 border-dashed text-center">
  <div className="text-muted-foreground">
    <p className="text-lg font-medium">No recipes yet</p>
    <p className="mt-1">Create your first recipe to get started</p>
  </div>
</Card>
```

**Loading States:**
```typescript
{isLoading && (
  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
)}
```

**Dark Mode Support:**
```typescript
className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
```

## Migration Steps

### To Activate the New Module

1. **Rename files to remove `.new` suffix:**
   ```bash
   cd /home/eggman/projects/salt/modules/recipes/components
   mv RecipesModule.new.tsx RecipesModule.tsx
   mv RecipesList.new.tsx RecipesList.tsx
   ```

2. **Update index.ts:**
   ```bash
   cd /home/eggman/projects/salt/modules/recipes
   mv index.new.ts index.ts
   ```

3. **Update App.tsx imports** (if needed - check current structure)

4. **Backup old components** (optional):
   ```bash
   mkdir -p old-components
   mv <old-component-files> old-components/
   ```

### Testing Checklist

- [ ] Recipe list loads and displays correctly
- [ ] Search filters recipes by title/description
- [ ] Category filters work
- [ ] Create recipe form opens and submits
- [ ] Edit recipe loads existing data
- [ ] Delete recipe shows confirmation
- [ ] Recipe detail view displays all sections
- [ ] Images load (if recipes have imagePaths)
- [ ] Toast notifications appear on actions
- [ ] Mobile responsive (375px, 768px, 1024px)
- [ ] Dark mode works correctly

## Backend Interface (Unchanged)

The backend interface remains the same. Only the UI was simplified:

```typescript
// Still available (used by new module)
recipesBackend.getRecipes()
recipesBackend.getRecipe(id)
recipesBackend.createRecipe(recipe, imageData?)
recipesBackend.updateRecipe(id, updates, imageData?)
recipesBackend.deleteRecipe(id)
recipesBackend.resolveImagePath(path)

// Still available (not used by new module - can be reintroduced)
recipesBackend.generateRecipeFromPrompt(...)
recipesBackend.chatWithRecipe(...)
recipesBackend.summarizeAgreedRecipe(...)
recipesBackend.chatForDraft(...)
recipesBackend.generateRecipeImage(...)
recipesBackend.importRecipeFromUrl(...)
```

## File Structure

```
modules/recipes/
├── backend/                               (unchanged)
│   ├── recipes-backend.interface.ts
│   ├── base-recipes-backend.ts
│   ├── firebase-recipes-backend.ts
│   └── index.ts
├── components/
│   ├── RecipesModule.new.tsx             ← NEW: Main orchestrator
│   ├── RecipesList.new.tsx               ← NEW: List view
│   ├── RecipeCard.tsx                    ← NEW: Card component
│   ├── RecipeDetailView.tsx              ← NEW: Detail view
│   ├── RecipeFormDialog.tsx              ← NEW: Create/edit form
│   ├── DeleteRecipeDialog.tsx            ← NEW: Delete confirmation
│   └── [23 old component files]          ← TO BE ARCHIVED
├── index.new.ts                          ← NEW: Simplified exports
└── README.md                             ← UPDATE NEEDED
```

## What Can Be Re-Added Later

These features were intentionally removed to simplify. They can be reintroduced incrementally:

1. **AI Recipe Generation** - Add a "Generate Recipe" button that opens a prompt dialog
2. **Recipe Chat** - Add a chat tab to RecipeDetailView
3. **Cook Mode** - Add a "Start Cooking" button that opens step-by-step view
4. **Image Upload/Generation** - Add image controls to RecipeFormDialog
5. **URL Imports** - Add "Import from URL" option
6. **Step-specific Ingredients** - Extend RecipeFormDialog for advanced recipes
7. **Workflow Advice** - Add a section to RecipeDetailView
8. **History/Rollback** - Add version tracking and rollback UI

## Design Tokens Used

- `bg-primary`, `text-primary-foreground`
- `bg-muted`, `text-muted-foreground`
- `bg-destructive`, `text-destructive-foreground`
- `hover:bg-primary/10` (semantic hover states)
- `border-dashed` (empty states)
- Standard spacing: `p-4`, `gap-4`, `space-y-6`
- Standard shadows: `shadow-sm`, `hover:shadow-md`

## Responsive Design

- Mobile (375px): Single column grid, stacked filters
- Tablet (768px): 2-column recipe grid, inline filters
- Desktop (1024px): 3-column recipe grid, expanded content

## Known Limitations

- No image upload yet (uses existing imagePath if present)
- No AI-powered features (generation, chat, imports)
- No advanced recipe features (step ingredients, alerts, workflow)
- No history tracking (can be added later)

## Questions?

If you encounter issues:
1. Check the console for errors
2. Verify all dependencies are installed (`npm install`)
3. Check that shadcn/ui components are properly installed
4. Verify backend methods are working (test with browser console)
5. Check that categories load from kitchen-data module

## Next Steps

1. Test the new module thoroughly
2. Update the README.md with simplified documentation
3. Archive old components
4. Decide which complex features to reintroduce (if any)
5. Consider adding unit tests for the new components
