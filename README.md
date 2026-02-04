
# SALT - Kitchen Systems

A technical culinary orchestrator for high-end domestic UK kitchens, powered by Gemini AI.

## 🏗 System Architecture
Salt follows a strict "Constitution" to ensure data integrity and logic preservation:
1. **The Law (`types/contract.ts`):** Immutable data schema.
2. **The Soul (`backend/prompts.ts`):** The Head Chef's voice and culinary filters.
3. **The Brain (`backend/base-backend.ts`):** Domain logic and AI synthesis engine.
4. **The Hands (`backend/simulated.ts`):** The persistence layer (Simulation or Firebase).

## 🛠 Local Development

### 1. Environment Configuration
Salt requires a Gemini API Key. Use `process.env.API_KEY` for the execution context.
- **Gemini Core:** Uses Gemini 3 Flash for text synthesis and 2.5 Flash for image generation.
- **Local Proxy:** The dev server automatically injects the key into the environment.

### 2. Backend Selection
Switch between local simulation and cloud persistence in `.env`:
`VITE_BACKEND_MODE=simulation` (Default)
`VITE_BACKEND_MODE=firebase`

### 3. Standards Enforcement
- **British English:** All UI and AI outputs use British terminology (Hob, Whisk, Frying Pan).
- **Metric Units:** No cups/ounces. 100% grams, ml, and Celsius.
- **Culinary Filter:** AI ignores non-functional items (manuals, cases, cookbooks).

## 💾 Data Portability
Salt is manifest-based. Use the **Export Backup** feature in the Admin panel to move your entire kitchen state between local and cloud environments.

---
**v0.1.0-alpha** | Professional Culinary Orchestrator
