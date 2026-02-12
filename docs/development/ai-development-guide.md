# SALT - AI Development Guide

This document provides patterns, guardrails, and best practices for AI-assisted development in the Salt Kitchen System. Follow these guidelines to add new features and modules while preserving system integrity.

## 🎯 Core Principles

### 1. The Sacred Order
Always follow this hierarchy when making changes:
1. **Contract First** (`types/contract.ts`) — Define data shapes and types
2. **Prompts Second** (`backend/prompts.ts`) — Define AI behavior if needed
3. **Backend Third** (`backend/base-backend.ts` or `backend/firebase-backend.ts`) — Implement logic
4. **Frontend Last** (components/, pages/) — Build UI

**Why?** This ensures data integrity propagates from the foundation upward. Changes flow downstream naturally; upstream changes break everything.

### 2. The Immutability Principle
- `types/contract.ts` is the law — never bypass or violate schemas
- `backend/prompts.ts` is the soul — never dilute the persona
- `backend/base-backend.ts` is the brain — never add persistence logic here
- British English and Metric units — never compromise

### 3. The Separation Principle
- **AI Logic** lives in `base-backend.ts` (abstract, transport-agnostic)
- **Persistence Logic** lives in `firebase-backend.ts` (concrete, Firebase-specific)
- Never mix these concerns or the abstraction collapses

## 🛡️ Safety Guardrails

### Critical "DO NOT" Rules

**Contract Violations:**
- ❌ Do NOT add `any` types (except explicitly permitted for history snapshots)
- ❌ Do NOT change ID prefixes (`eq-`, `rec-`, `plan-`)
- ❌ Do NOT add database-specific fields to schemas
- ❌ Do NOT skip Zod validation on external data
- ❌ Do NOT use JavaScript `Date` objects (use ISO 8601 strings)

**Architecture Violations:**
- ❌ Do NOT modify `base-backend.ts` when adding Firebase features
- ❌ Do NOT instantiate Gemini SDK in the base class
- ❌ Do NOT leak Firestore `Timestamp` objects into the contract
- ❌ Do NOT bypass the ISaltBackend interface
- ❌ Do NOT add persistence code to UI components

**Language/Unit Violations:**
- ❌ Do NOT use American English (stovetop → hob, zucchini → courgette)
- ❌ Do NOT use imperial units (cups, ounces, Fahrenheit)
- ❌ Do NOT use assistant-speak in AI responses ("As an AI...", "How can I help?")
- ❌ Do NOT expose technical jargon in UI ("JSON", "database", "array")

**Persona Violations:**
- ❌ Do NOT make AI chatty or conversational
- ❌ Do NOT make AI apologetic or uncertain
- ❌ Do NOT make AI reference its own limitations
- ✅ DO make AI precise, minimalist, professional (like a Head Chef)

## 📋 Module Development Template

### Adding a New Module (e.g., "Wine Cellar")

#### Step 1: Define the Contract
```typescript
// types/contract.ts

// Add the data schema
export const WineSchema = z.object({
  id: z.string(),
  name: z.string(),
  vintage: z.number(),
  region: z.string(),
  quantity: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type Wine = z.infer<typeof WineSchema>;

// Update SystemStateSchema to include wines
export const SystemStateSchema = z.object({
  // ... existing fields ...
  wines: z.array(WineSchema).default([])
});
```

#### Step 2: Add AI Prompts (if needed)
```typescript
// backend/prompts.ts

export const WINE_RECOMMENDATION = {
  system: SYSTEM_CORE,
  query: (recipeName: string, wines: Wine[]) => `
Review this recipe: ${recipeName}

Available wines in the cellar:
${wines.map(w => `- ${w.name} (${w.vintage}, ${w.region})`).join('\n')}

Recommend a wine pairing. Use British terminology. Be concise.
`
};
```

#### Step 3: Add Backend Methods
```typescript
// backend/base-backend.ts (if AI logic needed)

abstract class BaseSaltBackend {
  // ... existing methods ...
  
  protected async generateWinePairing(
    recipeName: string,
    wines: Wine[]
  ): Promise<string> {
    const prompt = WINE_RECOMMENDATION.query(recipeName, wines);
    const response = await this.callGenerateContent(prompt, WINE_RECOMMENDATION.system);
    return response;
  }
}

// backend/firebase-backend.ts (concrete CRUD)

class SaltFirebaseBackend extends BaseSaltBackend {
  // ... existing methods ...
  
  async getWines(): Promise<Wine[]> {
    const snapshot = await getDocs(collection(this.db, 'wines'));
    return snapshot.docs.map(doc => WineSchema.parse({
      id: doc.id,
      ...doc.data()
    }));
  }
  
  async addWine(wine: Omit<Wine, 'id' | 'createdAt' | 'updatedAt'>): Promise<Wine> {
    const docRef = doc(collection(this.db, 'wines'));
    const now = new Date().toISOString();
    const newWine: Wine = {
      id: docRef.id,
      ...wine,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, newWine);
    return newWine;
  }
}
```

#### Step 4: Build UI Component
```tsx
// components/WineModule.tsx

import { useState, useEffect } from 'react';
import { saltBackend } from '../backend/api';
import type { Wine } from '../types/contract';

export function WineModule() {
  const [wines, setWines] = useState<Wine[]>([]);
  
  useEffect(() => {
    loadWines();
  }, []);
  
  async function loadWines() {
    const loaded = await saltBackend.getWines();
    setWines(loaded);
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Wine Cellar</h1>
      <div className="space-y-2">
        {wines.map(wine => (
          <div key={wine.id} className="p-4 bg-white rounded shadow">
            <h2 className="font-semibold">{wine.name}</h2>
            <p className="text-sm text-gray-600">{wine.vintage} • {wine.region}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Step 5: Update Firestore Rules
```
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... existing rules ...
    
    match /wines/{wineId} {
      allow read, write: if isAuthorized();
    }
  }
}
```

#### Step 6: Update Export/Import
```typescript
// backend/firebase-backend.ts

async exportSystemState(): Promise<SystemState> {
  const [recipes, inventory, plans, users, wines] = await Promise.all([
    this.getRecipes(),
    this.getEquipment(),
    this.getPlans(),
    this.getUsers(),
    this.getWines() // ← Add this
  ]);
  
  return {
    recipes,
    inventory,
    plans,
    users,
    wines, // ← Add this
    kitchenSettings: await this.getKitchenSettings()
  };
}

async importSystemState(state: SystemState): Promise<void> {
  // ... existing imports ...
  
  // Import wines
  for (const wine of state.wines || []) {
    await this.addWine(wine);
  }
}
```

## 🧩 Common Patterns

### Pattern: Adding a Field to Existing Schema

**1. Update the Zod schema:**
```typescript
// types/contract.ts
export const RecipeSchema = z.object({
  // ... existing fields ...
  dietaryNotes: z.string().optional() // ← New field
});
```

**2. Handle migration in import:**
```typescript
// backend/firebase-backend.ts
async importSystemState(state: SystemState): Promise<void> {
  for (const recipe of state.recipes) {
    // Old data without dietaryNotes will pass through safely due to .optional()
    const validated = RecipeSchema.parse(recipe);
    await this.addRecipe(validated);
  }
}
```

**3. Update UI conditionally:**
```tsx
// components/RecipesModule.tsx
{recipe.dietaryNotes && (
  <p className="text-sm text-gray-600">{recipe.dietaryNotes}</p>
)}
```

### Pattern: Adding AI Generation

**1. Define prompt template:**
```typescript
// backend/prompts.ts
export const GENERATE_SHOPPING_LIST = {
  system: SYSTEM_CORE,
  query: (recipes: Recipe[], inventory: Equipment[]) => `
Generate a shopping list for these recipes:
${recipes.map(r => r.name).join(', ')}

Current inventory:
${inventory.map(e => e.name).join(', ')}

Output JSON array of items with: {name: string, quantity: string, unit: string}
Use British terminology. Metric units only.
`
};
```

**2. Add method to base backend:**
```typescript
// backend/base-backend.ts
protected async generateShoppingList(
  recipes: Recipe[],
  inventory: Equipment[]
): Promise<ShoppingItem[]> {
  const prompt = GENERATE_SHOPPING_LIST.query(recipes, inventory);
  const response = await this.callGenerateContent(prompt, GENERATE_SHOPPING_LIST.system);
  const items = JSON.parse(response);
  return z.array(ShoppingItemSchema).parse(items);
}
```

**3. Expose via concrete backend:**
```typescript
// backend/firebase-backend.ts
async getShoppingList(recipeIds: string[]): Promise<ShoppingItem[]> {
  const recipes = await Promise.all(recipeIds.map(id => this.getRecipe(id)));
  const inventory = await this.getEquipment();
  return this.generateShoppingList(recipes, inventory);
}
```

### Pattern: Validation & Error Handling

**Always validate external data:**
```typescript
async importSystemState(state: any): Promise<void> {
  // Validate entire structure
  const parsed = SystemStateSchema.safeParse(state);
  if (!parsed.success) {
    throw new Error(`Invalid state: ${parsed.error.message}`);
  }
  
  // Use validated data
  const validState = parsed.data;
  // ... import logic ...
}
```

**Handle Firebase errors gracefully:**
```typescript
async getRecipe(id: string): Promise<Recipe | null> {
  try {
    const docSnap = await getDoc(doc(this.db, 'recipes', id));
    if (!docSnap.exists()) return null;
    
    const recipe = RecipeSchema.parse({
      id: docSnap.id,
      ...docSnap.data()
    });
    return recipe;
  } catch (error) {
    debugLogger.error('Failed to get recipe:', error);
    throw new Error(`Recipe retrieval failed: ${error.message}`);
  }
}
```

## 🚨 Common Pitfalls & Prevention

### Pitfall: Leaking Firebase Types
**Problem:**
```typescript
// ❌ BAD: Firestore Timestamp in contract
export const Recipe = z.object({
  createdAt: z.instanceof(Timestamp) // ← Firebase-specific type
});
```

**Solution:**
```typescript
// ✅ GOOD: ISO 8601 string
export const Recipe = z.object({
  createdAt: z.string() // ← Universal format
});

// In Firebase backend:
const recipe = {
  ...data,
  createdAt: firestoreTimestamp.toDate().toISOString()
};
```

### Pitfall: Bypassing Validation
**Problem:**
```typescript
// ❌ BAD: Direct database write
await setDoc(doc(db, 'recipes', id), data);
```

**Solution:**
```typescript
// ✅ GOOD: Validate before write
const validated = RecipeSchema.parse(data);
await setDoc(doc(db, 'recipes', id), validated);
```

### Pitfall: Mixing Concerns
**Problem:**
```typescript
// ❌ BAD: Firestore query in base class
abstract class BaseSaltBackend {
  async getRecipe(id: string) {
    return await getDoc(doc(this.db, 'recipes', id)); // ← Database in brain!
  }
}
```

**Solution:**
```typescript
// ✅ GOOD: Abstract in base, concrete in subclass
abstract class BaseSaltBackend {
  abstract getRecipe(id: string): Promise<Recipe | null>;
}

class SaltFirebaseBackend extends BaseSaltBackend {
  async getRecipe(id: string): Promise<Recipe | null> {
    const docSnap = await getDoc(doc(this.db, 'recipes', id));
    // ... implementation ...
  }
}
```

### Pitfall: Forgetting Export/Import
**Problem:** Adding new collection but not updating portability methods.

**Solution:** Always update both:
```typescript
async exportSystemState(): Promise<SystemState> {
  return {
    recipes: await this.getRecipes(),
    inventory: await this.getEquipment(),
    newCollection: await this.getNewCollection() // ← Add this
  };
}

async importSystemState(state: SystemState): Promise<void> {
  for (const item of state.newCollection || []) {
    await this.addNewItem(item); // ← Add this
  }
}
```

## 📝 AI Assistant Prompting Tips

When working with AI assistants (GitHub Copilot, ChatGPT, etc.):

### ✅ Good Prompts
- "Add a `servings` field to the Recipe schema following contract guidelines"
- "Create a Firebase query for recipes updated in the last 7 days"
- "Generate a prompt for AI wine pairing using British terminology"
- "Add debug logging to the recipe generation flow"

### ❌ Bad Prompts
- "Make it better" (too vague)
- "Add cups as a unit option" (violates metric-only rule)
- "Use localStorage for recipes" (bypasses Firebase architecture)
- "Make the AI more friendly" (violates persona guidelines)

### Effective References
Always reference specific guideline files:
- "Following @backend-guidelines.md, add a method to..."
- "According to @contract-guidelines.md, update the schema..."
- "Using patterns from @recipe-module-guidelines.md, implement..."

## 🧪 Testing Checklist

Before committing new features:

- [ ] All Zod schemas validate successfully
- [ ] TypeScript compiles without errors
- [ ] Firebase emulators start without issues
- [ ] Export/import works with existing and new data
- [ ] Debug logging uses debugLogger (not console)
- [ ] British English terminology throughout
- [ ] Metric units only (no imperial)
- [ ] No Firebase types leak into contract
- [ ] UI works on mobile (responsive design)
- [ ] AI prompts maintain Head Chef persona

## 📚 Required Reading

Before implementing major features:
1. [Backend Guidelines](../architecture/backend-guidelines.md) — Architecture patterns
2. [Contract Guidelines](../architecture/contract-guidelines.md) — Data schema rules
3. [Change Management](./change-management.md) — Update workflow
4. [Prompt Guidelines](./prompt-guidelines.md) — AI persona maintenance
5. Relevant module guideline (Inventory/Planner/Recipe)

## 🆘 When Things Break

**Symptom: TypeScript errors after schema change**
→ Did you update the contract first? Rebuild the type hierarchy from contract → backend → frontend.

**Symptom: Firestore rules blocking operations**
→ Check emulator rules match production intent. Remember: emulators may have relaxed rules for development.

**Symptom: AI responses violate British English**
→ Review `backend/prompts.ts` — ensure SYSTEM_CORE is included in all AI calls.

**Symptom: Data not persisting between emulator restarts**
→ Check `emulator-data/` folder exists. Run `npm run emulators` (includes `--import` and `--export-on-exit`).

**Symptom: Can't import old backups**
→ Likely schema changed. Check Zod validation errors. Consider migration script or manual data transformation.

---

**Remember:** Salt is architected for stability and longevity. These guardrails exist to protect the system's integrity during rapid AI-assisted development. When in doubt, follow the Sacred Order: Contract → Prompts → Backend → Frontend.
