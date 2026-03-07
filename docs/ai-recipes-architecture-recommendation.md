# AI Module & Recipes Module Ownership Boundaries

**Architectural Decision:** There should be **NO separate AI module**. Each domain module owns its own AI calls.

---

## The Real Pattern (How It Actually Works)

```
Domain Module → Cloud Functions → AI Provider (Gemini)
     ↓                ↓                   ↓
  - Prompts    - Model selection   - API calls
  - Schema     - Token auth        - Streaming
  - Parsing    - Error handling    - Rate limits
  - UI         - Retry logic       - Cost control
```

**Key Architecture Rules:**

1. **Cloud Functions own AI provider abstraction** - Model swapping happens there
2. **Each module owns its domain-specific AI needs** - Prompts, schemas, parsing
3. **No shared AI layer** - Self-contained modules only
4. **UI components live with the module** - Recipe chat UI belongs in recipes module

---

## Current State Analysis

### `modules/ai/` (Misnamed & Misplaced)

**What it actually contains:**
- Recipe-specific chat UI components only
- Imports `recipesBackend.chatWithRecipe()`
- Zero AI logic, zero prompts, zero transport

**The problem:**
- ❌ Name implies general-purpose AI service (false advertising)
- ❌ Only serves recipes module (not reusable)
- ❌ Other modules (canon, inventory) don't use it
- ❌ Violates module self-containment principle
- ❌ Creates false dependency (recipes → ai → recipes)

**What it should be:**
- Just part of `modules/recipes/ui/`

---

## How Modules Actually Handle AI

### Canon Module (modules_new/canon/) ✅ CORRECT PATTERN

**File:** `data/aiParseIngredients.ts`

```typescript
export async function callAiParseIngredients(
  lines: string[],
  aisleDescriptions: Record<string, string>,
  unitDescriptions: Record<string, string>
) {
  // 1. Module owns its prompts
  const { systemInstruction } = buildPromptScaffold(
    aisleDescriptions,
    unitDescriptions
  );
  
  // 2. Direct Cloud Function call
  const callable = httpsCallable(functions, 'cloudGenerateContent');
  const result = await callable({
    idToken,
    params: {
      model: 'gemini-3.1-flash-lite-preview', // Module chooses model
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { systemInstruction, responseMimeType: "application/json" }
    }
  });
  
  // 3. Module owns its parsing
  return parseAiJsonWithRepair(result.data.text);
}
```

**Why this works:**
- ✅ Self-contained (can remove canon without touching other modules)
- ✅ Owns prompts (ingredient parsing prompts stay with canon logic)
- ✅ Owns parsing (JSON repair specific to ingredient schema)
- ✅ Model selection per-module (env var: `VITE_CANON_AI_PARSE_MODEL`)
- ✅ No shared dependencies (except Cloud Functions transport)

---

### Recipes Module (modules/recipes/) ⚠️ LEGACY PATTERN

**Files:** `backend/base-recipes-backend.ts`, `backend/firebase-recipes-backend.ts`

```typescript
// base-recipes-backend.ts (AI logic)
async generateRecipeFromPrompt(...) {
  const systemInstruction = await this.getSystemInstruction();
  const response = await this.callGenerateContent({
    model: 'gemini-3-flash-preview',
    contents: [...],
    config: { systemInstruction }
  });
}

// firebase-recipes-backend.ts (transport)
protected async callGenerateContent(params) {
  const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');
  return await cloudGenerateContent({ idToken, params });
}
```

**Problems:**
- ⚠️ Uses `shared/backend/prompts.ts` (breaks self-containment)
- ⚠️ Abstract backend pattern (unnecessary indirection)
- ⚠️ Separate "AI module" UI components (circular dependency)

**Should be like canon:**
- Move AI calls to `modules/recipes/data/recipe-ai.ts`
- Own prompts in module
- UI components in `modules/recipes/ui/`

---

## Recommendation: Dissolve the AI Module

### Action Items

**1. Move AI module UI components into recipes module**

```bash
# Current (wrong)
modules/ai/
  components/
    AIModule.tsx              # Recipe chat UI
    
modules/recipes/
  components/
    RecipeEditor.tsx
    
# Target (correct)
modules/recipes/
  components/
    RecipeEditor.tsx
    RecipeChat.tsx            # ← moved from ai module
    RecipeDraftConsensus.tsx  # ← moved from ai module
```

**2. Eliminate `modules/ai/` entirely**
- It serves no architectural purpose
- Creates false abstraction
- Only confuses ownership

**3. Move recipes AI logic to match canon pattern**

```typescript
// NEW: modules/recipes/data/recipe-ai.ts
export async function generateRecipeFromPrompt(
  prompt: string,
  userId: string
): Promise<Recipe> {
  const user = auth.currentUser;
  const idToken = await user.getIdToken();
  
  // 1. Own prompts (move from shared/backend/prompts.ts)
  const systemInstruction = buildRecipeSystemPrompt();
  
  // 2. Direct Cloud Function call
  const callable = httpsCallable(functions, 'cloudGenerateContent');
  const result = await callable({
    idToken,
    params: {
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { systemInstruction, responseMimeType: "application/json" }
    }
  });
  
  // 3. Own parsing and validation
  const parsed = parseRecipeJson(result.data.text);
  const validated = validateRecipeDraft(parsed);
  
  // 4. Own orchestration (categorization + canon matching)
  const categories = await categorizeRecipe(validated);
  const matched = await matchRecipeIngredients(validated.ingredients);
  
  // 5. Own persistence
  return await createRecipe({
    ...validated,
    categoryIds: categories,
    ingredients: matched,
    createdBy: userId
  });
}

export async function chatWithRecipe(
  recipe: Recipe,
  message: string,
  history: ChatMessage[]
): Promise<AsyncIterable<string>> {
  // Same pattern: own prompts, direct Cloud Function, own parsing
}
```

**4. Eliminate shared prompts file**

```typescript
// DELETE: shared/backend/prompts.ts
// Problem: Creates cross-module dependency

// REPLACE WITH: Each module owns its prompts
modules/recipes/data/recipe-prompts.ts
modules/canon/data/canon-prompts.ts (if needed)
modules/inventory/data/inventory-prompts.ts (if needed)
```

**5. Remove backend abstraction (optional cleanup)**

The `BaseRecipesBackend` / `FirebaseRecipesBackend` pattern was designed for backend swapping (Firebase vs Simulation). If you're standardizing on Firebase:

```typescript
// BEFORE (abstraction)
abstract class BaseRecipesBackend { ... }
class FirebaseRecipesBackend extends BaseRecipesBackend { ... }

// AFTER (direct)
modules/recipes/data/
  recipe-crud.ts        # Firestore CRUD operations
  recipe-ai.ts          # AI generation/chat
  recipe-images.ts      # Image handling
```

---

## Benefits of This Architecture

### 1. **True Module Independence**
```bash
# Can move/remove canon without touching recipes
$ mv modules_new/canon packages/canon-module

# Can move/remove recipes without touching anything else
$ mv modules/recipes packages/recipe-module
```

Each module is a self-contained unit:
- Owns data schema
- Owns business logic
- Owns AI prompts
- Owns UI components
- Owns persistence

### 2. **Clear AI Provider Abstraction**

**ONLY Cloud Functions know about Gemini:**
```typescript
// functions/src/cloudGenerateContent.ts
const { GoogleGenerativeAI } = require('@google/genai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.cloudGenerateContent = functions.https.onCall(async (data) => {
  const { model, contents, config } = data.params;
  const generativeModel = genAI.getGenerativeModel({ model, ...config });
  return await generativeModel.generateContent(contents);
});
```

**To swap providers (Gemini → Claude → GPT):**
- ✅ Change Cloud Function implementation only
- ✅ Zero frontend changes needed
- ✅ Modules don't know or care about AI provider

### 3. **Model Selection Per-Module**
```bash
# .env
VITE_CANON_AI_PARSE_MODEL=gemini-3.1-flash-lite-preview
VITE_RECIPE_AI_MODEL=gemini-3-flash-preview
VITE_INVENTORY_AI_MODEL=gemini-2.5-flash
```

Each module can optimize for its use case:
- Canon: fast, cheap parsing → lite model
- Recipes: quality generation → standard model
- Inventory: multimodal → vision model

### 4. **No Shared Coupling**

**Current problem:**
```typescript
// shared/backend/prompts.ts
export const RECIPE_PROMPTS = { ... }

// modules/recipes uses it
// modules/assist-mode uses it
// Changing RECIPE_PROMPTS breaks both modules
```

**After:**
```typescript
// modules/recipes/data/recipe-prompts.ts
export const RECIPE_PROMPTS = { ... }

// ONLY recipes uses it
// Can change prompts without breaking anything else
```

---

## Migration Path

### Phase 1: Move AI Module UI to Recipes ✅
```bash
1. Move components:
   modules/ai/components/AIModule.tsx 
   → modules/recipes/components/RecipeChat.tsx

2. Update imports in RecipeEditor.tsx

3. Delete modules/ai/
```

### Phase 2: Extract Recipes Prompts ✅
```bash
1. Create modules/recipes/data/recipe-prompts.ts

2. Copy RECIPE_PROMPTS from shared/backend/prompts.ts

3. Update recipes backend to import from own prompts

4. Test recipe generation still works
```

### Phase 3: Simplify Recipes AI Data Layer ✅
```bash
1. Create modules/recipes/data/recipe-ai.ts

2. Move AI methods from base-recipes-backend.ts
   - generateRecipeFromPrompt()
   - chatWithRecipe()
   - summarizeAgreedRecipe()
   - chatForDraft()
   - generateRecipeImage()
   - importRecipeFromUrl()

3. Convert to direct Cloud Function calls (like canon pattern)

4. Update recipes/index.ts to export these functions
```

### Phase 4: Clean Up Backend Abstraction (Optional) ⏳
```bash
1. Evaluate if Firebase/Simulation swapping still needed

2. If Firebase-only:
   - Flatten backend files into data/ layer
   - Remove abstract base classes
   - Direct Firestore calls only

3. Keep if simulation mode still valuable for testing
```

### Phase 5: Remove Shared Prompts ✅
```bash
1. Check if any modules still use shared/backend/prompts.ts

2. Move remaining prompts to their respective modules

3. Delete shared/backend/prompts.ts

4. Update all imports
```

---

## Final State

### Directory Structure
```
modules/recipes/
  data/
    recipe-crud.ts          # Firestore CRUD
    recipe-ai.ts            # AI generation/chat (direct Cloud Function calls)
    recipe-images.ts        # Image handling
    recipe-prompts.ts       # Recipe-specific prompt templates
  logic/
    recipe-validation.ts    # Recipe validation rules
    recipe-transforms.ts    # Data transformations
  ui/
    RecipeEditor.tsx        # Recipe editing UI
    RecipeChat.tsx          # Chat UI (formerly in ai module)
    RecipeImageGen.tsx      # Image generation UI
  api.ts                    # Public API
  types.ts                  # Recipe-specific types
  README.md                 # Module contract

modules_new/canon/
  data/
    firebase-provider.ts    # Canon CRUD
    aiParseIngredients.ts   # AI parsing (direct Cloud Function calls)
    match-provider.ts       # Matching logic
  logic/
    matching.ts             # Pure matching algorithms
  ui/
    admin/
      CanonItemsAdmin.tsx   # Canon CRUD UI
  api.ts                    # Public API
  types.ts                  # Canon-specific types
  README.md                 # Module contract

// NO modules/ai/ - doesn't exist anymore
// NO shared/backend/prompts.ts - doesn't exist anymore
```

### Module Interaction
```typescript
// Recipes generates recipe with AI
const recipe = await generateRecipeFromPrompt(userPrompt, userId);

// Recipes calls Canon for ingredient matching (cross-module)
import { matchRecipeIngredients } from '../canon/api';
const matched = await matchRecipeIngredients(ingredients);

// Recipes writes matched ingredients to recipes collection (own data)
await updateRecipe(recipe.id, { ingredients: matched });
```

**Each module:**
- Makes own AI calls (via Cloud Functions)
- Owns own prompts
- Calls other modules via public APIs only
- Never writes another module's data

---

## Summary: The Answer

**Q: Should AI be a separate module?**  
**A: No. It already isn't - it's just misnamed UI components.**

**Q: Where should recipes module's AI logic live?**  
**A: In `modules/recipes/data/recipe-ai.ts` - same pattern as canon.**

**Q: What about shared prompts?**  
**A: Eliminate them. Each module owns its prompts. Shared state breaks module independence.**

**Q: What about the current AI module?**  
**A: Dissolve it. Move UI components into recipes. Delete the module.**

**Q: How do modules swap AI providers?**  
**A: They don't. Cloud Functions handle that. Modules just call `cloudGenerateContent()`.**

---

## The Law

**From salt-architecture.md:**

> Domain modules own their data, logic, persistence, and UI.  
> Service modules provide cross-cutting functionality without owning data.  
> Modules interact only via public APIs.

**AI is NOT a service** - it's infrastructure (Cloud Functions).  
**Each domain module owns its AI needs** - prompts, schemas, parsing.  
**No central AI module** - violates module independence.
