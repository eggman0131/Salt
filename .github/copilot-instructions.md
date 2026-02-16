# Copilot Instructions for Salt

## Project Identity

**Salt** is a technical culinary orchestrator for high-end domestic UK kitchens, powered by Gemini AI. The system is a React/TypeScript application with Firebase backend and a sophisticated AI-powered recipe and inventory management system.

## The Constitution (Non-Negotiables)

Salt follows a strict hierarchy to ensure data integrity:

1. **The Law** (`types/contract.ts`) - Immutable data schema, the single source of truth
2. **The Soul** (`shared/backend/prompts.ts`) - The Head Chef's voice and culinary filters
3. **The Brain** (`shared/backend/base-backend.ts`) - Domain logic and AI synthesis engine
4. **The Hands** (`shared/backend/firebase-backend.ts`) - The persistence layer

**Hierarchy Rule:** Never modify "The Brain" during "The Hands" migration. The Contract is the law — any logic that bypasses Zod validation is a system failure.

## Language and Cultural Requirements

### Strictly British English
- **Terms:** Hob (not stovetop), Whisk (not beater), Frying Pan (not fry pan), Sauté Pan (not sauteuse), Casserole (not Dutch oven)
- All UI text, AI outputs, and documentation must use British spelling and terminology

### Strictly Metric Units
- Use g, kg, ml, l, °C exclusively
- **Never use:** cups, ounces, Fahrenheit
- All measurements in code and AI outputs must be metric

## AI Protocol (Non-Negotiables)

### No Assistant-Speak
The AI is a "Head Chef", not an assistant. It does **not** say:
- ❌ "As an AI..."
- ❌ "How can I help you today?"
- ❌ "I have generated a recipe"

Instead, it says:
- ✅ "Here is the prep for tonight"
- ✅ "The kit is ready"

### No Tech-Bleed
Strictly avoid software jargon in UI labels and AI responses.

**Forbidden terms:** "JSON", "Backend", "Array", "Database", "Syncing", "Parsing"
**Authorized terms:** "Equipment", "Kitchen", "Service", "Prep", "Recipe"

### Culinary Filter
The AI ignores non-functional items: manuals, cases, cookbooks. Focus on actual kitchen equipment and ingredients.

## Module Architecture

Salt uses a **modular architecture**. Each module is self-contained with its own components, backend logic, and documentation.

```
modules/
  shopping/          ← Shopping lists and items
  recipes/           ← Recipe management and AI generation
  kitchen-data/      ← Units, Aisles, Categories, Canonical Items
  planner/           ← Meal planning
  inventory/         ← Inventory management
  admin/             ← System administration
  ai/                ← AI chat interface

shared/              ← Cross-module code (UI, hooks, backend foundation)
types/contract.ts    ← The Law (all modules import from here)
```

### Working in Modules

**When working in a specific module:**
1. Read that module's `README.md` first (e.g., `modules/shopping/README.md`)
2. Respect module boundaries - only import from:
   - The module you're in
   - `shared/*`
   - `types/contract.ts`
3. **DO NOT** import from other modules' internals
4. **DO NOT** modify files outside your current module without explicit permission

**If you need shared functionality:**
- Put it in `shared/` if used by multiple modules
- Keep it in the module if only used there

### Module Dependencies

- All modules → `types/contract.ts` (The Law)
- All modules → `shared/components` (UI library)
- All modules → `shared/backend` (API transport)
- `shopping` → `kitchen-data` (read-only: units, aisles)
- `planner` → `recipes` (read-only: recipe data)
- `planner` → `shopping` (can create lists)

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS 4 (minimalist grayscale/blue aesthetic)
- **AI:** Google Gemini (3 Flash for text, 2.5 Flash for images)
- **Backend:** Firebase (Firestore, Storage, Functions)
- **Validation:** Zod schemas in `types/contract.ts`
- **Testing:** Playwright

## Code Standards

### Type Safety
- All data must conform to Zod schemas in `types/contract.ts`
- No `any` types unless absolutely necessary
- Use TypeScript strict mode

### File Organization
- Keep the existing file structure intact within each module
- Do not rename files or folders without explicit discussion
- Follow the architectural hierarchy (Law → Soul → Brain → Hands)

### Styling
- Maintain the minimalist grayscale/blue aesthetic
- Use existing Tailwind classes and design patterns
- Consistent with existing UI components

### Comments
- Add comments only when necessary to explain complex logic
- Avoid obvious comments
- Match the style of existing comments in the codebase

## Development Workflow

### Environment Setup
- Gemini API Key required: `process.env.API_KEY`
- Backend mode configured in `.env`: `VITE_BACKEND_MODE=simulation` or `firebase`

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run emulators` - Start Firebase emulators with persistence
- `npm run parity` - Run parity checks between backends

### Firebase Emulators
- Always use `npm run emulators` for persistence
- Use `./scripts/save-db.sh` to save state while running
- Graceful shutdown (Ctrl+C) triggers auto-export

## Critical Rules (DO NOT MODIFY)

1. **Never modify `types/contract.ts` without understanding system-wide impact**
2. **Never change project aesthetic (grayscale/blue minimalism)**
3. **Never bypass Zod validation**
4. **Never use non-metric units**
5. **Never use American English spelling or culinary terms**
6. **Never use tech jargon in user-facing strings**
7. **Never make the AI sound like an assistant**
8. **Never import from another module's internals**

## Data Portability

Salt is manifest-based. The Export Backup feature in the Admin panel moves entire kitchen state between environments. Preserve this functionality when making changes.

## Testing Requirements

- Test UI changes manually
- Run `npm run parity` after backend changes
- Verify British English and metric units in all outputs
- Ensure Zod schema validation works correctly

## When Making Changes

1. Read the module's `README.md` if working in a module
2. Understand the architectural hierarchy
3. Maintain type safety with Zod schemas
4. Test with both simulation and Firebase backends
5. Verify British English and metric units
6. Keep changes minimal and focused
7. Document any new patterns or conventions in the module's README
