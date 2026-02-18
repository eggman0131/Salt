# Versioning & Evolution

The design system is a living asset that evolves with the application. This document explains how changes are managed.

---

## Principle: Intentional Evolution

All changes to the design system must be:

1. **Intentional** — Solves a real problem or gap
2. **Documented** — Clear before/after with rationale
3. **Backwards-compatible** — Where possible
4. **Validated** — Tested in production before rollout

---

## Change Categories

### Minor (Token or Template Update)

A minor change adjusts existing values without altering structure.

**Examples:**
- Colour lightness adjusted for accessibility
- Spacing token refined (16px → 18px)
- Button corner radius increased
- Font weight emphasis

**Process:**
1. Update token in `/styles/index.css`
2. Test in affected modules
3. Update documentation
4. No need for major version bump

### Major (New System Element)

A major change adds new capability or fundamentally alters the system.

**Examples:**
- New primitive introduced (Layout manager, Grid system)
- New semantic token (Success, Warning colours)
- New component pattern (Data table, inline forms)
- Icon system standardization

**Process:**
1. Draft design document with rationale
2. Implement in pilot module
3. Validate across breakpoints and interactions
4. Document extensively
5. Gradually migrate existing modules
6. Consider version bump (e.g., v2.0.0)

---

## Documentation & Changelog

All changes to the design system must be documented:

1. **CHANGELOG.md** — High-level summary of changes
2. **Relevant guide file** — Detailed documentation
3. **Code comments** — Why a pattern exists, not just what it does

### CHANGELOG Format

```markdown
## v2.1.0 (2026-02-18)

### Added
- New `--space-5` token for 20px spacing
- Icon sizing guide in icons.md
- Dark mode colour tokens for all semantic palettes

### Changed
- Primary blue lightened from 0.50 to 0.52 OKLCH for better contrast
- Card radius increased from 8px to 10px

### Deprecated
- Old BEM-style CSS utilities (to be removed in v3.0.0)

### Fixed
- Focus ring contrast in dark mode
```

---

## Rollout Strategy

### Phase 1: Pioneer Module
Implement the new pattern in one module:
- Test thoroughly
- Gather feedback
- Refine based on usage

### Phase 2: Documentation
Update design system docs:
- Add examples
- Explain when/why to use
- Link from main navigation

### Phase 3: Team Awareness
Communicate the change:
- Share in team channels
- Update copilot instructions if needed
- Highlight in README

### Phase 4: Gradual Migration
Existing modules adopt the new pattern:
- Update on next major feature
- Don't force rewrites for cosmetic changes
- Allow exceptions for technical debt

### Phase 5: Deprecation (If Needed)
Mark old patterns as deprecated:
- Document why they're being phased out
- Show migration path
- Set removal date

---

## Breaking Changes

Breaking changes should be rare and well-communicated.

**Example:** Renaming `--color-neutral` to `--color-muted`

**Migration Path:**
1. Update `/styles/index.css` with both old and new names
   ```css
   :root {
     --color-muted: oklch(...);
     --color-neutral: var(--color-muted); /* Deprecated */
   }
   ```
2. Update docs to use new name
3. Deprecation notice in CHANGELOG
4. 2-3 release cycle before removal
5. Create migration guide in `/docs/MIGRATIONS.md`

---

## Design System Decisions

When considering a change, ask:

1. **Problem:** What's the core issue this solves?
2. **Impact:** How many modules are affected?
3. **Backwards Compatibility:** Can we support both old and new?
4. **Complexity:** Does this add cognitive load?
5. **Testing:** How will we validate it?
6. **Documentation:** Can we explain it clearly?

---

## Example: Adding a New Token

### Current State
Badge styling uses arbitrary roundedValues:
```tsx
<span className="px-2 py-1 rounded-md bg-primary">Tag</span>
```

### Problem
- Inconsistent rounding across components
- No scale for intermediate radii
- Doesn't map to design tokens

### Solution
Add `--radius-sm` (4px) for badges and pills

### Process

**1. Design Decision**
- New token: `--radius-sm: 0.25rem`
- Use cases: badges, pills, small buttons

**2. Update Styles**
```css
:root {
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.625rem;
}
```

**3. Update Components**
```tsx
<span className="px-2 py-1 rounded-sm bg-primary">
  Tag
</span>
```

**4. Document**
Update `tokens.md`:
```markdown
- `--radius-sm` — Small elements (badges, pills, inline buttons)
```

**5. Update Guide**
Mention new usage in `components.md` under "Tags / Badges"

**6. Changelog**
```markdown
### Added
- New `--radius-sm` token for badges and pills
```

**7. Communicate**
Share update with team, highlight in copilot instructions

---

## Long-term Vision

The design system should eventually:

- ✅ Support 3+ breakpoints effortlessly (mobile, tablet, desktop)
- ✅ Have theme switching (light, dark, custom)
- ✅ Support right-to-left layouts (for future localization)
- ✅ Provide comprehensive component library (20+ primitives/components)
- ✅ Include accessibility guidance for each component
- ✅ Have interactive Storybook for reference

---

## Measuring Success

The design system is successful when:

1. **Consistency** — UI looks cohesive across modules
2. **Velocity** — New features build faster
3. **Maintainability** — Easy to update styles globally
4. **Accessibility** — All interactions WCAG 2.1 AA compliant
5. **Developer Experience** — Team understands and follows patterns
6. **Documentation** — Clear examples and rationale

---

## Questions?

If you have questions about the design system or want to propose a change:

1. Check the documentation in `/docs/design-system/`
2. Look for examples in production modules
3. Bring to team discussion for larger changes
4. File an issue or discussion in the repository

---

## Summary

- **Design system evolves intentionally**, not accidentally
- **All changes documented** in this guide and CHANGELOG
- **Validate in pilot before rollout**
- **Migrate gradually** — don't force old modules to update
- **Break change carefully** — provide migration path
- **Measure success** through consistency, velocity, and DX
