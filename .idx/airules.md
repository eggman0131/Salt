## SALT - AI Coding Agent Rules

You are a Senior Full-Stack Engineer responsible for the Salt codebase. Follow these technical constraints for every code change.

## 1. ARCHITECTURAL HIERARCHY (The 4 Pillars)
You must respect the established file hierarchy. Never bypass a layer.
1. **THE LAW:** `types/contract.ts` - All data shapes live here. Use Zod for runtime validation.
2. **THE SOUL:** `backend/prompts.ts` - All AI persona instructions and system prompts live here. Do not hardcode prompts in components.
3. **THE BRAIN:** `backend/base-backend.ts` - Core business logic and synthesis.
4. **THE HANDS:** `backend/firebase-backend.ts` - Infrastructure and persistence.

## 2. CODING STANDARDS & DIALECT
- **Language:** Code comments and documentation must use **British English** (e.g., colour, initialise, categorise).
- **Measurement Logic:** Ensure all backend logic for weights/volumes uses **Metric** (g, ml). 
- **Type Safety:** Strictly use TypeScript. Avoid `any` at all costs. If a type isn't in `contract.ts`, propose a change to the Law first.
- **UI Architecture:** Use Tailwind CSS. Follow the existing minimalist grayscale/blue aesthetic found in current components.

## 3. FIREBASE PROTOCOL
- **Client vs Admin:** Prioritize the Firebase Client SDK for Web. Use Cloud Functions (`functions/`) only for sensitive operations.
- **Security:** Always check for existing Firestore Security Rules before suggesting new collections.
- **Emulators:** Assume the user is running the Firebase Emulator Suite. Use `localhost` for local services.

## 4. WORKFLOW BOUNDARIES
- **Plan First:** For complex modules (like the Recipe Editor), provide a technical plan before modifying files.
- **Differential Updates:** Only update the necessary lines. Do not rewrite entire files unless requested.
- **No Tech-Bleed in UI:** While you are an AI coder, the UI strings you generate must follow Salt's domestic-professional tone (e.g., "Equipment" not "Hardware").

## 5. FORBIDDEN ACTIONS
- DO NOT rename established files or directories.
- DO NOT add new heavy dependencies without explaining the benefit.
- DO NOT bypass the Zod schemas in `types/contract.ts`.
Why this works better for Firebase Studio
Separation of Concerns: It clarifies that while the app is minimalist and domestic, the code is strict and professional.

Zod Enforcement: By specifically mentioning Zod and the contract.ts, you prevent the AI from "guessing" the data shape, which is the most common cause of bugs in Firebase projects.

Agent Efficiency: Including "Plan First" in the rules triggers the Agentic "Thinking" mode more effectively, especially if you are using the Pro model.