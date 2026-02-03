# SALT - Frontend Guidelines

The frontend is responsible for presentation and user interaction. It must remain "thin" and rely on the backend for all complex processing.

## 1. Component Standards
- **UI Library:** Use the standardised components in `components/UI.tsx`.
- **Styling:** Tailwind CSS only. Maintain the neutral grayscale palette with blue (#2563eb) accents.
- **Touch Targets:** Minimum **44px** for standard interactions; **60px** for Kitchen Mode controls.
- **Responsive:** Mobile-first. Sidebars must transform into drawers for widths < 1024px.

## 2. Dual-Mode Execution
- **Refine Mode:** Standard layout. Focus on data density and chat interaction.
- **Kitchen Mode:**
  - Font scale increase (150%) for method steps.
  - Card-based step-by-step navigation.
  - Interactive checklists for "Mise en Place".

## 3. Data Handling
- **State Management:** Use the Orchestrator pattern in `App.tsx` for global state.
- **Contracts:** Always import types from `types/contract.ts`. Never define local interfaces for data that should be in the global contract.
- **Pruning:** Before sending objects to the UI, ensure they are hydrated. Before the UI sends them back for AI processing, ensure images and history are stripped to save tokens.

## 4. DO NOT MODIFY
- Do not hardcode AI prompt strings in TSX files.
- Do not bypass `saltBackend` to make direct API calls to third-party services.
- Do not change the global font family (Inter) or core spacing scale.