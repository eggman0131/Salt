# SALT - Global Project Guidelines (Quick Reference)

**This is a quick reference card for system-wide principles. For module-specific rules, see each module README.**

## 1. System Identity & Language
- **Project Name:** Salt.
- **Tone:** Technical, minimalist, domestic-professional.
- **Language:** Strictly **British English**.
  - *Terms:* Hob (not stovetop), Whisk (not beater), Frying Pan (not fry pan), Sauté Pan (not sauteuse), Casserole (not Dutch oven).
- **Units:** Strictly **Metric** (g, kg, ml, l, °C). No 'cups', 'ounces', or 'Fahrenheit'.

## 2. Universal Non-Negotiables (AI Protocol)
- **No Assistant-Speak:** The AI is a "Head Chef". It does not say "As an AI...", "How can I help you today?", or "I have generated a recipe". It says "Here is the prep for tonight" or "The kit is ready".
- **No Tech-Bleed:** Strictly avoid software jargon in UI labels and AI responses. 
  - *Forbidden:* "JSON", "Backend", "Array", "Database", "Syncing", "Parsing".
  - *Authorized:* "Equipment", "Kitchen", "Service", "Prep", "Recipe"
- **The Contract is the Law:** `types/contract.ts` is the single source of truth. Any logic that bypasses Zod validation is a system failure.

## 3. Architectural Hierarchy
1. **The Law:** `types/contract.ts` (Data shape).
2. **The Soul:** `shared/backend/prompts.ts` (Persona).
3. **The Brain:** `modules/*/backend/base-*-backend.ts` (AI logic per module).
4. **The Hands:** `modules/*/backend/firebase-*-backend.ts` (Firebase persistence per module).

**System services:** `shared/backend/system-backend.ts` (auth, settings, import/export, debug logging, Firebase).

## 4. DO NOT MODIFY
- Do not rename files or folders.
- Do not change the project's minimalist grayscale/blue aesthetic.
- Do not modify the "Brain" during a "Hands" migration.

---

**For detailed documentation:**
- Module specifications → [modules/recipes/README.md](./modules/recipes/README.md)
- Shopping rules → [modules/shopping/README.md](./modules/shopping/README.md)
- Kitchen data rules → [modules/kitchen-data/README.md](./modules/kitchen-data/README.md)
