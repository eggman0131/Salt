# Shared Components

**AI-first component library for Salt**

This directory contains all shared UI components, layout primitives, and animation utilities used across Salt modules.

## 📦 What's Included

### Layout Primitives (`./primitives/`)
Fundamental building blocks for consistent layouts:
- **Page** - Full-page container with padding and max-width
- **Section** - Logical content grouping with spacing
- **Stack** - Vertical layout with gaps
- **Inline** - Horizontal layout with gaps
- **CardContainer** - Visual container with borders/shadows

### shadcn/ui Components (`@/components/ui/`)
Interactive elements following design system:
- Buttons, Inputs, Forms
- Dialogs, Sheets (modals/overlays)
- Cards, Badges, Alerts
- Navigation components

### Animation Components (`@/lib/animations`)
Standard loading/transition utilities:
- **LoadingSpinner** - Standard spinner (use for all loading states)
- **AILoadingIndicator** - Specialized for Gemini AI waits
- Animation helper functions (spring transitions, fades, slides)

## 🎯 Import Pattern

**Always import from the barrel export:**

```typescript
import { Page, Section, Stack, Button, LoadingSpinner } from '@/shared/components';
```

**Never import directly from files:**
```typescript
// ❌ DON'T DO THIS
import { Page } from '@/shared/components/primitives/Page';
import { Button } from '@/components/ui/button';

// ✅ DO THIS INSTEAD
import { Page, Button } from '@/shared/components';
```

## 🤖 AI Usage Guidelines

### For Layout Structure

```typescript
import { Page, Section, Stack, Inline } from '@/shared/components';

export function MyModule() {
  return (
    <Page maxWidth="max-w-6xl">
      <Section spacing="space-y-6">
        <h1 className="text-2xl font-semibold">Title</h1>
        
        <Stack spacing="gap-3">
          {items.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </Stack>
        
        <Inline spacing="gap-3" align="items-center">
          <Button>Save</Button>
          <Button variant="outline">Cancel</Button>
        </Inline>
      </Section>
    </Page>
  );
}
```

### For Interactive Elements

```typescript
import { Button, Input, Label, Dialog, LoadingSpinner } from '@/shared/components';

export function MyForm() {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Your name" />
        </div>
        
        <Button disabled={isLoading}>
          {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
```

### For AI Operations

```typescript
import { AILoadingIndicator } from '@/shared/components';

export function RecipeGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  
  return (
    <div className="space-y-4">
      {isGenerating && (
        <AILoadingIndicator text="Generating recipe..." />
      )}
      
      {recipe && <RecipeDisplay recipe={recipe} />}
    </div>
  );
}
```

## 📐 Component Hierarchy

Typical nesting pattern:

```
Page (max-width container, padding)
└── Section (content grouping, spacing)
    ├── Stack (vertical list)
    │   └── CardContainer (individual items)
    └── Inline (horizontal actions)
        └── Button (interactive elements)
```

## 🎨 Styling Guidelines

1. **Use design tokens** - All colors, spacing, shadows via tokens
2. **No hardcoded values** - Use Tailwind utilities with token classes
3. **Override via className** - Pass className prop to primitives when needed
4. **Follow design system** - Check `/docs/design-system/` for patterns

## 🔄 When to Add New Components

**Add to this shared library when:**
- Used by 3+ modules
- Follows design system patterns
- Reusable and configurable

**Keep in module-specific folders when:**
- Only used by one module
- Domain-specific logic
- Not generalizable

## 📚 Documentation

Full design system documentation: `/docs/design-system/`

Quick reference: `/.github/design-system.instructions.md`

## ✅ Checklist for Components

Before using/creating components:

- [ ] Imported from `@/shared/components` (barrel export)
- [ ] Uses design tokens (colors, spacing, radii)
- [ ] Follows responsive patterns (mobile-first)
- [ ] Has TypeScript props interface
- [ ] Documented with JSDoc comments (especially for AI usage)
- [ ] Tested on mobile and desktop breakpoints

---

**Remember:** This library exists to enforce consistency. When in doubt, check existing patterns before creating new ones!
