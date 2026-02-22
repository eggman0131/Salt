# Interaction Patterns

Interaction patterns define when and how to use common UI elements like modals, inline editing, and action bars.

---

## Modals

Modals interrupt the user and demand attention. Use them sparingly.

### Valid Use Cases

- **Destructive confirmations** — "Are you sure you want to delete?"
- **Small, self-contained forms** — Add a tag, confirm filter settings
- **Contextual overlays** — Image preview, quick reference

### Invalid Use Cases

- **Primary workflows** — Don't bury main tasks in modals
- **Editing large forms** — Use full pages or side panels
- **Navigation replacement** — Don't use modals as routing

### Sizing

- **Max-width:** `90vw` (90% of viewport width)
- **Behaviour:** Modal only uses width it needs (content-driven)
- **Min-width:** `320px` (ensure readability on narrow viewports)
- **Height:** Auto-size to content, scroll if exceeds `90vh`

```tsx
<DialogContent className="max-w-[90vw] w-auto max-h-[90vh] overflow-y-auto">
  {/* Modal content auto-sizes */}
</DialogContent>
```

### Implementation

Use shadcn/ui `Dialog`:

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete Equipment?</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    
    <p className="text-sm">
      Are you sure you want to delete {equipment.name}?
    </p>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Modal Rules

- **Single primary action** in footer
- **"Cancel" always on the left**, primary on right
- **Destructive action** stands out visually (red, right-aligned)
- **Max-width constraint** — modals don't stretch full screen
- **Keyboard support** — Escape to close, Enter to confirm (defaults in shadcn)

---

## Inline Editing

Inline editing allows users to modify content without leaving the current view.

### Pattern

1. **Resting state:** Display as text
2. **On click/hover:** Show edit affordance (icon)
3. **Edit mode:** Replace text with input
4. **Save/Cancel:** Commit or revert changes

### Implementation

```tsx
const [isEditing, setIsEditing] = useState(false);
const [value, setValue] = useState(initialValue);

if (isEditing) {
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <Button size="sm" onClick={handleSave}>
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsEditing(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

return (
  <div
    className="flex gap-2 items-center group"
    onClick={() => setIsEditing(true)}
  >
    <span>{value}</span>
    <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
  </div>
);
```

### Rules

- **Keep layout stable** — Don't shift content dramatically
- **Show affordance on hover** — Icon appears when hoverable
- **Quick save** — No extra modal confirmation
- **Show loading state** if API call needed
- **Restore on error** — If save fails, show toast and stay in edit mode

---

## Action Bars

Action bars sit at the bottom of pages/modals with consistent button ordering.

### Pattern

**Left side:** Cancel/secondary actions
**Right side:** Destructive (if present), then primary

```tsx
<div className="border-t border-border p-4 flex gap-3 justify-end">
  <Button variant="outline">
    Cancel
  </Button>
  {canDelete && (
    <Button variant="destructive">
      Delete
    </Button>
  )}
  <Button>
    Save
  </Button>
</div>
```

### Rules

- **Button order:** Cancel → Destructive → Primary
- **Destructive right of cancel** to prevent mis-clicks
- **Primary rightmost** and most prominent
- **Spacing:** `gap-3` between buttons
- **Padding:** `p-4` for touch targets
- **Border top:** Separate from content with `border-t`
- **Sticky on scroll:** For long forms, fix to bottom

### Sticky Action Bar

```tsx
<div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card p-4 flex gap-3 justify-end shadow-lg">
  {/* Buttons */}
</div>
```

---

## Search & Filter

Search/filter patterns allow users to narrow options.

### Search Workflow

1. **Input field** — Focus on load
2. **Debounced query** — Wait for user to type
3. **Loading state** — Show spinner while searching
4. **Results list** — Display candidates
5. **Select candidate** — Close search, populate field

```tsx
const [query, setQuery] = useState('');
const [results, setResults] = useState([]);
const [isSearching, setIsSearching] = useState(false);

const handleSearch = useCallback(
  debounce(async (q) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const data = await api.search(q);
    setResults(data);
    setIsSearching(false);
  }, 300),
  []
);

return (
  <div className="space-y-4">
    <div className="flex gap-2">
      <Input
        placeholder="Search..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          handleSearch(e.target.value);
        }}
        autoFocus
      />
      {isSearching && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
    
    <div className="space-y-2">
      {results.map(item => (
        <button
          key={item.id}
          onClick={() => handleSelect(item)}
          className="w-full text-left p-3 rounded-md hover:bg-muted"
        >
          {item.name}
        </button>
      ))}
    </div>
  </div>
);
```

---

## Empty States

Empty states guide users when no data exists.

```tsx
{items.length === 0 ? (
  <div className="rounded-lg border border-dashed p-8 text-center">
    <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">
      No items yet. {actionLink}
    </p>
  </div>
) : (
  {/* List */}
)}
```

### Rules

- **Icon** — Visual indicator of emptiness
- **Text** — Brief, actionable message
- **Action link** — "Create one" or "Learn more"
- **Spacing** — Generous padding and breathing room

---

## Loading & Disabled States

### Loading Button

```tsx
import { Loader2 } from 'lucide-react';

<Button disabled={isLoading}>
  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
  {isLoading ? 'Saving...' : 'Save'}
</Button>
```

### AI Loading Indicator

When waiting for Gemini AI responses, use the standard spinner:

```tsx
<div className="flex items-center gap-2">
  <Loader2 className="h-5 w-5 animate-spin text-primary" />
  <span className="text-sm text-muted-foreground">Thinking...</span>
</div>
```

### Disabled Input

```tsx
<Input disabled placeholder="... loading" />
```

### Rules

- **Show spinner** while loading (use `Loader2` icon)
- **Update button text** to indicate action ("Saving...")
- **Disable all related inputs** to prevent multi-submit
- **Keep focus** — Don't move focus away during load
- **AI responses:** Always show spinner + contextual text ("Generating recipe...")
- **Transition duration:** 200ms for opacity changes

---

## Summary

- **Use modals for urgent, small decisions**
- **Use inline editing for quick field changes**
- **Order action buttons consistently** (Cancel, Destructive, Primary)
- **Provide loading / error states**
- **Always show empty states**
