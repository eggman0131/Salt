# Design Tokens

Design tokens are the atomic values that define the visual identity of the application.

Tokens are defined in `/styles/index.css` using OKLCH color space for perceptually uniform colors.

---

## Colour Tokens

The colour palette uses semantic naming for cognitive clarity.

### Dark Mode Strategy

- **Focus:** Light mode is the primary UI, dark mode is an alternative colour palette
- **Toggle:** User-controlled via sidebar (near avatar), persists in browser localStorage
- **Implementation:** `.dark` class applied to root element changes all colour tokens
- **Design principle:** Dark mode colours are semantically identical (same hierarchy), just inverted luminance

### Base Palette

- `--color-background` — Page/container background (light: alabaster, dark: charcoal)
- `--color-foreground` — Primary text (light: near-black, dark: near-white)
- `--color-card` — Card/panel background
- `--color-card-foreground` — Text on cards
- `--color-popover` — Dropdown/popover background
- `--color-popover-foreground` — Text in popovers

### Interactive Palette

- `--color-primary` — Primary actions, brand colour (blue)
- `--color-primary-foreground` — Text on primary buttons
- `--color-secondary` — Secondary actions (teal)
- `--color-secondary-foreground` — Text on secondary buttons

### Semantic Palette

- `--color-accent` — Positive/success states (green)
- `--color-accent-foreground` — Text on accent
- `--color-warning` — Attention/pending states (amber)
- `--color-warning-foreground` — Text on warning
- `--color-destructive` — Destructive/error states (red)
- `--color-muted` — Disabled, inactive states
- `--color-muted-foreground` — Text on muted

### Structure

- `--color-border` — Dividers, borders
- `--color-input` — Input field backgrounds
- `--color-ring` — Focus rings

### Sidebar

- `--color-sidebar` — Sidebar background
- `--color-sidebar-foreground` — Sidebar text
- `--color-sidebar-primary` — Sidebar primary
- `--color-sidebar-accent` — Sidebar accent
- `--color-sidebar-border` — Sidebar borders

### Chart/Data

- `--color-chart-1` through `--color-chart-5` — Data visualization colours

### Rules

- **Never use raw hex/rgb values** in components.
- **Always use semantic tokens** where possible.
- If a new semantic meaning emerges, **add a token** — don't hardcode.
- Tokens use OKLCH colour space for perceptual uniformity across light and dark modes.

---

## Spacing Tokens

Spacing follows a consistent scale (in rem):

- `--space-1` = 0.25rem (4px)
- `--space-2` = 0.5rem (8px)
- `--space-3` = 0.75rem (12px)
- `--space-4` = 1rem (16px)
- `--space-6` = 1.5rem (24px)
- `--space-8` = 2rem (32px)
- `--space-12` = 3rem (48px)

### Rules

- **No arbitrary spacing values** (e.g., `mt-[7px]`).
- **Vertical rhythm** must be consistent across modules.
- **Lists and forms** use consistent spacing between items.
- Default Tailwind spacing (1, 2, 3, 4, etc.) maps to these tokens.

---

## Radius Tokens

- `--radius-sm` — Small elements (inputs, pills)
- `--radius-md` — Default components
- `--radius-lg` — Cards, panels
- `--radius-xl` — Large containers
- `--radius-2xl` — Extra large
- `--radius-3xl` — Oversize elements
- `--radius-4xl` — Maximum

### Rules

- **All components must use radius tokens.**
- **No ad-hoc radii** (e.g., `rounded-[3px]`).
- If a new radius is needed, **define a token first**.

---

## Typography Tokens

### Font Sizes (Mobile-Optimized)

Based on Pixel 8 Pro viewport (412×915px):

- `--text-xs` — Meta text (12px)
- `--text-sm` — Secondary body, buttons, nav (14px)
- `--text-base` — Body text, forms (16px)
- `--text-lg` — Small headings (18px)
- `--text-xl` — Medium headings (20px)
- `--text-2xl` — Large headings (24px)
- `--text-3xl` — Page titles (28px)

### Font Weights

- `--font-regular` — Body (400)
- `--font-medium` — Emphasis (500)
- `--font-semibold` — Headings (600)

### Line Heights

- `--leading-tight` — 1.25 (headings)
- `--leading-normal` — 1.5 (body text)
- `--leading-relaxed` — 1.625 (long-form content)

### Font Stack

- **Sans-serif:** `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Monospace:** `'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace`

### Rules

- **Titles** use `text-lg` or `text-xl`.
- **Section headers** use `text-base` + `font-semibold`.
- **Body text** uses `text-sm` or `text-base`.
- **Muted text** uses the semantic muted colour.
- **Never mix arbitrary text sizes.**

---

## Shadow Tokens

Shadows provide subtle depth without overwhelming the interface.

- `--shadow-sm` — Subtle elevation (inputs, small cards)
  - **Value:** `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
  - **Use:** Inputs, badges, small interactive elements

- `--shadow-md` — Standard elevation (cards, panels)
  - **Value:** `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
  - **Use:** Cards, panels, dropdowns

- `--shadow-lg` — High elevation (modals, dropdowns)
  - **Value:** `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`
  - **Use:** Modals, overlays, popovers

### Rules

- **Cards and panels** use shadow tokens only.
- **No custom box-shadow values.**
- Shadows reinforce visual hierarchy.
- **Dark mode:** Shadows remain consistent (no need to adjust)

---

## Animation & Transition Tokens

Consistent motion creates smooth, predictable interactions.

### Duration

- `--duration-fast` — 100ms (micro-interactions, hovers)
- `--duration-normal` — 200ms (standard transitions)
- `--duration-slow` — 300ms (complex state changes)

### Easing

- `--ease-spring` — `cubic-bezier(0.68, -0.55, 0.265, 1.55)` (bouncy, playful)
- `--ease-in-out` — `cubic-bezier(0.4, 0, 0.2, 1)` (smooth, natural)
- **Default:** Use `--ease-spring` for Salt (aligns with brand personality)

### Usage

```tsx
// Hover transition
<button className="transition-all duration-200 ease-spring hover:scale-105">
  Click me
</button>

// Loading state
<div className="animate-spin transition-opacity duration-200">
  <Loader2 className="h-5 w-5" />
</div>
```

### Loading Spinner

**Standard AI Wait Spinner:**
```tsx
import { Loader2 } from 'lucide-react';

<Loader2 className="h-5 w-5 animate-spin text-primary" />
```

- **Icon:** `Loader2` from lucide-react
- **Size:** `h-5 w-5` (medium, 20px)
- **Animation:** `animate-spin` (Tailwind default)
- **Colour:** `text-primary` or `text-muted-foreground` for subtle states
- **Use when:** Waiting for Gemini AI responses, async operations

---

## Focus States

Keyboard navigation and accessibility require clear focus indicators.

### Focus Ring

- **Colour:** `--color-ring` (matches primary)
- **Width:** `2px`
- **Offset:** `2px` (space between element and ring)
- **Style:** `solid` outline

### Implementation

```tsx
// Automatic via shadcn/ui components
<Button>Accessible</Button>

// Manual application
<div
  tabIndex={0}
  className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
>
  Custom focusable
</div>
```

### Rules

- **Always visible** — Focus rings show on keyboard navigation (`:focus-visible`)
- **Never remove** — Critical for accessibility
- **Colour contrast:** Ring must meet WCAG 2.1 AA (3:1 contrast ratio)

---

## Implementation

All tokens are CSS custom properties defined in `/styles/index.css`.

Light mode (`:root` selector):
```css
:root {
  --primary: oklch(0.52 0.16 253);
  --primary-foreground: oklch(0.98 0 0);
  /* ... */
}
```

Dark mode (`.dark` selector):
```css
.dark {
  --primary: oklch(0.75 0.13 253);
  --primary-foreground: oklch(0.12 0 0);
  /* ... */
}
```

Use in Tailwind:
```tsx
<button className="bg-primary text-primary-foreground px-4 py-2 rounded-md transition-all duration-200 ease-spring">
  Click me
</button>
```
