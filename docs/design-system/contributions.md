# Contribution Guide

This guide explains how to add new primitives, icons, and components to the design system.

---

## Adding a New Primitive

If you find yourself repeating the same layout pattern across multiple modules, create a primitive.

### Before Creating

1. **Does it already exist?** — Check `layout-primitives.md`
2. **Is it truly repetitive?** — Used in 3+ places?
3. **Can Tailwind utilities solve it?** — Or does it need encapsulation?

### Process

1. **Define the pattern** — What problem does it solve?
2. **Write documentation** — What props, when to use?
3. **Create component** — Build in `/components/layout/`
4. **Use tokens** — Spacing, radius, colours from tokens
5. **Add to this guide** — Update `layout-primitives.md`

### Template

```tsx
// components/layout/MyPrimitive.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface MyPrimitiveProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MyPrimitive describes what this layout does.
 * 
 * Use when: [scenario]
 * Don't use when: [scenario]
 */
export const MyPrimitive: React.FC<MyPrimitiveProps> = ({
  children,
  className,
}) => (
  <div className={cn('space-y-4 px-4 sm:px-6 py-8', className)}>
    {children}
  </div>
);
```

### Documentation

Add to `layout-primitives.md`:

```markdown
### MyPrimitive

**Purpose:** What does this layout do?

**Characteristics:**
- Spacing rule
- Alignment rule
- etc.

**Usage:**
\`\`\`tsx
<MyPrimitive>
  {/* Content */}
</MyPrimitive>
\`\`\`
```

---

## Adding a New Icon

### Before Creating Custom

1. **Search lucide-react** — https://lucide.dev
2. **Is there a near-match?** — Icon that's 80% there?
3. **Is it domain-specific?** — For Salt only, not generic?

If yes to #3, create a custom icon. Otherwise, use lucide.

### Process

1. **Design SVG** — 24×24 viewBox, stroke-based, `currentColor`
2. **Normalize** — Strip IDs, ensure consistency
3. **Place file** — Add to repository
4. **Export** — Register in component index
5. **Document** — Add to `icons.md`

### SVG Template

```svg
<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.5"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <!-- Your paths here -->
</svg>
```

### Usage

```tsx
import { YourCustomIcon } from '@/components/icons';

<YourCustomIcon className="h-4 w-4" />
```

---

## Adding a New Component

New components should be built on primitives and tokens, not one-off styling.

### Before Creating

1. **Does shadcn/ui provide it?** — Buttons, inputs, modals, etc.
2. **Can composition solve it?** — Stack existing components?
3. **Is it module-specific or shared?** — Shared → design-system, module-specific → module folder

### Process

1. **Design pattern** — Sketch with pen/paper or Figma
2. **Use existing components** — Buttons, inputs, cards from shadcn/ui
3. **Build with tokens** — No hardcoded spacing/colours
4. **Test across breakpoints** — Mobile, tablet, desktop
5. **Add to this guide** — Update `components.md`

### Template

```tsx
// components/MyComponent.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * MyComponent describes what this component does.
 * 
 * Built on:
 * - Button (primary action)
 * - Input (text entry)
 * 
 * Tokens used:
 * - space-y-4 (vertical rhythm)
 * - text-sm (label sizing)
 */
export const MyComponent: React.FC<MyComponentProps> = ({
  value,
  onChange,
  onSubmit,
}) => (
  <div className="space-y-4">
    <label className="text-sm font-medium">
      Label
    </label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Help text"
    />
    <div className="flex gap-3 justify-end">
      <Button variant="outline">Cancel</Button>
      <Button onClick={onSubmit}>Save</Button>
    </div>
  </div>
);
```

### Reviews Should Check

- ✅ Uses tokens (no hardcoded colours/spacing)
- ✅ Builds on primitives / shadcn/ui
- ✅ Consistent typography from tokens
- ✅ Respects module boundaries
- ✅ Tested on mobile and desktop
- ✅ Documented in design system

---

## Updating Existing Components

If you find a pattern that doesn't align with the design system:

1. **Report the issue** — Document the inconsistency
2. **Propose a fix** — Show the corrected pattern
3. **Update docs** — Reflect the new standard
4. **Migrating modules** — Use updated component going forward

### Example: Updating Button Styling

**Old (inconsistent):**
```tsx
<button className="px-4 py-2 bg-blue-600 text-white rounded">
  Click
</button>
```

**New (design-system aligned):**
```tsx
<Button>Click</Button>
```

---

## Design System Evolution

The design system is living. Changes must be:

1. **Intentional** — Solves a real problem
2. **Documented** — Updated in this guide and CHANGELOG.md
3. **Backwards-compatible** — Where possible, don't break existing usage
4. **Validated** — Test in a real module before global rollout

### Process for System Change

1. **Identify gap** — What's missing or inconsistent?
2. **Propose** — Bring to team discussion
3. **Design** — Define new token, primitive, or rule
4. **Pilot** — Implement in one module
5. **Validate** — Verify consistency and usability
6. **Document** — Update this guide
7. **Migrate** — Gradually update other modules

---

## Naming Conventions

### Files

- **Components:** `MyComponent.tsx` (PascalCase)
- **Styles:** `my-style.css` (kebab-case)
- **Icons:** `my-icon.svg` (kebab-case)

### Classes

- **Layout primitives:** `MyPrimitive` (PascalCase)
- **Components:** `MyComponent` (PascalCase)
- **Utilities:** `my-utility` (kebab-case)

### CSS Custom Properties

- **Colours:** `--color-primary` (lowercase, hyphens)
- **Spacing:** `--space-4` (lowercase, hyphens)
- **Radii:** `--radius-md` (lowercase, hyphens)

---

## Common Mistakes to Avoid

❌ **Hardcoding colours:**
```tsx
<div className="bg-#3b82f6">Wrong!</div>
```

✅ **Using tokens:**
```tsx
<div className="bg-primary">Right!</div>
```

---

❌ **Arbitrary spacing:**
```tsx
<div style={{ marginTop: '7px', marginBottom: '13px' }}>Wrong!</div>
```

✅ **Using spacing tokens:**
```tsx
<div className="space-y-4">Right!</div>
```

---

❌ **Component-specific styling:**
```tsx
const MyButton = styled.button`
  background: #3b82f6;
  padding: 8px 12px;
  border-radius: 4px;
`;
```

✅ **Composition + tokens:**
```tsx
<Button onClick={...}>Label</Button>
```

---

## Summary

- **Add primitives** only for repeated patterns
- **Create custom icons** only when lucide lacks the concept
- **Build components** on shadcn/ui + primitives + tokens
- **Never hardcode** colours, spacing, or radii
- **Always document** changes to this guide
- **Test across breakpoints** before shipping
