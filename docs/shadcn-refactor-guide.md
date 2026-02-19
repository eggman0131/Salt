# shadcn/ui Refactor Guide

> Documentation for Issue #43: Frontend refactor using shadcn/ui component library

## Core Philosophy: Clean Slate, Not Port

**The Golden Rule:** When refactoring a module, ask "What should this do?" not "How did it work before?"

- Start with zero assumptions from legacy UI
- Don't preserve features unless explicitly needed
- This is the time to fix technical debt properly
- Don't maintain consistency with old mistakes

## Component Selection Guidelines

### Use Semantically Correct Components

- **AlertDialog** → Destructive confirmations (can't dismiss by click-outside)
  - User deletions, data loss actions
  - "Are you sure?" scenarios with consequences
- **Dialog** → Non-critical modals and edits
  - Form edits, information display
  - User can safely dismiss without consequences
- **Proper form patterns** → Label + Input pairs with `htmlFor`/`id` attributes

### When in Doubt, Install the Right Component

Don't use workarounds (e.g., Dialog instead of AlertDialog). Run:

```bash
npx shadcn@latest add [component]
```

Better UX + accessibility is worth the installation step.

## Established Patterns

### Toast Notifications (Replace Browser Alerts)

**Setup** (one-time, already complete):
1. ThemeProvider wraps app in `index.tsx`
2. `<Toaster position="top-right" />` in top-level views
3. `sonner.tsx` uses local ThemeProvider

**Usage in components:**

```tsx
import { toast } from 'sonner';

// Success notification
toast.success('User created', { description: 'Access granted successfully' });

// Error notification
toast.error('Failed to save', { description: error.message });

// Info notification
toast.info('Tip', { description: 'Drag items to reorder' });
```

**Benefits:**
- Non-blocking, elegant, consistent with design system
- Better UX than browser alerts
- Supports dark mode automatically

### Drag-and-Drop Reordering

**When to use:** Lists that users need to manually order

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Pattern:**

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

// Sortable item component
const SortableItem = ({ item, ...callbacks }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="...">
      <button
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {/* Item content */}
    </div>
  );
};

// In parent component
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={items.map(item => item.id)}
    strategy={verticalListSortingStrategy}
  >
    {items.map(item => <SortableItem key={item.id} item={item} />)}
  </SortableContext>
</DndContext>
```

**Key principles:**
- Accessible (keyboard navigable via KeyboardSensor)
- Touch-friendly (PointerSensor)
- Visual feedback (opacity, cursor states)
- **Backend persistence** (not localStorage)

### Modal Animations

**Use the centralized token from `lib/animations.tsx`:**

```tsx
import { modalAnimation } from '@/lib/animations';

<DialogContent className={cn(
  "...",
  modalAnimation()
)}>
```

**Why:**
- Single source of truth for all modals
- Change once, applies everywhere
- Currently: fade-only, 200ms
- Alternatives documented in code comments

### Hover States

Use semantic colors with `/10` opacity for subtle backgrounds:

```tsx
// Edit button (primary action)
<Button 
  variant="ghost" 
  size="icon"
  className="hover:bg-primary/10 hover:text-primary"
>

// Delete button (destructive action)
<Button 
  variant="ghost" 
  size="icon"
  className="hover:bg-destructive/10 hover:text-destructive"
>
```

**Principles:**
- List items not clickable (no hover effect on container)
- Action buttons have distinct hover states
- Semantic colors convey meaning (primary = edit, destructive = delete)

### Shadows for Depth

Use Tailwind shadow utilities:

```tsx
// List items with hover lift
<div className="shadow-sm hover:shadow-md transition-shadow">

// Cards
<Card className="shadow-md">
```

**Scale:**
- `shadow-sm` → Subtle elevation
- `shadow` → Default
- `shadow-md` → Medium
- `shadow-lg` → Large
- `shadow-xl` → Extra large

**Tip:** Add `transition-shadow` for smooth hover effects

### Dark Mode Support

**Always add `dark:` variants when styling components:**

```tsx
// Backgrounds
className="bg-white dark:bg-gray-900"

// Text
className="text-gray-900 dark:text-gray-100"

// Borders
className="border-gray-200 dark:border-gray-800"

// Semantic colors automatically adapt
className="bg-primary text-primary-foreground"  // Works in both themes
```

**Testing:**
- Test both light and dark mode when building components
- Toggle is in sidebar (Moon/Sun icon)
- Preference persisted in localStorage
- shadcn components auto-support dark mode via CSS variables

## What to Remove During Refactor

### Remove These Patterns:

❌ **localStorage persistence** → Use backend/database instead  
❌ **Manual drag-drop implementations** → Use @dnd-kit library  
❌ **Manual timers/confirmations** → Use proper components  
❌ **State that duplicates backend data** → Single source of truth  
❌ **Hardcoded colors** (e.g., `bg-orange-500`) → Use semantic tokens (`bg-primary`)  
❌ **Arbitrary Tailwind values** (e.g., `z-[400]`) → Use standard classes (`z-400`)  

### Keep/Add These Instead:

✅ **Backend persistence** via proper API calls  
✅ **Library-based interactions** (@dnd-kit, radix-ui)  
✅ **Semantic components** (AlertDialog, Dialog, Form)  
✅ **Minimal state** (form inputs, loading flags, modal state only)  
✅ **Design tokens** (from CSS variables)  
✅ **Standard Tailwind classes** from the official scale  

## Z-Index Layer Management

**Fixed hierarchy (use standard Tailwind classes):**

- **Modals** (Dialog, AlertDialog): `z-400`
- **Sidebar**: `z-300`
- **Top Navigation**: `z-200`
- **Overlays**: `z-100`

**Rule:** Always use standard Tailwind z-index classes, never arbitrary values

```tsx
// ✅ Correct
className="z-400"

// ❌ Incorrect
className="z-[400]"
```

## Layout Patterns

### Empty States

```tsx
<div className="py-12 text-center border border-dashed rounded-lg">
  <p className="text-sm text-muted-foreground">
    No items yet. Add one above to get started.
  </p>
</div>
```

### Form Layouts

```tsx
<form onSubmit={handleSubmit} className="space-y-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="name">Name</Label>
      <Input 
        id="name"
        placeholder="Enter name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
    </div>
    {/* More fields */}
  </div>
  
  <Button 
    type="submit" 
    disabled={!name.trim()}
    className="w-full"
  >
    <PlusIcon className="h-4 w-4 mr-2" />
    Add Item
  </Button>
</form>
```

**Principles:**
- Label + Input pairs with `htmlFor`/`id`
- Responsive grids: `grid-cols-1 md:grid-cols-2`
- Disabled states during validation
- Icon + text in buttons
- Full-width buttons on mobile

### List Items with Actions

```tsx
<div className="flex items-center gap-3 p-3 border rounded-lg bg-background shadow-sm">
  {/* Drag handle (if applicable) */}
  <button {...dragHandleProps}>
    <GripVertical className="h-4 w-4" />
  </button>

  {/* Avatar/Icon */}
  <Avatar className="h-9 w-9">
    <AvatarFallback>{initials}</AvatarFallback>
  </Avatar>

  {/* Content (flex-1 for truncation) */}
  <div className="flex-1 min-w-0">
    <p className="font-medium text-sm truncate">{title}</p>
    <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
  </div>

  {/* Actions (shrink-0 to prevent squashing) */}
  <div className="flex items-center gap-1 shrink-0">
    <Button variant="ghost" size="icon" className="hover:bg-primary/10">
      <Pencil className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon" className="hover:bg-destructive/10">
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
</div>
```

## Module Refactor Checklist

When refactoring a module:

### Planning Phase
- [ ] Read module's `README.md`
- [ ] Identify core functionality (what does this *need* to do?)
- [ ] Review backend API contracts
- [ ] Archive old components (rename folder to `.archived`)

### Build Phase
- [ ] Start from scratch (don't copy-paste old components)
- [ ] Use proper semantic components (AlertDialog vs Dialog)
- [ ] Add dark mode variants
- [ ] Apply shadow utilities for depth
- [ ] Use standard Tailwind classes (no arbitrary values)
- [ ] Add proper loading/disabled states
- [ ] Implement proper error handling (toast notifications)

### Testing Phase
- [ ] Test on mobile (375px), tablet (768px), desktop (1024px)
- [ ] Test both light and dark modes
- [ ] Test keyboard navigation
- [ ] Test form validation
- [ ] Test error scenarios
- [ ] Run automated tests: `npm test`

### Cleanup Phase
- [ ] Remove commented code
- [ ] Fix any linter warnings
- [ ] Update module's `README.md` if needed
- [ ] Delete `.archived` folder once verified

## Reference Implementation

**Admin Module** (`modules/admin/`) is the reference implementation:

- **UsersModule**: Drag-and-drop, CRUD operations, backend persistence
- **AdminModule**: System state, debug toggle, kitchen directives, backup/restore with toasts

Study these for patterns before refactoring other modules.

## Module Refactor Order (Issue #43)

**Tier 1** (Isolated, UI-only):
1. ✅ Admin Module
2. AI Module (chat interface)

**Tier 2** (Self-contained, backend-driven):
3. Kitchen Data Module
4. Inventory Module

**Tier 3** (Complex, interdependent):
5. Recipes Module (depends on Kitchen Data)
6. Shopping Module (depends on Kitchen Data)
7. Planner Module (depends on Recipes, Shopping)

## Common Pitfalls

### ❌ Don't Do This:
```tsx
// Hardcoded colors
<div className="bg-orange-600">

// Arbitrary values
<div className="z-[999]">

// localStorage for backend data
localStorage.setItem('users', JSON.stringify(users));

// No loading states
<Button onClick={handleDelete}>Delete</Button>

// No dark mode
<div className="bg-white text-black">
```

### ✅ Do This Instead:
```tsx
// Semantic tokens
<div className="bg-primary">

// Standard Tailwind
<div className="z-50">

// Backend persistence
await backend.updateUsers(users);

// Proper loading states
<Button onClick={handleDelete} disabled={isDeleting}>
  {isDeleting ? 'Deleting...' : 'Delete'}
</Button>

// Dark mode support
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
```

## Questions?

When in doubt:
1. Check the reference implementation (Admin Module)
2. Review this guide
3. Check shadcn/ui docs: https://ui.shadcn.com/docs/components
4. Ask in code review

## Companion Documents

- [Design System Documentation](./design-system/) - Tokens, components, patterns
- [Testing Guide](./TESTING.md) - Test strategy and examples
- [Contract Gate Guide](./contract-gate/) - Type safety and validation
