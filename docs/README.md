# SALT Documentation Hub

This directory contains comprehensive technical documentation for the Salt Kitchen System. All documents follow British English conventions and metric standards.

## 📚 Documentation Structure

### Architecture & Design
Core architectural principles, backend/frontend patterns, and data contracts.

- **[Backend Guidelines](./architecture/backend-guidelines.md)** — Firebase backend architecture, separation of intelligence from execution
- **[Frontend Guidelines](./architecture/frontend-guidelines.md)** — React patterns, module structure, responsive design
- **[Contract Guidelines](./architecture/contract-guidelines.md)** — Data schema rules, Zod validation, portability principles
- **[Firebase Implementation](./architecture/firebase-backend-implementation.md)** — Firebase-specific implementation details

### Module Specifications
Domain-specific rules for each major system module.

- **[Inventory Module](./modules/inventory-module-guidelines.md)** — Equipment management, AI candidate selection
- **[Planner Module](./modules/planner-module-guidelines.md)** — Meal planning, calendar integration
- **[Recipe Module](./modules/recipe-module-guidelines.md)** — Recipe generation, refinement mode, kitchen mode

### Development & Testing
Workflows for implementing features, testing, and managing changes.

- **[Change Management](./development/change-management.md)** — Feature implementation workflow, safety protocols
- **[Prompt Guidelines](./development/prompt-guidelines.md)** — AI persona maintenance, prompt engineering
- **[AI Development Guide](./development/ai-development-guide.md)** — Patterns and guardrails for AI-assisted development

### Deployment
Production deployment procedures and migration strategies.

- **[Migration Roadmap](./deployment/migration-roadmap.md)** — Production deployment checklist

## 🎯 Quick Navigation

### I want to...

**Add a new feature**
1. Read [Change Management](./development/change-management.md)
2. Follow the Contract → Prompt → Backend → Frontend workflow
3. Consult [AI Development Guide](./development/ai-development-guide.md) for AI-assisted implementation

**Modify the backend**
1. Review [Backend Guidelines](./architecture/backend-guidelines.md)
2. Check [Contract Guidelines](./architecture/contract-guidelines.md) for data shape changes
3. Update [Firebase Implementation](./architecture/firebase-backend-implementation.md) if needed

**Update a module**
1. Read the relevant module guideline
2. Follow [Change Management](./development/change-management.md) workflow
3. Test with Firebase emulators before production

**Change AI behavior**
1. Review [Prompt Guidelines](./development/prompt-guidelines.md)
2. Update `backend/prompts.ts` only
3. Test across all modules that use AI

**Deploy to production**
1. Follow [Migration Roadmap](./deployment/migration-roadmap.md)
2. Export backup from emulator environment
3. Import to production Firebase project

## 🏗 Architectural Overview

Salt follows a strict four-layer hierarchy:

1. **The Law** ([contract.ts](../types/contract.ts))
   - Immutable data schema using Zod validation
   - Defines all types, interfaces, and data shapes
   - Must never leak database-specific fields

2. **The Soul** ([prompts.ts](../backend/prompts.ts))
   - AI persona and behavior definitions
   - Enforces British English and metric standards
   - Contains all system instructions for Gemini

3. **The Brain** ([base-backend.ts](../backend/base-backend.ts))
   - Abstract base class with AI orchestration logic
   - Handles prompt assembly, JSON sanitization
   - Transport-agnostic, never modified during migrations

4. **The Hands** ([firebase-backend.ts](../backend/firebase-backend.ts))
   - Firebase implementation: Auth, Firestore, Storage, Functions
   - CRUD operations and AI request proxying
   - Concrete implementation of the ISaltBackend interface

## 🧪 Development Environment

### Local Development Stack
- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Firebase with local emulators (Auth, Firestore, Storage, Functions)
- **AI:** Gemini 2.0 Flash (text) and 2.5 Flash (images) via Firebase Functions
- **Data:** Offline-first architecture with Firestore persistence

### Firebase Emulator Setup
```bash
# Start emulators with data persistence
npm run emulators

# Save current state without stopping emulators
./scripts/save-db.sh

# Stop emulators (auto-exports data)
Ctrl+C
```

### Environment Configuration
Create `functions/.env.local`:
```
GEMINI_API_KEY=your_gemini_api_key
```

### Development Workflow
1. Start emulators: `npm run emulators`
2. Start dev server: `npm run dev`
3. Access app: `http://localhost:3000`
4. Firebase UI: `http://localhost:4000`

## 🔐 Data Portability

Salt uses a manifest-based architecture for complete data portability:
- Export system state via Admin panel → "Export Backup"
- JSON manifest contains recipes, equipment, plans, users, settings
- Import to any environment (local emulator or production Firebase)
- All timestamps stored as ISO 8601 strings for universality

## 📐 Non-Negotiable Principles

These rules apply to ALL code and documentation:

### Language
- **British English only:** Hob (not stovetop), Whisk (not beater), Courgette (not zucchini)
- **No assistant-speak:** AI is a "Head Chef", never says "As an AI..." or "How can I help?"
- **No tech-bleed:** Never expose technical terms in UI (no "JSON", "database", "array")

### Units
- **Metric only:** grams (g), millilitres (ml), Celsius (°C)
- **No imperial:** No cups, ounces, teaspoons, Fahrenheit

### Architecture
- **Contract is law:** All data operations validated with Zod schemas
- **Brain never changes:** Base backend logic preserved during persistence migrations
- **Single source of truth:** `types/contract.ts` defines all data shapes

## 🤖 AI-Assisted Development

Salt is architected for AI-assisted feature development. See [AI Development Guide](./development/ai-development-guide.md) for:
- Module patterns and templates
- Safety guardrails and validation rules
- Common pitfalls and prevention strategies
- Integration patterns for new features

## 📖 Document Conventions

- **File naming:** kebab-case with `.md` extension
- **Headers:** Use ATX-style headers (`#`, `##`, `###`)
- **Code blocks:** Always specify language (```typescript, ```bash)
- **Links:** Use relative paths from document location
- **Lists:** Use `-` for unordered, `1.` for ordered
- **Emphasis:** Use `**bold**` for critical rules, `*italics*` for technical terms

## 🔄 Keeping Documentation Current

When making code changes:
1. Update relevant documentation BEFORE or WITH the code change
2. Run through related docs to ensure consistency
3. Update this README if adding/removing documents
4. Follow [Change Management](./development/change-management.md) workflow

## 🚨 Emergency Procedures

**System won't start:**
- Check `functions/.env.local` has valid GEMINI_API_KEY
- Verify Firebase emulators are running on correct ports
- Clear browser cache/localStorage if data seems corrupted

**Data loss after emulator restart:**
- Check `emulator-data` folder exists with recent export
- Restart emulators with `--import` flag (included in `npm run emulators`)
- Restore from backup JSON if needed (Admin panel → Import State)

**AI not responding:**
- Verify Gemini API key is valid and has quota
- Check Firebase Functions logs in emulator UI
- Enable debug logging in Admin panel for detailed error messages

---

**For general project guidelines, see [guidelines.md](../guidelines.md)**
