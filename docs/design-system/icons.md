# Icons

Icons follow a unified pipeline to ensure consistency across the application.

Located in: `/components/ui/` (icons are imported from lucide-react)

---

## Icon Strategy

Salt uses [lucide-react](https://lucide.dev) as the primary icon source. This provides:

- Consistent stroke-based style
- 24×24 viewBox standard
- Comprehensive kitchen/culinary coverage
- Regular updates and maintenance

---

## Icon Usage

### Import from lucide-react

```tsx
import { Plus, Trash2, ChevronDown } from 'lucide-react';

// Use directly in components
<Plus className="h-4 w-4" />
```

### Common Kitchen Icons

- **Equipment:** `Refrigerator`, `Blender`, `UtensilsCrossed`, `Lightbulb` (cooktop)
- **Actions:** `Plus`, `Trash2`, `Edit2`, `CheckCircle2`
- **Navigation:** `ChevronDown`, `ChevronUp`, `ArrowLeft`, `ArrowRight`, `Menu`
- **Status:** `AlertCircle`, `CheckCircle`, `Clock`, `Lock`

Search lucide-react docs for your specific need.

---

## Icon Size Tokens

Use consistent sizing via Tailwind classes:

- `h-3 w-3` — Extra small (badge icons)
- `h-4 w-4` — Small (inline icons, buttons)
- `h-5 w-5` — Medium (icon buttons)
- `h-6 w-6` — Large (standalone icons)
- `h-8 w-8` — Extra large (illustrations)

```tsx
// Small icon in button
<Button size="sm">
  <Plus className="h-4 w-4 mr-1" />
  Add
</Button>

// Medium icon standalone
<Trash2 className="h-5 w-5 text-destructive" />

// Large icon in card
<CheckCircle className="h-8 w-8 text-accent" />
```

---

## Icon Colours

Icons inherit colour from their parent or explicit classes:

```tsx
{/* Inherits text colour */}
<Plus className="h-4 w-4" />

{/* Explicit colour token */}
<Plus className="h-4 w-4 text-primary" />
<Trash2 className="h-5 w-5 text-destructive" />
<CheckCircle className="h-5 w-5 text-accent" />

{/* Muted state */}
<Lock className="h-4 w-4 text-muted-foreground" />
```

Valid colour classes:
- `text-primary`
- `text-secondary`
- `text-accent`
- `text-destructive`
- `text-muted-foreground`
- `text-foreground`

---

## Icon Alignment

Icons in buttons or labels should align left with spacing:

```tsx
{/* Icon left, text right */}
<Button>
  <Plus className="h-4 w-4 mr-1" />
  Add Item
</Button>

{/* Icon only (no text) */}
<Button variant="ghost" size="icon">
  <Menu className="h-5 w-5" />
</Button>

{/* Icon in badge */}
<Badge>
  <CheckCircle className="h-3 w-3 mr-1" />
  Complete
</Badge>
```

---

## Custom Icons (If Needed)

Only create custom icons if:
- No lucide icon satisfies the concept
- The icon is domain-specific (e.g., a custom kitchen tool)

### Process

1. **Check lucide first** — Is there a near-match?
2. **Design** — Create SVG in Figma or Illustrator
3. **Normalize** — Ensure 24×24 viewBox, stroke-based, `currentColor`
4. **Add to repository** — Place in a custom folder if needed
5. **Export** — Register in component index
6. **Use** — Import and use like lucide icons

### Custom Icon Rules

- **Stroke-based** (not filled)
- **Stroke width:** 1.5 or 2 (match lucide defaults)
- **ViewBox:** Always 24×24
- **Colour:** Use `currentColor` for stroke/fill
- **Naming:** PascalCase component name, kebab-case file name

Example: `WokCradleIcon` component → `wok-cradle.svg` file

---

## When NOT to Use Pictures

Avoid using images/pictures where icons are appropriate:

- Use icons for actions, status, concepts
- Use images for photography, documentation
- Use illustrations for empty states, guidance

---

## Accessibility

lucide-react icons are presentational by default:

```tsx
{/* Implicit: icon reinforces button text */}
<Button>
  <Trash2 className="h-4 w-4 mr-1" />
  Delete
</Button>

{/* Standalone icon: add aria-label */}
<button aria-label="Close menu">
  <X className="h-5 w-5" />
</button>
```

If an icon is the only content, provide a label.

---

## Example Component

```tsx
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function EquipmentItem({ item, onDelete }) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-md">
      {/* Status icon */}
      {item.verified && (
        <CheckCircle className="h-5 w-5 text-accent shrink-0" />
      )}
      
      {/* Content */}
      <div className="flex-1">
        <p className="font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">{item.brand}</p>
      </div>
      
      {/* Badge + Delete */}
      <Badge>{item.type}</Badge>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

---

## Summary

- **Use lucide-react** for all standard icons
- **Consistent sizing** via size token classes
- **Semantic colours** (primary, destructive, accent, muted-foreground)
- **Left alignment** in buttons/labels with `mr-1` spacing
- **Custom icons only** if lucide lacks the concept
- **Always provide aria-label** for icon-only elements
