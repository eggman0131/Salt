# Assist Mode Module

The **assist mode domain** for Salt. Provides autism-friendly, sensory-rich cooking guides for recipes.

## Purpose

Assist Mode generates detailed, step-by-step cooking guides with explicit sensory cues for neurodivergent users and anyone who benefits from detailed instructions:
- **Container-based prep** - Group and label ingredients for organized preparation
- **Sensory guidance** - Explicit visual, audio, aroma, and texture cues for each step
- **Temperature settings** - Exact heat dial positions and oven temperatures
- **Progression checks** - Clear indicators of when a dish is "done enough" to move forward
- **Time estimates** - Expected duration for each step

## Architecture

```
modules/assist-mode/
├── backend/
│   ├── assist-mode-backend.interface.ts  (5 methods)
│   ├── base-assist-mode-backend.ts       (AI generation logic)
│   ├── firebase-assist-mode-backend.ts   (Firestore persistence)
│   └── index.ts                          (Public backend API)
├── components/
│   ├── CookModeModule.tsx                (Main orchestrator, two-phase UI)
│   ├── PrepPhaseView.tsx                 (Container-grouped checklist)
│   ├── CookingStepView.tsx               (Single step with sensory cues)
│   └── ProgressionCheck.tsx              (Before-moving-on validation)
├── types.ts                              (CookGuide, PrepGroup, CookingStep)
├── prompts.ts                            (Gemini system + user prompts)
├── index.ts                              (Public exports)
└── README.md                             (This file)
```

## Data Model

### CookGuide (Root Document)
```typescript
{
  id: string;
  recipeId: string;              // Links to Recipe
  recipeTitle: string;           // Snapshot for display
  recipeVersion: string;         // SHA256 hash to detect stale guides
  prepGroups: PrepGroup[];
  steps: CookingStep[];
  generatedAt: string;           // ISO timestamp
  generatedBy: string;           // User ID or "system"
}
```

### PrepGroup (Ingredient Grouping)
```typescript
{
  id: string;
  container: string;             // "Bowl 1", "Small pot", "Measuring jug"
  label: string;                 // "Soffritto", "Dry spices", "Marinade"
  ingredients: string[];         // ["onion", "carrot", "celery"]
  prepInstructions: string;      // "Dice all to ~5mm cubes"
}
```

### CookingStep (Instruction with Sensory Detail)
```typescript
{
  stepNumber: number;
  instruction: string;
  containerReference?: string;   // "Add Bowl 1 (soffritto)"
  temperature?: string;          // "Medium-high (7 out of 10)"
  timeEstimate?: string;         // "3-5 minutes"
  sensoryCues: {
    visual?: string;             // "Onions translucent, not brown"
    audio?: string;              // "Gentle sizzling like light rain"
    aroma?: string;              // "Sweet, toasted, no burnt"
    texture?: string;            // "Soft when pressed with spatula"
  };
  progressionCheck: string;      // Detailed before-continuing checklist
}
```

## Backend Interface

### 5 Methods

```typescript
interface IAssistModeBackend {
  // Get or generate a guide (cached if recipe unchanged)
  getOrGenerateCookGuide(recipe: Recipe): Promise<CookGuide>;

  // Force regenerate (after prompt updates or user request)
  generateCookGuide(recipe: Recipe): Promise<CookGuide>;

  // Retrieve existing guide by ID
  getCookGuide(guideId: string): Promise<CookGuide | null>;

  // Delete a guide
  deleteCookGuide(guideId: string): Promise<void>;

  // Get all versions of guides for a recipe
  getCookGuidesForRecipe(recipeId: string): Promise<CookGuide[]>;
}
```

## AI Generation

Assist Mode uses Gemini to generate sensory-rich guides from recipes.

### System Prompt
Instructs Gemini to:
- Organize ingredients into prep containers with grouping rationale
- Include exact temperature guidance ("7 out of 10", "180°C")
- Provide multi-sensory cues (visual, audio, aroma, texture)
- Create clear progression checks before each step
- Use container references instead of ingredient names

### User Prompt
Passes recipe ingredients and instructions, requests JSON structure matching CookingStep schema.

### Caching Strategy
- Guide stored in Firestore `cookGuides` collection
- Recipe hash computed from ingredients + instructions
- If hash matches, existing guide returned without regeneration
- If recipe changes, new guide generated and stored

## Usage

### Basic Usage

```typescript
import { assistModeBackend, CookModeModule } from '@/modules/assist-mode';
import { Recipe } from '@/types/contract';

// In a recipe detail view:
async function startCooking(recipe: Recipe) {
  const guide = await assistModeBackend.getOrGenerateCookGuide(recipe);
  // Navigate to assist mode with guide
  <CookModeModule recipe={recipe} onClose={() => goBack()} />;
}
```

### UI Flow

1. **Prep Phase**
   - User sees `PrepPhaseView` with all prep groups
   - Each group is a collapsible card with ingredients list
   - Checkbox to mark each group as complete
   - "Ready?" button progresses to cooking phase

2. **Cooking Phase**
   - User sees `CookingStepView` for current step
   - Displays: instruction, container ref, temperature, sensory cues
   - `ProgressionCheck` component shows "before continuing" checklist
   - Back/Next buttons navigate between steps
   - Final screen celebrates completion

### Integration Points

**Where to expose assist mode:**

1. **Recipe Detail View** - "Start Cooking" or "Assist" tab
   ```tsx
   <Button onClick={() => startAssistMode(recipe)}>
     <ChefHat className="h-4 w-4 mr-2" />
     Start Cooking
   </Button>
   ```

2. **Quick Access** - Option in recipe header or action bar

3. **Mobile/Tablet** - Full-screen experience optimized for kitchen use

## Firestore Schema

```
firestore
└── cookGuides/
    └── {guideId}
        ├── id: string
        ├── recipeId: string
        ├── recipeTitle: string
        ├── recipeVersion: string
        ├── prepGroups: PrepGroup[]
        ├── steps: CookingStep[]
        ├── generatedAt: string
        └── generatedBy: string
```

## Design Decisions

### Why Separate Module?
- Recipe schema stays immutable
- Cook mode is derived/cached data
- Can evolve independently (new "modes" later: speed mode, beginner mode, etc.)
- Respects module boundary (read-only to recipes)

### Why Cache in Firestore?
- Guide generation takes ~3-5 seconds (Gemini API)
- Recipe hash detects stale guides automatically
- User gets instant experience on repeat visits
- Deleting recipe cascades to guides (optional cleanup)

### Sensory Cue Structure
Four dimensions (visual, audio, aroma, texture) chosen because:
- Accessible across multiple modalities (not all users "see" well)
- Covers typical sensory inputs in cooking
- Easy to display/filter in UI
- Optional fields for flexibility

### Progression Check Pattern
Explicit "before continuing" prompt (vs. implicit timing) because:
- Removes uncertainty ("is it done?")
- Reduces cooking anxiety
- Helps autistic users confirm readiness
- Provides fallback instruction if unsure

## Future Enhancements

### Short Term
- [ ] Settings toggle: Enable/disable sensory cue types
- [ ] Bookmark steps for later reference
- [ ] Note-taking during cook session
- [ ] Photo capture for each step (visual log)

### Medium Term
- [ ] Voice-guided mode (read steps aloud with TTS)
- [ ] Timer integration (pause/auto-advance options)
- [ ] Personal sensory preferences (hide certain cues)
- [ ] "Beginner Mode" with extra detail
- [ ] "Speed Mode" for experienced cooks

### Long Term
- [ ] Integration with kitchen IoT (timer, thermometer sync)
- [ ] Peer reviews/ratings of cook guides
- [ ] Community contrib of custom guides
- [ ] Export as PDF/print-friendly format

## Testing

### Manual Testing Checklist
- [ ] Generate guide for sample recipe (check sensory detail)
- [ ] Verify prep groups are logical and grouped
- [ ] Check that step temperatures are explicit
- [ ] Confirm progression checks are clear and actionable
- [ ] Test back/next navigation
- [ ] Verify guide caching (generate once, retrieve from cache)
- [ ] Test on mobile (touch-friendly step navigation)

### Edge Cases
- Recipe with no prep phase
- Very long recipes (15+ steps)
- Recipes with vague instructions
- Rapid back/forth navigation
- Network failure during generation

## British English & Terms

All UI text uses British English and culinary terms:
- "Hob" not "stovetop" → Temperature guidance will indicate hob position
- "Sauté" not "sauteuse" → Implied in cooking instructions
- "Whisk" not "beater" → In sensory cues
- "Soft" not "tender" → In texture descriptions

## Related Issues

- **#10** - Ryan Mode specification (this is the implementation)
- **#9** - Ready, Steady, Cook mode (could use cook guides)

