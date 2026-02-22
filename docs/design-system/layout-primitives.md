# Layout Primitives

Layout primitives enforce structure and consistent spacing across modules. They act as reusable layout containers built on Tailwind utilities and design tokens.

Located in: `/components/layout/`

---

## Core Primitives

### Page
A full-page container with consistent padding, max-width, and vertical rhythm.

**Purpose:** Wrap entire page views to ensure consistent margins on all breakpoints.

**Characteristics:**
- Max-width constraint (`max-w-4xl` or `max-w-6xl`)
- Symmetric horizontal padding
- Vertical padding on mobile vs desktop
- Centered alignment

**Usage:**
```tsx
<div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
  {/* Page content */}
</div>
```

---

### Section
A logical grouping of content with consistent spacing and optional headers.

**Purpose:** Group related content with predictable vertical spacing.

**Characteristics:**
- `space-y-4` or `space-y-6` for consistent vertical rhythm
- Optional header with `text-lg` + `font-semibold`
- Semantic background (default, muted, etc.)

**Usage:**
```tsx
<section className="space-y-4">
  <h2 className="text-lg font-semibold">Section Title</h2>
  <p>Content here</p>
</section>
```

---

### Stack
Vertical layout with controlled spacing between items.

**Purpose:** Compose vertical lists with consistent gaps.

**Characteristics:**
- Flexbox column direction
- Gap tokens: `gap-2`, `gap-3`, `gap-4`, `gap-6`
- No arbitrary gaps

**Usage:**
```tsx
<div className="space-y-4">
  <Item />
  <Item />
</div>
```

---

### Inline
Horizontal layout with controlled spacing and alignment.

**Purpose:** Compose horizontal layouts (buttons, tags, etc.).

**Characteristics:**
- Flexbox row direction
- Gap tokens: `gap-2`, `gap-3`, `gap-4`
- Vertical alignment control

**Usage:**
```tsx
<div className="flex gap-3 items-center">
  <Button>Save</Button>
  <Button variant="outline">Cancel</Button>
</div>
```

---

### Card
A structured container with padding, radius, and optional header/footer.

**Purpose:** Encapsulate related information with visual separation.

**Characteristics:**
- `bg-card` background
- `rounded-lg` radius
- `shadow-md` elevation
- Consistent `p-6` padding
- Optional `CardHeader` and `CardFooter`

**Usage:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Equipment</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

---

## Composition Rules

### ✅ Always

- Use primitives instead of raw `<div>`s for layout
- Respect token-based spacing (no arbitrary values)
- Layer primitives for complex layouts

### ❌ Never

- Add extra margins to primitive-based layouts (they handle it)
- Mix spacing systems (stick to token-based gaps)
- Create one-off layout patterns

### If...

- A **new layout pattern emerges** that repeats across modules, define a primitive
- A **pattern appears once**, use Tailwind directly with token-based spacing

---

## Nesting Example

```tsx
<div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-6 lg:px-8 py-8">
  {/* Page primitive */}
  
  <section className="space-y-4">
    {/* Section primitive */}
    
    <h2 className="text-lg font-semibold">Accessories</h2>
    
    <div className="space-y-2">
      {/* Stack primitive (tight) */}
      {accessories.map(acc => (
        <div key={acc.id} className="flex gap-3 items-center p-3 border rounded-md">
          {/* Inline primitive (button + text) */}
          <CheckBox />
          <span>{acc.name}</span>
        </div>
      ))}
    </div>
  </section>
  
  <Card>
    {/* Card primitive */}
    <CardContent className="space-y-4">
      {/* Nested stacks */}
    </CardContent>
  </Card>
</div>
```

---

## When NOT to Use Primitives

Some layouts benefit from custom composition:

- **Complex grids** with many breakpoints (build with Tailwind directly)
- **One-off layouts** that don't repeat (use Tailwind)
- **3D/animated layouts** (CSS modules or Tailwind with custom classes)

But even these should respect token-based spacing and radii.
