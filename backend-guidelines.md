# SALT - Backend Guidelines

The backend implements the `ISaltBackend` interface via a strict inheritance hierarchy.

## 1. The Golden Rule of Inheritance
Salt uses a "Split-Brain" architecture:
- **BaseSaltBackend (The Brain):** Houses ALL `@google/genai` calls, prompt processing, and JSON sanitization. This is LOCKED.
- **Specific Implementation (The Hands):** (Simulated or Firebase) Houses ONLY persistence and authentication logic.

**MIGRATION RULE:** If you are implementing a new backend (e.g. Firebase), you are forbidden from calling the Gemini API directly. You must rely on the protected methods in `BaseSaltBackend`.

## 2. Persistence Standards
- **Firestore Mapping:** Map Firestore Collections to Salt Entities:
  - `inventory` -> `Equipment`
  - `recipes` -> `Recipe`
  - `plans` -> `Plan`
  - `users` -> `User`
- **Strict Strings:** Never allow Firebase-specific types (Timestamps, GeoPoints) to leak into the application state. Convert them at the entry/exit point of the backend implementation.

## 3. Gemini SDK Constraints
- Use `process.env.API_KEY` for initialization.
- Never hardcode model names outside of `BaseSaltBackend`.
- Use the `sanitizeJson` helper for all AI outputs. Gemini often wraps JSON in ``` blocks; this helper is the only authorized way to strip them.

## 4. DO NOT MODIFY
- Do not change the `ISaltBackend` interface signature.
- Do not add "helper" methods to the backend that bypass the contract.
