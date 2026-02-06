# SALT - Change Management

Follow this workflow to implement new features or perform migrations (e.g., Firebase) without breaking the system.

## 1. The Update Workflow
1. **Contract First:** If the data shape changes, update `types/contract.ts`.
2. **Prompt Second:** If the AI behavior changes, update `backend/prompts.ts`.
3. **Backend Third:** Update `backend/api.ts` to implement the logic.
4. **Frontend Fourth:** Update the UI to consume the new logic.

## 2. GitHub Copilot Safety
- When asking Copilot to update a file, reference the relevant guideline file (e.g., "Follow @frontend-guidelines.md to update the Recipe view").
- If Copilot suggests a change that violates the "British Terminology" or "Metric" rules, reject it immediately.

## 3. Migration (Local to Firebase)
- Maintain the `ISaltBackend` interface.
- Implement the `SaltFirebaseBackend` class in a separate file or as a replacement in `api.ts`.
- Ensure the `App.tsx` orchestrator remains agnostic of the persistence layer.

## 4. Data Safety
- Always perform an **"Export Backup"** before making structural changes to the code.
- Test "Restore State" with existing backups after any contract update.
