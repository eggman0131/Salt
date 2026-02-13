
# SALT - Recipe Module Guidelines

This document defines the domain logic, AI protocols, and execution standards for the Recipe Module.

## 1. The Dual-Mode Paradigm
Every recipe view must support two distinct, switchable states.

### A. Refine Mode (The Architect)
- **Visuals:** High information density. 
- **Focus:** Ingredients list, technical metadata (time/servings), and version history.
- **AI Role:** The "Sous-Chef" chat is active here for discussing modifications.

### B. Kitchen Mode (The Execution)
- **Visuals:** 150% font scale for instructions. 
- **Focus:** Single-step focus, oversized touch targets (min 60px), and progress tracking.
- **Interactions:** "Mise en Place" checklist must be completed or acknowledged before the first instruction step appears.

## 2. AI Consensus Workflow
The AI must never update a recipe document directly from a chat message. It follows this strict chain:
1. **The Discussion:** Natural language chat between User and AI.
2. **The Consensus:** AI generates a `Consensus Draft` (JSON) summarizing agreed changes.
3. **The Synthesis:** AI uses the draft to generate the final `Recipe` object.
4. **The Snapshot:** A lean history entry is created before saving the update.

## 3. Data Integrity
- **Object Pruning:** Before sending objects to Gemini or creating history snapshots, ensure recursive metadata (like the `history` array itself) is pruned to keep data structures manageable.
- **Metric Enforcement:** If the AI suggests 'cups', the backend must reject the update and request a re-conversion to grams (g) or millilitres (ml).

## 4. External Recipe Import
The AI Module supports importing recipes from external web addresses.

### A. Import Workflow
1. **User Input:** User provides a recipe web address in the dedicated import field.
2. **Transport:** `SaltFirebaseBackend.fetchUrlContent()` calls the `cloudFetchRecipeUrl` Cloud Function to retrieve the page content.
3. **Extraction:** The Cloud Function attempts to extract recipe data from JSON-LD schema markup. If unavailable, it returns cleaned HTML.
4. **Conversion:** `BaseSaltBackend.importRecipeFromUrl()` orchestrates AI conversion using the `RECIPE_PROMPTS.externalRecipe` template.
5. **Strict Preservation:** The AI keeps ingredients and instructions EXACTLY as written, only converting US units to UK metric and adapting equipment references to the user's inventory.

### B. Conversion Rules
- **Ingredients:** Preserve exact quantities and items. Convert cups/ounces/Fahrenheit to grams/ml/Celsius.
- **Instructions:** Keep method steps verbatim. Only adapt equipment names (e.g., "Dutch oven" → user's casserole).
- **British Terminology:** Replace US ingredient names (zucchini→courgette, cilantro→coriander).
- **NO IMPROVEMENTS:** This is a strict conversion, not a rewrite. The AI must not add, remove, or optimize steps.

### C. Technical Notes
- The Cloud Function is required to avoid CORS restrictions when fetching external URLs.
- The function includes rate limiting and authentication checks to prevent abuse.
- JSON-LD schema.org Recipe markup is preferred for extraction accuracy.

## 5. DO NOT MODIFY
- Do not allow the AI to suggest non-UK ingredients (e.g. Zucchini instead of Courgette).
- Do not remove the "Safety Snapshot" logic when restoring old versions from history.
- Do not bypass the Cloud Function for URL fetching (client-side fetch will fail due to CORS).
