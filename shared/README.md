# Shared Infrastructure

**Cross-module code for Salt**

This directory contains all shared code used across multiple Salt modules. Everything here follows the design system and is available for import by any module.

## 📁 Structure

```
shared/
├── backend/          # Backend services (Firebase, system, auth)
├── components/       # UI components (primitives, shadcn, animations)
│   ├── primitives/  # Layout components (Page, Section, Stack, etc.)
│   └── README.md    # Component library documentation
├── providers/        # React context providers (Theme, Auth, etc.)
└── README.md        # This file
```

## 🎯 What Goes Here

### ✅ Belongs in Shared

- **Components used by 3+ modules**
- **Layout primitives** (Page, Section, Stack)
- **Animation utilities** (LoadingSpinner, transitions)
- **Context providers** (ThemeProvider, AuthProvider)
- **Backend services** (Firebase, system backend)
- **Utility functions** used across modules

### ❌ Does NOT Belong Here

- **Module-specific logic** (keep in `modules/*/`)
- **One-off components** (put in module's components folder)
- **Domain-specific code** (recipes, inventory, planner logic)
- **Type definitions** (those go in `/types/contract.ts`)

## 🚀 Quick Start

### Import Components

```typescript
// ✅ Correct way
import { Page, Section, Button, LoadingSpinner } from '@/shared/components';

// ❌ Wrong way (don't import directly from files)
import { Page } from '@/shared/components/primitives/Page';
```

### Import Providers

```typescript
import { ThemeProvider, useTheme } from '@/shared/providers';
```

### Import Backend Services

```typescript
import { SystemBackend } from '@/shared/backend/system-backend';
```

## 🎨 Design System Integration

All shared components follow the design system:

- **Design tokens** - Colors, spacing, radii, shadows
- **Typography** - Font sizes, weights, line heights
- **Responsive** - Mobile-first with device-specific breakpoints
- **Animations** - 200ms spring transitions
- **Accessibility** - Keyboard navigation, focus states, ARIA labels

See `/docs/design-system/` for full documentation.

## 🤖 AI-First Design

All shared code is heavily commented for AI consumption:

1. **Clear JSDoc comments** explaining purpose and usage
2. **AI USAGE sections** with concrete examples
3. **TypeScript interfaces** for all props
4. **Import patterns** documented in barrel exports
5. **When/when not to use** guidelines

## 📦 Modules

Each module imports from `shared/`:

```typescript
// In modules/inventory/components/InventoryModule.tsx
import { Page, Section, Stack, Button } from '@/shared/components';
import { useTheme } from '@/shared/providers';
```

**Module boundaries:**
- Modules → `shared/` ✅
- Modules → `types/contract.ts` ✅
- Modules → other modules ❌ (no cross-module imports)

## 🔄 Adding New Shared Code

Before adding to `shared/`:

1. **Check if it's truly shared** - Used by 3+ modules?
2. **Follow design system patterns** - Uses tokens, documented?
3. **Add AI-friendly comments** - JSDoc with examples
4. **Update barrel exports** - Add to `index.ts`
5. **Document in README** - Update relevant README

## 📚 Documentation

- **Components:** `shared/components/README.md`
- **Design system:** `/docs/design-system/README.md`
- **Quick reference:** `/.github/design-system.instructions.md`
- **Architecture:** `/.github/copilot-instructions.md`

## 🛠 Maintenance

When refactoring:

1. Check all module imports before changing exports
2. Run `npm run parity` after backend changes
3. Test across breakpoints after UI changes
4. Update documentation when adding features
5. Keep AI comments up to date

---

**Philosophy:** Shared code exists to enforce consistency and reduce duplication. When in doubt, prefer composition over abstraction.
