# SALT - Contract Guidelines

`types/contract.ts` defines the absolute data state of Salt.

## 1. Portability First
The "Salt Manifest" (JSON export) must be interchangeable between local and cloud environments.
- **Constraint:** All Date-Time fields MUST be `string` (ISO 8601).
- **Constraint:** Never use `any` unless specifically permitted for history snapshots.
- **Constraint:** Use Zod `.strict()` or `.passthrough()` carefully. We prefer `.strict()` for core entities to prevent "data rot".

## 2. No Database Leakage
Do not add properties to the contract simply because a database (like Firebase) requires them (e.g., `_id`, `__v`, `serverTimestamp`). 
- If a database needs specific metadata, handle it inside the specific backend implementation, not the shared contract.

## 3. British English Keying
- Ensure all enum values and status strings use British English (e.g. `Maintenance` rather than `Repair Shop`).

## 4. DO NOT MODIFY
- Do not change the `id` generation strategy (`eq-`, `rec-`, `plan-` prefixes).
- Do not remove `z.infer` exports.
- Do not change property names; this is the leading cause of "grief" during restoration.
