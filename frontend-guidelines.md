
# SALT - Frontend Guidelines

The frontend is responsible for presentation and user interaction. It must remain "thin" and rely on the backend for all complex processing.

## 1. Component Standards
- **UI Library:** Use the standardised components in `components/UI.tsx`.
- **Styling:** Tailwind CSS only. Maintain the neutral grayscale palette with blue (#2563eb) accents.
- **Touch Targets:** Minimum **44px** for standard interactions; **60px** for Kitchen Mode controls.
- **Responsive:** Mobile-first. Sidebars must transform into drawers for widths < 1024px.

## 2. Architect vs. Chef (Density Split)
Salt employs a dual-density strategy to balance planning depth with cooking accessibility.

### A. Architect Density (The Sofa)
- **Used In:** Planner, Inventory, Recipes (Refine Mode), Admin.
- **Goal:** Maximum information density for high-level management.
- **Scaling:** Standard 100% root size. Components use minimal padding (py-2) to fit more data on screen.

### B. Service Visibility (The Kitchen)
- **Used In:** Recipes (Cook Mode).
- **Goal:** Legibility from a distance and "Messy Hands" accessibility.
- **Scaling:** Instruction text is scaled to 150-200% (text-2xl/3xl). 
- **Interactions:** Oversized touch targets (min 60px height) and card-based step focus.

## 3. Data Handling
- **State Management:** Use the Orchestrator pattern in `App.tsx` for global state.
- **Contracts:** Always import types from `types/contract.ts`. Never define local interfaces for data that should be in the global contract.
- **Pruning:** Before the UI sends objects back for AI processing or snapshot storage, ensure recursive structures (like `history`) are pruned to save tokens and storage space.

## 4. DO NOT MODIFY
- Do not hardcode AI prompt strings in TSX files.
- Do not bypass `saltBackend` to make direct API calls to third-party services.
- Do not change the global font family (Inter) or core spacing scale.
