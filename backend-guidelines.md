# SALT - Backend Guidelines

The backend implements the `ISaltBackend` interface via a strict inheritance hierarchy.

## 1. The Golden Rule of Inheritance
Salt uses a "Split-Brain" architecture:
- **BaseSaltBackend (The Brain):** Houses ALL prompt processing, shared logic, and JSON sanitization. It is transport-agnostic and defines AI requirements via abstract methods.
- **Specific Implementation (The Hands):** (Simulated or Firebase) Houses ONLY persistence, authentication, and the actual AI delivery mechanism.

## 2. Generative Transport (Security)
To ensure the application can be made production-ready:
- **Base class** defines `protected abstract callGenerateContent` and `callGenerateContentStream`.
- **Simulated backend** implements these using the client-side Gemini SDK for ease of development.
- **Firebase backend** implements these to facilitate the transition to server-side security. 
- **Production Security:** When deploying publicly, `SaltFirebaseBackend` should simply replace its transport implementation with a `fetch()` call to a secure Firebase Function. This hides the API key from the browser while preserving all "Brain" logic in the base class.

## 3. Persistence Standards
- **Firestore Mapping:** Map Firestore Collections to Salt Entities:
  - `inventory` -> `Equipment`
  - `recipes` -> `Recipe`
  - `plans` -> `Plan`
  - `users` -> `User`
- **Strict Strings:** Never allow Firebase-specific types (Timestamps, GeoPoints) to leak into the application state. Convert them at the entry/exit point of the backend implementation.

## 4. Gemini SDK Constraints
- The `GoogleGenAI` SDK should only be instantiated and called within the concrete transport implementations in the "Hands" classes.
- Use the `sanitizeJson` helper provided by the "Brain" for all AI outputs.

## 5. DO NOT MODIFY
- Do not change the `ISaltBackend` interface signature.
- Do not bypass the transport layer when adding new AI features to the "Brain".
