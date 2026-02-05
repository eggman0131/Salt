
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

## 📚 Documentation & Guidelines

**System-wide principles:** See [guidelines.md](./guidelines.md) for language (British English), units (Metric), architectural hierarchy, and non-negotiable rules.

**Comprehensive docs:** All detailed guidelines for architecture, modules, development, and deployment are organized in the [`docs/`](./docs/) folder:
- **[Architecture & Design](./docs/architecture/)** — Backend/frontend guidelines, contract, Firebase implementation plan
- **[Module Specifications](./docs/modules/)** — Inventory, Planner, Recipe module rules
- **[Development & Testing](./docs/development/)** — Change management, prompt guidelines, parity testing, method audit
- **[Deployment](./docs/deployment/)** — Migration roadmap and post-deployment checklist

**Start here:** [docs/README.md](./docs/README.md) for navigation and quick task reference.

---
**v0.1.0-alpha** | Professional Culinary Orchestrator
