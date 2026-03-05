# Copilot Instructions for Salt

## Project Identity

**Salt** is a technical culinary orchestrator for high-end domestic UK kitchens, powered by Gemini AI. The system is a React/TypeScript application with Firebase backend and a sophisticated AI-powered recipe and inventory management system.

## Architectural Authority

**Read this first:** [`docs/salt-architecture.md`](../docs/salt-architecture.md) — the canonical specification for module structure, boundaries, and interaction patterns.

This document provides project-specific guidelines; salt-architecture.md defines the structural rules.

## The Constitution (Non-Negotiables)

Salt follows a strict hierarchy to ensure data integrity:

1. **The Law** (`types/contract.ts`) - Immutable data schema, the single source of truth
2. **The Logic** (`modules_new/*/logic/`) - Pure, deterministic business logic (no I/O, no side effects)
3. **The Hands** (`modules_new/*/data/`) - Persistence layer (Firestore, Cloud Functions, API calls)
4. **UI** (`modules_new/*/ui/`) - Display only (imports only from module's public API)
5. **The Public API** (`modules_new/*/api.ts`) - The only entry point between layers

**Hierarchy Rule:** Never bypass this structure. The Contract is the law — any logic that bypasses Zod validation is a system failure.

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

Salt uses a **strict modular architecture** with three types of modules:

- **Domain modules** (`modules_new/canon`, `modules_new/recipes`, etc.) — own domain data and logic
- **Service modules** (`modules_new/ai`) — provide cross-cutting functionality without owning data
- **System modules** (`modules_new/admin`) — system-wide operations and tooling

See `docs/salt-architecture.md` for full module taxonomy.

### Standard Module Structure

Every module follows this layout:

```
modules_new/<module>/
  api.ts                # Public API (pure functions only)
  types.ts              # Module-specific types
  logic/                # Pure logic: transformations, calculations, validation
  data/                 # Persistence: Firestore, Cloud Functions
  ui/                   # UI components (imports only from api.ts)
  admin.manifest.ts     # Optional: admin tools
  README.md             # Module contract
  __tests__/            # Tests
```

**Core Rules:**
- UI imports **only** from `api.ts` (the public API)
- Logic is **pure** — no Firebase, no side effects, no I/O
- Data layer handles **all I/O** — Firestore reads/writes, Cloud Functions
- Logic and Data are **never called directly from UI**

### Working in Modules

**When working in a specific module:**
1. Read that module's `README.md` first (e.g., `modules_new/canon/README.md`)
2. Respect module boundaries — only import from:
   - The module you're in
   - `shared/*` (UI components, providers, utilities)
   - `types/contract.ts` (shared data schemas)
3. **Never** import from another module's internals
4. **Never** modify files outside your current module without explicit permission
5. **Always** preserve the Law → Logic → Data → UI hierarchy

**If you need shared functionality:**
- Put it in `shared/` if used by multiple modules
- Keep it in the module if only used there

**Module Dependencies (All modules):**
- ✅ `types/contract.ts` (The Law)
- ✅ `shared/components` (UI library)
- ✅ `shared/providers` (global context)
- ❌ Other modules' internals (break the module)

**Cross-module reads (read-only):**
- Domain modules may call other domain modules' public APIs (`api.ts`)
- Service modules never call domain internals
- System modules (admin) never call domain internals

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
- Follow the architectural hierarchy (Law → Logic → Data → UI)
- Place new code in the correct layer:
  - **schema changes** → `types/contract.ts`
  - **business logic** → `logic/`
  - **I/O operations** → `data/`
  - **components** → `ui/`

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

## Design System (UI Constitution)

All frontend development must adhere to the **Design System** — the UI equivalent of The Law.

**See:** [design-system.instructions.md](./design-system.instructions.md)

The design system covers:
- **Design Tokens** — Colours, spacing, radii, typography (never hardcode values)
- **Components** — Button styles, forms, badges, cards
- **Layout Primitives** — Page, Section, Stack, Card containers
- **Icons** — lucide-react standardization
- **Interaction Patterns** — Modals, inline editing, action bars, search
- **Mobile-First Responsive** — Breakpoint strategy and testing

**Key Rule:** All UI changes require token-based styling and shadcn/ui components. Hardcoded colours, arbitrary spacing, or custom CSS bypasses the design system and creates inconsistency.

When working on components:
1. Check if a pattern already exists in the design system
2. Use tokens for all colours and spacing
3. Test on mobile (375px), tablet (768px), and desktop (1024px)
4. Follow the checklists in `design-system.instructions.md` before shipping

## When Making Changes

1. Read the module's `README.md` if working in a module
2. Understand the architectural hierarchy
3. **Respect the Design System** for all UI work
4. Maintain type safety with Zod schemas
5. Test with both simulation and Firebase backends
6. Verify British English and metric units
7. Keep changes minimal and focused
8. Document any new patterns or conventions in the module's README

## Architectural Reference

For detailed rules on module structure, interaction patterns, and guarantees, **always consult:**
- [`docs/salt-architecture.md`](../docs/salt-architecture.md) — canonical structural rules
- Module `README.md` files — contract and ownership boundaries
- `types/contract.ts` — the Law (all schema definitions)
