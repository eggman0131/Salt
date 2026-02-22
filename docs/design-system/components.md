# Components

Components are built on top of primitives and shadcn/ui. They follow consistent patterns for buttons, forms, lists, and badges.

---

## Buttons

Buttons communicate intent and trigger actions. shadcn/ui provides the base, with these semantic rules:

### Primary

- **Usage:** Main action per screen
- **Style:** Filled with `bg-primary`
- **Behaviour:** One per screen (destructive secondary may also exist)
- **Text:** Verb-based ("Save", "Continue", "Delete")

```tsx
<Button onClick={handleSave}>
  Save Equipment
</Button>
```

### Secondary

- **Usage:** Alternative actions
- **Style:** `variant="outline"` or subtle
- **Behaviour:** Multiple allowed
- **Text:** Supportive ("Cancel", "Back", "Learn more")

```tsx
<Button variant="outline">
  Cancel
</Button>
```

### Destructive

- **Usage:** Irreversible actions
- **Style:** `variant="destructive"` (red)
- **Behaviour:** Visually distinct, never look like primary
- **Text:** Clear intent ("Delete", "Remove", "Discard")

```tsx
<Button variant="destructive">
  Delete Equipment
</Button>
```

### Ghost / Icon

- **Usage:** Subtle actions (close, expand, info)
- **Style:** `variant="ghost"` or `size="icon"`
- **Behaviour:** Low visual weight

```tsx
<Button variant="ghost" size="icon">
  <X className="h-4 w-4" />
</Button>
```

### Rules

- **Never mix random button styles** within a flow
- **Icons aligned left** with `mr-2` spacing
- **Destructive ≠ Primary** (red vs blue)
- **One primary per page/modal**
- All button text is **title-case** (British English)

---

## Forms

Forms gather user input with consistent patterns.

### Field Layout

```tsx
<div className="space-y-2">
  <Label htmlFor="field-id">
    Field Label
  </Label>
  <Input
    id="field-id"
    placeholder="Help text"
    value={value}
    onChange={handleChange}
  />
  {error && (
    <p className="text-xs text-destructive">
      {error}
    </p>
  )}
</div>
```

### Validation Timing

- **Show errors:** **On submit** (not on blur, not real-time)
- **Clear errors:** On user edit (real-time after first error)
- **Success states:** Show checkmark after successful submission
- **Disabled during submit:** Prevent double-submission

```tsx
const [errors, setErrors] = useState({});
const [touched, setTouched] = useState({});

const handleSubmit = (e) => {
  e.preventDefault();
  const validationErrors = validate(formData);
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }
  // Submit...
};

const handleChange = (field, value) => {
  setFormData({ ...formData, [field]: value });
  // Clear error for this field after first validation
  if (errors[field]) {
    setErrors({ ...errors, [field]: undefined });
  }
};
```

### Input States

- **Normal:** Default styling
- **Focus:** Ring indicator (handled by shadcn/ui)
- **Error:** Red border + error text below
- **Disabled:** Reduced opacity (0.5), `cursor-not-allowed`
- **Read-only:** Same styling as normal but with `readOnly` attribute (no disabled styling)
- **Success:** Green accent (optional, for post-submit feedback)

```tsx
{/* Disabled */}
<Input disabled placeholder="Cannot edit" />

{/* Read-only */}
<Input readOnly value="View only" />

{/* Error state */}
<Input className="border-destructive" />
```

### Rules

- **Label + Input stacked** (not inline)
- **Label styling:** `text-sm font-medium`
- **Help text:** Muted colour, smaller size (`text-xs text-muted-foreground`)
- **Errors:** Use `text-destructive` colour, show **on submit only**
- **Spacing between fields:** `space-y-4` or `space-y-6`
- **No ad-hoc form layouts** — use primitives

### Multi-field Forms

Use `space-y-4` between field groups:

```tsx
<div className="space-y-4">
  {/* Name field */}
  <div className="space-y-2">...</div>
  
  {/* Email field */}
  <div className="space-y-2">...</div>
  
  {/* Buttons */}
  <div className="flex gap-3 justify-end pt-2">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </div>
</div>
```

---

## Lists & Checkboxes

Lists display collections with consistent structure.

### Checkbox Item

**Structure:**
- Checkbox (left) → selectable area
- Title (bold, regular) + description (muted, smaller)
- Optional tag/badge (right)
- Consistent `p-3` padding + `rounded-md` border

```tsx
<div className="flex gap-3 items-start p-3 border rounded-md">
  <Checkbox
    checked={owned}
    onCheckedChange={handleToggle}
  />
  <div className="flex-1 min-w-0">
    <p className="font-medium text-sm">
      Pasta Attachment
    </p>
    <p className="text-xs text-muted-foreground">
      Compatible with Kenwood mixers
    </p>
  </div>
  <Badge variant="outline" className="shrink-0">
    Accessory
  </Badge>
</div>
```

### List Container

```tsx
<div className="space-y-2">
  {items.map(item => (
    <CheckboxItem key={item.id} item={item} />
  ))}
</div>
```

### Rules

- **Checkbox always left**
- **Text stacked** (title + description)
- **Tag/badge right-aligned** and non-interactive
- **Consistent spacing:** `gap-3`, `p-3`, `space-y-2`
- **Consistent typography:** Title is `font-medium text-sm`, description is `text-xs text-muted-foreground`

---

## Tags / Badges

Badges classify or label items.

### Variants

- `variant="default"` — Primary badge
- `variant="secondary"` — Secondary badge
- `variant="outline"` — Bordered badge
- `variant="destructive"` — Error/warning badges

### Usage

```tsx
<Badge>Equipment</Badge>
<Badge variant="secondary">Verified</Badge>
<Badge variant="outline">Optional</Badge>
</Badge>
```

### Rules

- **Use semantic colours** (don't hardcode)
- **Size:** `text-xs` or `text-sm`
- **No custom badge styles** — use variants
- **Padding/radius:** Handled by shadcn/ui
- **If you need a new semantic badge type**, create a variant

---

## Modals & Dialogs

See [Interaction Patterns](./interaction-patterns.md) for modal rules.

Use shadcn/ui `Dialog` component:

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Delete</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Additional Component Patterns

### Select Dropdowns

Use shadcn/ui `Select` component:

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Choose an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option-1">Option 1</SelectItem>
    <SelectItem value="option-2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

**Rules:**
- Use custom select (not native) for consistency across mobile/desktop
- Keyboard navigation: Arrow keys, Enter to select, Escape to close
- Max-height on dropdown content to prevent overflow

### Radio Buttons & Toggles

**Radio buttons** — Mutually exclusive options (one selection):
```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

<RadioGroup value={selected} onValueChange={setSelected}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option-1" id="r1" />
    <Label htmlFor="r1">Option 1</Label>
  </div>
</RadioGroup>
```

**Toggle switches** — Boolean on/off states:
```tsx
import { Switch } from '@/components/ui/switch';

<div className="flex items-center gap-2">
  <Switch checked={enabled} onCheckedChange={setEnabled} />
  <Label>Enable feature</Label>
</div>
```

**When to use:**
- **Checkbox:** Multiple selections, task lists
- **Radio:** Single selection from 2-6 options
- **Toggle:** Binary on/off, immediate effect (no submit)
- **Select:** Single selection from 7+ options

### Tabs

Use shadcn/ui `Tabs` component:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Overview</TabsTrigger>
    <TabsTrigger value="tab2">Details</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">
    {/* Content */}
  </TabsContent>
  <TabsContent value="tab2">
    {/* Content */}
  </TabsContent>
</Tabs>
```

**Keyboard navigation:** Arrow keys to move between tabs, Enter to select

### Tooltips & Popovers

**Tooltip** — Brief helper text on hover/focus:
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <Info className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Additional context</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Popover** — Interactive content, click-triggered:
```tsx
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Open</Button>
  </PopoverTrigger>
  <PopoverContent>
    {/* Interactive content */}
  </PopoverContent>
</Popover>
```

**When to use:**
- **Tooltip:** Non-interactive, hover/focus, disappears quickly
- **Popover:** Interactive (links, forms), click-triggered, stays open

---

## Summary

All components follow:
- **Token-based spacing** (no arbitrary values)
- **Semantic token colours** (primary, destructive, muted, etc.)
- **shadcn/ui primitives** (buttons, inputs, dialogs, selects, tabs, etc.)
- **Consistent typography** (sizes and weights from tokens)
- **Validation on submit** (not on blur, not real-time)
- **200ms transitions** with spring easing
- **No one-off styling** unless justified
