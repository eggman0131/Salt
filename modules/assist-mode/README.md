# Assist Mode
Authoritative module contract for Salt. This file defines ownership, boundaries, and the public API surface for this module.

## Purpose

The assist-mode module generates and stores AI cook guides for recipes. Each guide provides step-by-step cooking instructions enriched with sensory cues (visual, audio, aroma, texture) and progression checks to help the cook know when each step is complete. Guides also include a mise en place phase (prep groups) before the cooking steps begin.

## Ownership

This module owns:
- The `cookGuides` Firestore collection.
- All cook guide generation, storage, and retrieval logic.
- The Cook Guides admin tool.

This module does **not**:
- Write to the `recipes` collection.
- Own recipe data — it reads recipe data passed in as parameters.

## Folder Structure

    api.ts                          # Public API (entry point: CookModeModule)
    types.ts                        # CookGuide, CookingStep, PrepGroup, SensoryCues
    logic/
      prompts.ts                    # Pure: prompt construction for guide generation
      guide-utils.ts                # Pure: guide transformation helpers
    data/
      guides-provider.ts            # Firestore CRUD for cook guides
      ai-provider.ts                # Cloud Function calls for guide generation
    ui/
      CookModeModule.tsx            # Main cook mode UI
      CookingStepView.tsx           # Individual step display with sensory cues
      PrepPhaseView.tsx             # Mise en place (prep groups) display
      ProgressionCheck.tsx          # Progression check display
      GuidesAdmin.tsx               # Admin tool: list, deduplicate, delete guides
    admin.manifest.ts               # Declares Cook Guides admin tool
    internal.ts                     # Private helpers

## Key Types (`types.ts`)

```typescript
interface PrepGroup {
  id: string;
  container: string;       // e.g. "Medium bowl"
  label: string;           // e.g. "Soffritto: Dice carrot, onion & celery (5mm)"
  ingredients: string[];
  prepInstructions: string;
}

interface SensoryCues {
  visual?: string;
  audio?: string;
  aroma?: string;
  texture?: string;
}

interface CookingStep {
  id: string;
  stepNumber: number;
  instructionIndex?: number;   // Links to recipe.instructions[]
  instruction: string;
  containerReference?: string;
  temperature?: string;
  timeEstimate?: string;
  sensoryCues: SensoryCues;
  progressionCheck: string;    // "Before continuing: ..."
}

interface CookGuide {
  id: string;
  recipeId: string;
  recipeTitle: string;
  recipeVersion: string;       // Hash to detect stale guides
  prepGroups: PrepGroup[];
  steps: CookingStep[];
  generatedAt: string;
  generatedBy: string;
}
```

## Public API

```typescript
// Get a guide for a recipe, generating one if it does not exist or is stale
getOrGenerateCookGuide(recipeId: string, recipe: Recipe): Promise<CookGuide>

// Generate (or regenerate) a guide for a recipe
generateCookGuide(recipeId: string, recipe: Recipe): Promise<CookGuide>

// Fetch a stored guide by ID
getCookGuide(id: string): Promise<CookGuide | null>

// Get all guides for a specific recipe
getCookGuidesForRecipe(recipeId: string): Promise<CookGuide[]>

// Get all guides (used by admin tool)
getAllCookGuides(): Promise<CookGuide[]>

// Update a single cooking step within a guide
updateCookingStep(guideId: string, stepId: string, updates: Partial<CookingStep>): Promise<void>

// Update prep groups for a guide
updatePrepGroups(guideId: string, prepGroups: PrepGroup[]): Promise<void>

// Delete a guide
deleteCookGuide(id: string): Promise<void>

// UI entry point
CookModeModule: React.FC<{ recipeId: string; recipe: Recipe }>
```

## Guide Generation

Guide generation calls the `cloudGenerateContent` Cloud Function via `data/ai-provider.ts`. The guide includes:

- **Prep groups** — mise en place instructions organised by container.
- **Cooking steps** — each step has sensory cues and a progression check.
- **Recipe version hash** (`recipeVersion`) — used to detect when a guide is stale relative to the recipe. A stale guide is regenerated automatically by `getOrGenerateCookGuide`.

## Admin Tools

Declared in `admin.manifest.ts` and loaded by the admin dashboard:

| Tool ID | Label | Purpose |
|---------|-------|---------|
| `assist-mode.guides` | Cook Guides | List all guides, identify duplicates, delete guides |

Admin component: `ui/GuidesAdmin.tsx`.

## Testing

There are no standalone test files for this module. Logic is covered by integration with the recipes module.

## Dependencies

- `types/contract.ts` — `Recipe`
- Firebase Firestore, Cloud Functions (`cloudGenerateContent`)

## Architectural Source of Truth

All code in this module must follow the rules defined in `docs/salt-architecture.md`.
