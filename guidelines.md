# SALT - Global Project Guidelines (Quick Reference)

**This is a quick reference card for system-wide principles. For detailed guidelines by topic, see [docs/README.md](./docs/README.md).**

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
2. **The Soul:** `backend/prompts.ts` (Persona).
3. **The Brain:** `backend/base-backend.ts` (AI logic).
4. **The Hands:** `backend/firebase-backend.ts` (Firebase persistence with offline support).

## 4. DO NOT MODIFY
- Do not rename files or folders.
- Do not change the project's minimalist grayscale/blue aesthetic.
- Do not modify the "Brain" during a "Hands" migration.

---

**For detailed documentation:**
- Architecture & design rules → [docs/architecture/](./docs/architecture/)
- Module specifications → [docs/modules/](./docs/modules/)
- Development workflows & change management → [docs/development/](./docs/development/)
- Deployment & migration → [docs/deployment/](./docs/deployment/)
