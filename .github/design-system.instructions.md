---
applyTo: "modules/**/components/**/*.tsx"
---

# Design System Reference

This file ensures frontend developers continuously reference the design system when building UI.

## Quick Links

**Design System Home:** `docs/design-system/README.md`

### Key Guides
- **Design Tokens** (`docs/design-system/tokens.md`) — Always use tokens, never hardcode colours/spacing
- **Components** (`docs/design-system/components.md`) — Button styles, form patterns, badges
- **Layout Primitives** (`docs/design-system/layout-primitives.md`) — Page, Section, Stack, Card
- **Icons** (`docs/design-system/icons.md`) — Use lucide-react consistently
- **Interaction Patterns** (`docs/design-system/interaction-patterns.md`) — Modals, inline editing, action bars
- **Contribution Guide** (`docs/design-system/contributions.md`) — Adding new elements

---

## Critical Rules (Non-Negotiables)

### ✅ Always

- **Use design tokens** for all colours, spacing, radii, typography
- **Use shadcn/ui components** for buttons, inputs, dialogs, badges
- **Use layout primitives** instead of raw `<div>` layouts
- **Use Tailwind utilities** with token-based classes
- **Test on mobile and desktop** before shipping
- **Use British English** in all UI text (labelled, colour, centre, etc.)
- **Use metric units only** in documentation (mm, cm, or px for web)

### ❌ Never

- Never hardcode hex/rgb colours — use `className="bg-primary"`
- Never use arbitrary spacing — use token-based `space-y-4`, `gap-3`
- Never create component-specific CSS — use Tailwind + tokens
- Never import SVGs directly — use lucide-react icons
- Never use American English or Imperial units
- Never ship UI changes without testing on mobile

---

## Before Starting Feature Work

1. **Read the relevant guide** from `docs/design-system/`
2. **Check for existing patterns** — Don't reinvent
3. **Use tokens for all styling** — No hardcoded values
4. **Build with shadcn/ui + primitives** — Composition first
5. **Test across breakpoints** — Mobile (375px), tablet (768px), desktop (1024px)

---

## Common Patterns

### Button
```tsx
import { Button } from '@/components/ui/button';

// Primary (one per screen)
<Button onClick={handle}>Save</Button>

// Secondary
<Button variant="outline">Cancel</Button>

// Destructive (clear intent)
<Button variant="destructive">Delete</Button>
```

### Form
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="name">Name</Label>
    <Input id="name" placeholder="Your name" />
  </div>
</div>
```

### Card
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Content with token-based spacing */}
  </CardContent>
</Card>
```

### Layout (Primitives)
```tsx
// Page container
<div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
  {/* Section */}
  <section className="space-y-4">
    <h2 className="text-lg font-semibold">Section</h2>
    {/* Content */}
  </section>
</div>
```

### Icons
```tsx
import { Plus, Trash2, ChevronDown } from 'lucide-react';

<Button>
  <Plus className="h-4 w-4 mr-1" />
  Add Item
</Button>

<Trash2 className="h-5 w-5 text-destructive" />
```

---

## Design Token Reference (Quick)

### Colours
- `bg-primary`, `text-primary` — Brand blue
- `bg-secondary`, `text-secondary` — Teal accent  
- `bg-accent`, `text-accent` — Green (success)
- `bg-destructive`, `text-destructive` — Red (error)
- `bg-muted`, `text-muted-foreground` — Disabled/inactive
- `bg-card` — Card backgrounds
- `border-border` — Dividers and borders

### Spacing (Tailwind classes)
- `space-y-2`, `space-y-4`, `space-y-6` — Vertical rhythm
- `gap-2`, `gap-3`, `gap-4` — Flex gaps
- `px-4`, `py-4` — Padding
- `mx-auto` — Center horizontally

### Radii
- `rounded-sm` — Small (badges)
- `rounded-md` — Medium (inputs, buttons)
- `rounded-lg` — Large (cards)

### Typography
- `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl` — Size
- `font-medium`, `font-semibold` — Weight

---

## Red Flags 🚩

Watch for these patterns in your code:

```tsx
// ❌ Hardcoded colour
<div className="bg-[#3b82f6]">Wrong</div>

// ✅ Token-based
<div className="bg-primary">Right</div>

---

// ❌ Arbitrary spacing
<div className="mt-[7px] mb-[13px]">Wrong</div>

// ✅ Token-based spacing
<div className="space-y-4">Right</div>

---

// ❌ Inline styles
<div style={{ padding: '12px', borderRadius: '4px' }}>Wrong</div>

// ✅ Tailwind + tokens
<div className="p-3 rounded-md">Right</div>

---

// ❌ Custom button styling
<button className="bg-blue-600 px-4 py-2 rounded">Wrong</button>

// ✅ shadcn/ui Button
<Button>Right</Button>
```

---

## When to Ask for Help

- **"How should this layout look on mobile?"** — Check `docs/design-system/mobile-desktop.md`
- **"What button style should I use?"** — Check `docs/design-system/components.md`
- **"Should this be a modal or inline?"** — Check `docs/design-system/interaction-patterns.md`
- **"What colour for this state?"** — Check `docs/design-system/tokens.md`
- **"Can I create a new component?"** — Check `docs/design-system/contributions.md`

---

## Integration with Salt's Constitution

The design system works alongside Salt's core principles:

- **The Contract** (`types/contract.ts`) — Data structure
- **The Soul** (`backend/prompts.ts`) — AI voice
- **The Brain** (`modules/*/backend/base-*-backend.ts`) — Domain logic
- **Design System** ← You are here: UI consistency
- **The Hands** (`modules/*/backend/firebase-*-backend.ts`) — Persistence

All modules must respect:
1. The Legal Contract (Zod schemas)
2. British English + Metric Units
3. This Design System (UI patterns, tokens, components)

---

## Checklist Before Shipping UI

- [ ] All colours use design tokens (no hardcoded hex)
- [ ] All spacing uses token-based classes (no arbitrary mt-[7px])
- [ ] All components use shadcn/ui where applicable
- [ ] All layout uses primitives (Page, Section, Stack, Card)
- [ ] All buttons follow semantic patterns (primary, secondary, destructive)
- [ ] All icons use lucide-react
- [ ] All text is British English (colour, centre, labelled)
- [ ] Tested on mobile (375px) and desktop (1024px)
- [ ] Form errors use destructive colour token
- [ ] Loading states show spinner or disabled indicator
- [ ] Empty states show helpful icon + message
- [ ] No arbitrary styling or CSS overrides

---

## Questions?

1. **Start here:** `docs/design-system/README.md`
2. **Find the answer:** Browse the relevant guide
3. **Still stuck?** Check examples in production modules
4. **Need to add something new?** Read `docs/design-system/contributions.md`

---

## Version

Design System v1.0.0
Last Updated: 2026-02-18
