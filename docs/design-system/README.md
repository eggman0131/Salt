# Salt Design System

A unified foundation for consistent, predictable UI across all modules.

## What is this?

The design system defines the visual language, interaction patterns, and UI primitives used across the application. It ensures:

- Consistency across modules  
- Predictable behaviour  
- Reusable patterns  
- Clean, maintainable code  
- A shared vocabulary for developers and AI agents  

Built on:
- **Tailwind CSS** (utility engine)  
- **shadcn/ui** (component primitives)  
- **Custom primitives** (layout, structure, composition)
- **Design tokens** (colours, spacing, radii, typography, shadows)
- **Unified icon pipeline** (generated + custom SVGs)

---

## Quick Links

- **[Design Tokens](./tokens.md)** — Colors, spacing, radius, typography, shadows
- **[Layout Primitives](./layout-primitives.md)** — Page, Section, Stack, Inline, Card
- **[Components](./components.md)** — Buttons, forms, lists, badges
- **[Icons](./icons.md)** — Icon system and naming conventions
- **[Interaction Patterns](./interaction-patterns.md)** — Modals, inline editing, action bars
- **[Mobile & Desktop](./mobile-desktop.md)** — Responsive approach
- **[Contribution Guide](./contributions.md)** — Adding primitives, icons, components
- **[Versioning](./versioning.md)** — Evolution of the system

---

## Core Principle

**All modules must use these rules unless explicitly justified.**

When in doubt, use design tokens and primitives. Never hardcode values.
