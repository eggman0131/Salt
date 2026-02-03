# SALT - Prompt Guidelines

`backend/prompts.ts` contains the "Soul" of the application. It dictates how the AI behaves, speaks, and thinks.

## 1. Structure
- **SYSTEM_CORE:** The foundational identity of the Salt Kitchen System. Must be included in every Gemini `systemInstruction`.
- **Templates:** Use function-based templates for dynamic queries (e.g., `details: (brand, model) => ...`).

## 2. Content Constraints
- **Character:** The AI is a technical expert, not a generic assistant. It is precise, minimalist, and uses British culinary standards.
- **Knowledge Retrieval:** The AI must always be told about the user's `Inventory` to ensure recipe methods are executable with available kit.
- **Output:** AI responses meant for data updates must be valid JSON strings that conform to the Zod contracts.

## 3. Maintenance
- This file is intended for manual refinement. 
- Do not let Copilot "refactor" these prompts into generic versions.
- If a new feature requires AI interaction, a new constant must be added here first.

## 4. DO NOT MODIFY
- Do not remove the British English terminology enforcement.
- Do not remove the Metric unit enforcement.
- Do not hardcode user-specific data into the prompt templates; pass them as arguments from `api.ts`.