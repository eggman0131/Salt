# Mobile & Desktop

Salt is mobile-first by default. The browser and Tailwind handle most differences naturally. We only diverge when interaction or layout fundamentally changes.

---

## Natural Defaults

Let the browser, Tailwind, and shadcn/ui do the heavy lifting:

- **Mobile is naturally tighter** — smaller viewports force compact layouts
- **Desktop naturally breathes** — more space available
- **Font sizes differ appropriately** — `text-sm` on mobile, `text-base` on desktop
- **Touch targets scale** — larger on mobile, tighter on desktop

### Example: No Explicit Divergence Needed

```tsx
{/* This works on both mobile and desktop */}
<div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 py-8 sm:py-12">
  <h1 className="text-xl sm:text-2xl">Title</h1>
  <p className="text-sm sm:text-base">Content</p>
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
    {/* Auto-scales */}
  </div>
</div>
```

Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) handle sizing automatically.

---

## Explicit Divergence

Only introduce mobile-specific or desktop-specific changes when:

1. **Layout becomes meaningfully different** — Single column → multi-column
2. **Interaction model changes** — Tap vs click, sheet vs modal
3. **Complexity demands it** — Content prioritization differs

### When Divergence is Appropriate

#### Navigation

**Mobile:** Hamburger menu
```tsx
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon">
      <Menu className="h-5 w-5" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left">
    {/* Sidebar content: nav links, user avatar, dark mode toggle */}
  </SheetContent>
</Sheet>
```

**Desktop:** Persistent sidebar
```tsx
<aside className="hidden md:flex flex-col w-64 border-r">
  {/* Sidebar with nav, user info, settings */}
</aside>
```

### Sidebar Content

Both mobile (sheet) and desktop (persistent) share sidebar content:

- **Navigation links** — Primary app sections
- **User avatar** — Profile picture + name
- **Dark mode toggle** — Switch near avatar (persists in `localStorage`)
- **Settings/Admin** — Secondary actions

```tsx
// Shared sidebar content component
export function SidebarContent() {
  const [isDark, setIsDark] = useState(
    localStorage.getItem('theme') === 'dark'
  );

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', !isDark);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Nav links */}
      <nav className="flex-1 space-y-2 p-4">
        {/* ... */}
      </nav>
      
      {/* User + Theme toggle */}
      <div className="border-t p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={user.avatar} />
          </Avatar>
          <span className="text-sm font-medium">{user.name}</span>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="w-full"
        >
          {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </Button>
      </div>
    </div>
  );
}
```

#### Forms

**Mobile:** Single column, full-width inputs
```tsx
<div className="space-y-4">
  <Input type="text" placeholder="Name" />
  <Input type="email" placeholder="Email" />
</div>
```

**Desktop:** Can use grid for related fields
```tsx
<div className="grid grid-cols-2 gap-4">
  <Input type="text" placeholder="First name" />
  <Input type="text" placeholder="Last name" />
</div>
```

#### Overlays

**Mobile:** Full-screen sheet
```tsx
<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="bottom">
    {/* Full-height overlay */}
  </SheetContent>
</Sheet>
```

**Desktop:** Modal or side panel
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    {/* Centered modal */}
  </DialogContent>
</Dialog>
```

---

## Responsive Prefix Guide

Tailwind breakpoints optimized for specific devices:

- **No prefix** — All viewports (mobile-first, optimized for Pixel 8 Pro: 412×915px)
- **`sm:`** — 640px and up (large phones, small tablets)
- **`md:`** — 1024px and up (iPad Pro 12.9" portrait: 1024×1366px)
- **`lg:`** — 1440px and up (modern laptops, 1440×900px+)
- **`xl:`** — 1920px and up (large desktop monitors)

### Design Targets

- **Mobile:** Google Pixel 8 Pro (412×915px, 6.7" display)
- **Tablet:** iPad Pro 12.9" portrait (1024×1366px)
- **Laptop:** Modern 13-15" laptops (1440×900px or 1920×1080px)

### Pattern: Mobile-First

```tsx
{/* Default: very tight on mobile */}
<div className="space-y-2 px-3 py-4">
  {/* On tablets and up: looser spacing */}
  {/* On desktops: even more generous */}
  <h1 className="text-lg sm:text-xl md:text-2xl">
    Title
  </h1>
  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
    {/* Stacked on mobile, side-by-side on tablet+ */}
  </div>
</div>
```

---

## Touch Safety

Mobile users need larger touch targets:

- **Minimum touch target:** 44×44px (11mm)
  - Buttons: `px-4 py-2` at least
  - Icons: `h-5 w-5` or larger
  
- **Spacing between targets:** At least 8px gap

```tsx
{/* Safe for touch */}
<div className="flex gap-3">
  <Button>Action</Button>
  <Button variant="outline">Cancel</Button>
</div>
```

---

## Content Prioritization

On mobile, prioritize the most important content:

**Mobile:** Show essentials only
```tsx
{!isMobile && <DetailedStats />}
```

**Desktop:** Show full information
```tsx
<div className="hidden md:block">
  <DetailedStats />
</div>
```

---

## Example: Complete Responsive Component

```tsx
export function EquipmentSection() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Title: Grows with viewport */}
      <h2 className="text-xl sm:text-2xl font-semibold">
        Equipment
      </h2>
      
      {/* Controls: Stack on mobile, inline on desktop */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <Input placeholder="Search..." className="flex-1" />
        <Button>Add Equipment</Button>
      </div>
      
      {/* Grid: 1 column mobile → 2 desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {equipment.map(item => (
          <Card key={item.id}>
            <CardContent className="space-y-2">
              <h3 className="font-medium text-sm sm:text-base">
                {item.name}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {item.brand}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Stats: Hidden on mobile, visible on desktop */}
      <div className="hidden md:grid grid-cols-3 gap-4">
        <Stat label="Total" value={equipment.length} />
        <Stat label="Available" value={available} />
        <Stat label="In Use" value={inUse} />
      </div>
    </div>
  );
}
```

---

## Testing

- **Viewport sizes:** Test at 375px (mobile), 768px (tablet), 1024px (desktop)
- **Touch interaction:** Test with actual touch device or browser dev tools
- **Font scaling:** Test with browser zoom (100%, 110%, 125%)
- **Orientation:** Test portrait and landscape on mobile

---

## Summary

- **Mobile-first by default** — Start with mobile constraints
- **Use Tailwind responsive prefixes** — `sm:`, `md:`, `lg:`
- **Avoid explicit mobile/desktop divergence** — Only when needed
- **Ensure touch safety** — 44×44px minimum targets
- **Prioritize content** — Show essentials first, details second
- **Test across breakpoints** — Mobile, tablet, desktop
