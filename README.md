
# SALT - Kitchen Systems

A technical culinary orchestrator for high-end domestic UK kitchens, powered by Gemini AI.

## 🏗 System Architecture
Salt follows a strict "Constitution" to ensure data integrity and logic preservation:
1. **The Law (`types/contract.ts`):** Immutable data schema.
2. **The Soul (`shared/backend/prompts.ts`):** The Head Chef's voice and culinary filters.
3. **The Brain (`modules/*/backend/base-*-backend.ts`):** Domain logic and AI synthesis per module.
4. **The Hands (`modules/*/backend/firebase-*-backend.ts`):** Firebase persistence per module.

**System services:** Auth, user access, kitchen settings, import/export, debug logging, and Firebase initialization live in `shared/backend/`.

## 🛠 Local Development

### 1. Environment Configuration
Salt requires a Gemini API Key. Set it in both places:

```bash
# Frontend (copy .env.example to .env)
VITE_GEMINI_API_KEY=your_key_here
```

```bash
# Firebase Functions (functions/.env.local)
GEMINI_API_KEY=your_key_here
```

- **Gemini Core:** Uses Gemini 3 Flash for text synthesis and 2.5 Flash for image generation.
- **Firebase Functions:** AI requests are proxied through Firebase Functions for secure API key management.

### 2. Standards Enforcement
- **British English:** All UI and AI outputs use British terminology (Hob, Whisk, Frying Pan).
- **Metric Units:** No cups/ounces. 100% grams, ml, and Celsius.
- **Culinary Filter:** AI ignores non-functional items (manuals, cases, cookbooks).

## 💾 Data Persistence (Firebase Emulators)

By default, the Firebase Emulators are ephemeral. To persist your data (recipes, images, users) across restarts:

1.  **Start with Persistence:**
    Always run `npm run emulators` (which runs `firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data`).

2.  **Save Data Manually:**
    To save your current state while the emulators are running (without stopping them), run:
    ```bash
    ./scripts/save-db.sh
    ```
    This exports the current Firestore and Storage state to `./emulator-data`.

3.  **Graceful Shutdown:**
    Stop the emulators with `Ctrl+C` to trigger the auto-export. Force-quitting the terminal may result in data loss.

## 💾 Data Portability
Salt is manifest-based. Use the **Export Backup** feature in the Admin panel to move your entire kitchen state between local and cloud environments.

## 📚 Documentation & Guidelines

**System-wide principles:** See [.github/copilot-instructions.md](./.github/copilot-instructions.md) for language (British English), units (Metric), architectural hierarchy, and non-negotiable rules.

**Modules:** Each module documents its scope and rules in its own README:
- [modules/recipes/README.md](./modules/recipes/README.md)
- [modules/shopping/README.md](./modules/shopping/README.md)
- [modules/inventory/README.md](./modules/inventory/README.md)
- [modules/planner/README.md](./modules/planner/README.md)
- [modules/kitchen-data/README.md](./modules/kitchen-data/README.md)
- [modules/ai/README.md](./modules/ai/README.md)
- [modules/admin/README.md](./modules/admin/README.md)

**Project notes:**
- [MODULES_MIGRATION_COMPLETE.md](./MODULES_MIGRATION_COMPLETE.md) — migration status
- [docs/TESTING.md](./docs/TESTING.md) — testing guidance
- [docs/contract-gate/](./docs/contract-gate/) — contract gate documentation

---
**v0.1.0-alpha** | Professional Culinary Orchestrator
