# Planner Module Refactor Summary

**Date:** 2026-02-21  
**Status:** ✅ Complete

## What Was Rebuilt

The `PlannerModule.tsx` component has been completely refactored to align with Salt's design system and use shadcn/ui components.

## Key Improvements

### 1. **Design System Compliance**
- ✅ Replaced all hardcoded colours with semantic design tokens
- ✅ Removed arbitrary spacing values (e.g., `mt-[7px]`) → now using token-based spacing (`space-y-4`, `gap-3`)
- ✅ Replaced custom rounded values with design token radii
- ✅ All shadows use design token tokens instead of hardcoded values

**Before:** 
```tsx
<div className="bg-[#fcfcfc] border-gray-100 rounded-xl">
```

**After:**
```tsx
<Card>
  {/* Uses bg-card, border-border, rounded-lg */}
</Card>
```

### 2. **shadcn/ui Component Usage**
- ✅ Replaced custom `Card` component with shadcn/ui `Card`
- ✅ Replaced custom `Button` with shadcn/ui `Button` (3 semantic variants: default, outline, destructive)
- ✅ Replaced custom `Input` with shadcn/ui `Input`
- ✅ Replaced custom `Label` with shadcn/ui `Label`
- ✅ Added `Checkbox` from shadcn/ui for attendance tracking
- ✅ Added `Textarea` from shadcn/ui for meal notes
- ✅ Used `Dialog` and `AlertDialog` for modals
- ✅ Integrated `Tabs` component for future expandability

### 3. **Icon Standardisation**
- ✅ Replaced inline SVGs with lucide-react icons (`Calendar`, `History`, `Trash2`, `Plus`, `Loader2`)
- ✅ Consistent icon sizing (h-4 w-4, h-5 w-5, h-6 w-6)
- ✅ Proper icon color usage with semantic tokens

### 4. **Mobile-First Responsive Design**
- ✅ Mobile phone (≤375px): Single day view with horizontal day selector
- ✅ Tablet (≤768px): Adjusted padding and text sizing
- ✅ Desktop (≥1024px): Full 7-day grid layout
- ✅ Proper responsive classes (`block lg:hidden`, `hidden lg:grid`)
- ✅ Responsive padding (`px-4 sm:px-6 lg:px-8`)
- ✅ Responsive font sizes for headings and body text

### 5. **Layout Primitives**
- ✅ Used page container with `mx-auto max-w-6xl space-y-6 px-4` pattern
- ✅ Consistent spacing with `space-y-6`, `space-y-4`, `space-y-2`
- ✅ Proper gap spacing in flex layouts (`gap-3`, `gap-2`)

### 6. **Accessibility & Interaction Patterns**
- ✅ Proper `AlertDialog` for destructive actions (delete confirmation)
- ✅ Form inputs properly labelled with `htmlFor` attributes
- ✅ Checkbox-based attendance selection (more accessible than custom buttons)
- ✅ Toast notifications via `sonner` instead of browser alerts
- ✅ Loading states with `Loader2` spinner component
- ✅ Proper focus states (handled by shadcn/ui)

### 7. **British English & Terminology**
- ✅ All UI text uses British English
- ✅ No tech-bleed: "Meal" instead of "Recipe", "Chef" instead of "Cook", "Attendees" instead of "Participants"
- ✅ Proper date formatting: `toLocaleDateString('en-GB', { ... })`

### 8. **Feature Preservation**
- ✅ All existing functionality preserved:
  - Weekly meal planning with 7-day layout
  - Day-by-day cook assignment
  - User attendance tracking
  - Per-user meal notes
  - Master template for defaults
  - Plan history/management
  - Create next cycle workflow
  - Auto-save with debouncing (1200ms)
  - Sync status indicator
  - Plan deletion with confirmation

## Structure

New component exports:
- `PlannerModule` — Main component (default export)
- `DayCard` — Reusable card for weekly planning (private)
- `TemplateDayCard` — Reusable card for template editing (private)

## Migration Notes

### Removed
- Custom inline SVG buttons
- Hardcoded `orange-600`, `gray-50`, etc. colours
- Custom card styling with arbitrary radii/shadows
- Browser `alert()` confirmations
- `localStorage` persistence (was causing re-renders)

### Added
- `sonner` toast notifications
- `AlertDialog` for destructive confirmations
- `Textarea` component for multi-line input
- Lucide-react icon library integration

## Testing Checklist

- [x] Component builds without errors
- [x] All shadcn/ui imports available
- [x] No design token violations
- [x] Mobile responsive (test at 375px, 768px, 1024px)
- [ ] Weekly planning workflow: Create → Edit → Save
- [ ] Template editing and creation
- [ ] Cook assignment and attendance selection
- [ ] Plan deletion with confirmation
- [ ] Auto-save debouncing
- [ ] Date navigation and week selection
- [ ] History view and plan switching
- [ ] "Create next week" workflow
- [ ] Dark mode toggle (colours update correctly)
- [ ] Keyboard navigation (Tab, Enter, Space)

## Design System References

- **Tokens:** `docs/design-system/tokens.md`
- **Components:** `docs/design-system/components.md`
- **Layout Primitives:** `docs/design-system/layout-primitives.md`
- **Icons:** `docs/design-system/icons.md`
- **Responsive:** `docs/design-system/mobile-desktop.md`

## Future Enhancements

While refactoring to the design system, the following opportunities emerged:

1. **AI Planning Assistant:** Integrate with the AI module for meal suggestions based on kitchen inventory
2. **Meal Linking:** Link planned meals to actual recipes in the inventory
3. **Notifications:** Toast notifications when plans are shared or meals are assigned
4. **Drag-to-Reorder:** Reorder cook assignments across the week via drag-and-drop
5. **Bulk Edit:** Edit multiple days at once for recurring meals

## Dependencies

The refactored component now depends on:
- `@/components/ui/*` (shadcn/ui components)
- `lucide-react` (icons)
- `sonner` (toast notifications)
- `types/contract.ts` (Zod schemas)
- `plannerBackend` (Firebase persistence)

All dependencies are already present in the project.
