# SALT Documentation

Welcome to the SALT Kitchen management system documentation. This folder contains comprehensive guidelines for architecture, development, and deployment.

## 📚 Quick Navigation

### Architecture & Design
- [**Backend Guidelines**](./architecture/backend-guidelines.md) — The split-brain architecture, SDK location, storage handling
- [**Frontend Guidelines**](./architecture/frontend-guidelines.md) — Component standards, dual-density UI, data handling
- [**Contract Guidelines**](./architecture/contract-guidelines.md) — Data portability, no database leakage, British English keying
- [**Firebase Backend Implementation**](./architecture/firebase-backend-implementation.md) — Binding protocol for production migration

### Module Specifications
- [**Inventory Module**](./modules/inventory-module-guidelines.md) — Equipment parent-child hierarchy, three-phase AI orchestration
- [**Planner Module**](./modules/planner-module-guidelines.md) — Weekly cycle rules, attendance logic, auto-save sync
- [**Recipe Module**](./modules/recipe-module-guidelines.md) — Dual-mode paradigm, AI consensus workflow, data integrity

### Development & Testing
- [**Change Management**](./development/change-management.md) — Update workflow, GitHub Copilot safety rules, data safety
- [**Prompt Guidelines**](./development/prompt-guidelines.md) — Prompt structure, content constraints, maintenance rules
- [**Audit: Contract & Simulated Behavior**](./development/audit-contract-simulated-behavior.md) — Complete method mapping, ID strategies, timestamp handling
- [**Parity Testing**](./development/parity-testing.md) — Run and troubleshoot backend parity tests

### Deployment
- [**Migration Roadmap**](./deployment/migration-roadmap.md) — Pre-production checklist, post-deployment validation, rollback plan

---

## 🎯 Common Tasks

### "I need to add a new feature"
1. Read [Change Management](./development/change-management.md)
2. Reference the relevant module guideline (Inventory, Planner, or Recipe)
3. Update contract if needed → prompts if needed → backend → frontend

### "I'm implementing the Firebase backend"
1. Start with [Firebase Backend Implementation](./architecture/firebase-backend-implementation.md)
2. Reference [Audit: Contract & Simulated Behavior](./development/audit-contract-simulated-behavior.md) for each method
3. Use [Parity Testing](./development/parity-testing.md) to validate your work

### "I need to verify backend behavior matches"
1. Run `npm run parity:relax` to test both backends
2. Review output according to [Parity Testing](./development/parity-testing.md)
3. Debug specific failures using [Audit: Contract & Simulated Behavior](./development/audit-contract-simulated-behavior.md)

### "I'm onboarding a new developer"
1. Start with [Backend Guidelines](./architecture/backend-guidelines.md) and [Frontend Guidelines](./architecture/frontend-guidelines.md)
2. Review [Contract Guidelines](./architecture/contract-guidelines.md) to understand the data model
3. Read the module guidelines relevant to their work area
4. Refer to [Change Management](./development/change-management.md) when making changes

---

## 🚫 Critical Rules (DO NOT VIOLATE)

**From Backend Guidelines:**
- Do not modify `BaseSaltBackend.ts` during migrations
- Do not instantiate Gemini SDK in the base class
- Do not leak Firestore Timestamp objects

**From Contract Guidelines:**
- Do not use `any` types (except for history snapshots)
- Do not change `id` generation strategies (`eq-`, `rec-`, `plan-` prefixes)
- Do not add database-specific fields to the contract

**From Prompt Guidelines:**
- Do not remove British English terminology enforcement
- Do not remove Metric unit enforcement
- Do not hardcode user data into prompts

**From Change Management:**
- Always update contract first, then prompts, then backend, then frontend
- Always backup before structural changes
- Always test restore after contract updates

---

## 📖 Reference by File Type

### `types/contract.ts`
- Defined in: [Contract Guidelines](./architecture/contract-guidelines.md)
- Detailed method specs: [Audit: Contract & Simulated Behavior](./development/audit-contract-simulated-behavior.md)

### `backend/api.ts`, `backend/simulated.ts`, `backend/firebase-backend.ts`
- Architecture: [Backend Guidelines](./architecture/backend-guidelines.md)
- Implementation details: [Audit: Contract & Simulated Behavior](./development/audit-contract-simulated-behavior.md)
- Migration protocol: [Firebase Backend Implementation](./architecture/firebase-backend-implementation.md)
- Testing: [Parity Testing](./development/parity-testing.md)

### `backend/prompts.ts`
- Guidelines: [Prompt Guidelines](./development/prompt-guidelines.md)

### UI Components (pages/, components/)
- Guidelines: [Frontend Guidelines](./architecture/frontend-guidelines.md)
- Module specs: Inventory/Planner/Recipe modules
- Change workflow: [Change Management](./development/change-management.md)

---

## 🔗 File Structure in docs/

```
docs/
├── README.md (this file)
├── architecture/
│   ├── backend-guidelines.md
│   ├── frontend-guidelines.md
│   ├── contract-guidelines.md
│   └── firebase-backend-implementation.md
├── modules/
│   ├── inventory-module-guidelines.md
│   ├── planner-module-guidelines.md
│   └── recipe-module-guidelines.md
├── development/
│   ├── change-management.md
│   ├── prompt-guidelines.md
│   ├── audit-contract-simulated-behavior.md
│   └── parity-testing.md
└── deployment/
    └── migration-roadmap.md
```

---

## 📞 When in Doubt

1. **Data contract questions?** → [Contract Guidelines](./architecture/contract-guidelines.md)
2. **Backend architecture questions?** → [Backend Guidelines](./architecture/backend-guidelines.md)
3. **Feature implementation questions?** → [Change Management](./development/change-management.md)
4. **Method-specific behavior?** → [Audit: Contract & Simulated Behavior](./development/audit-contract-simulated-behavior.md)
5. **Deployment questions?** → [Migration Roadmap](./deployment/migration-roadmap.md)
