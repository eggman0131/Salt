# CHANGELOG

## [v2026.02.4] - 2026-02-25

### ✨ Features
- **Layout Primitives Uplift**: All modules now use `Stack`, `Section`, and `Card` primitives for consistent responsive design
- **Mobile-First Responsive**: Applied mobile-first breakpoint strategy (sm:, md:, lg: prefixes)
- **Avatar System Refactor**: Switched from augmented User type to runtime URL resolution via `useAvatarUrl` hook

### 🔧 Improvements
- Removed archived component directories (admin, ai, inventory, kitchen-data)
- Cleaner module boundaries and exports
- Better type safety with contract-based design tokens
- Improved responsive breakpoints across all views

### 🐛 Fixes
- Fixed avatar URL resolution in Admin module and Planner module
- Corrected avatar caching strategy in service worker
- Proper schema alignment (avatarPath vs avatarUrl)

### 📊 Testing & Quality
- ✅ All 560 tests passing
- ✅ Full test coverage maintained after archive removal
- ✅ Build successful (no TypeScript errors)
- ✅ No broken imports or references

### 🏗️ Technical Details
- vitest configuration validated
- Coverage patterns correct
- Service worker PWA strategy verified
- Module export contracts enforced

---

## Previous Releases
See full history at [releases](https://github.com/eggman0131/Salt/releases)
