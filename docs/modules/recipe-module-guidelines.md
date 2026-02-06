
# SALT - Recipe Module Guidelines

This document defines the domain logic, AI protocols, and execution standards for the Recipe Module.

## 1. The Dual-Mode Paradigm
Every recipe view must support two distinct, switchable states.

### A. Refine Mode (The Architect)
- **Visuals:** High information density. 
- **Focus:** Ingredients list, technical metadata (time/servings), and version history.
- **AI Role:** The "Sous-Chef" chat is active here for discussing modifications.

### B. Kitchen Mode (The Execution)
- **Visuals:** 150% font scale for instructions. 
- **Focus:** Single-step focus, oversized touch targets (min 60px), and progress tracking.
- **Interactions:** "Mise en Place" checklist must be completed or acknowledged before the first instruction step appears.

## 2. AI Consensus Workflow
The AI must never update a recipe document directly from a chat message. It follows this strict chain:
1. **The Discussion:** Natural language chat between User and AI.
2. **The Consensus:** AI generates a `Consensus Draft` (JSON) summarizing agreed changes.
3. **The Synthesis:** AI uses the draft to generate the final `Recipe` object.
4. **The Snapshot:** A lean history entry is created before saving the update.

## 3. Data Integrity
- **Object Pruning:** Before sending objects to Gemini or creating history snapshots, ensure recursive metadata (like the `history` array itself) is pruned to keep data structures manageable.
- **Metric Enforcement:** If the AI suggests 'cups', the backend must reject the update and request a re-conversion to grams (g) or millilitres (ml).

## 4. DO NOT MODIFY
- Do not allow the AI to suggest non-UK ingredients (e.g. Zucchini instead of Courgette).
- Do not remove the "Safety Snapshot" logic when restoring old versions from history.
