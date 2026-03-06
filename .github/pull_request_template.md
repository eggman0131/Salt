## Architecture Boundary Checklist

- [ ] I identified the owning module for every changed file.
- [ ] Cross-module imports (if any) use `api.ts` only.
- [ ] No UI file imports module `logic/` or `data/` directly.
- [ ] No `logic/` file imports module `data/` or Firebase.
- [ ] I ran `npm run arch:check` locally and it passed.

## Ownership Notes

Describe why each changed file is in the correct module/layer.
