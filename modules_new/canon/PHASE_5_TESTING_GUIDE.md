# Phase 5: Integration Testing Guide (Issue #105)

## Canon Module - Complete Testing & Validation Workflow

This guide provides comprehensive testing procedures for all Canon admin UIs implemented in Phases 1-4.

---

## Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Automated Tests](#automated-tests)
3. [Manual Functional Testing](#manual-functional-testing)
4. [Mobile Responsiveness Testing](#mobile-responsiveness-testing)
5. [Cross-Browser Compatibility](#cross-browser-compatibility)
6. [Performance Testing](#performance-testing)
7. [Accessibility Audit](#accessibility-audit)
8. [User Acceptance Testing](#user-acceptance-testing)
9. [Regression Testing Checklist](#regression-testing-checklist)
10. [Sign-Off Criteria](#sign-off-criteria)

---

## Pre-Testing Setup

### Environment Requirements

**Development Environment:**
```bash
# Start Firebase emulators with persistence
npm run emulators

# In separate terminal, start dev server
npm run dev
```

**Browser Access:**
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest) — macOS only
- Mobile devices or Chrome DevTools device emulation

**Test Data:**
- Clean emulator state (delete `emulator-data/` if needed)
- Seed data available in `seed-data/` and `scripts/cofid-aisle-mapping.json`

### Admin Panel Access

1. Navigate to `http://localhost:3000`
2. Auto-authenticate with test credentials (emulator mode)
3. Access Admin Panel → Select "Canon" tools from sidebar

---

## Automated Tests

### Contract Compliance Tests

**Location:** `modules_new/canon/__tests__/contract.spec.ts`

**Coverage:**
- ✅ Aisle schema validation (7 tests)
- ✅ Unit schema validation (11 tests)
- ✅ CanonicalItem schema validation (17 tests)
- ✅ CoFIDGroupAisleMapping schema validation (10 tests)
- ✅ CofIDItem schema validation (9 tests)
- ✅ Data consistency tests (7 tests)
- ✅ Edge cases & boundaries (10 tests)
- ✅ Module boundaries (3 tests)

**Run Tests:**
```bash
# Run all Canon tests
npx vitest run modules_new/canon

# Run contract tests only
npx vitest run modules_new/canon/__tests__/contract.spec.ts

# Watch mode for development
npx vitest modules_new/canon
```

**Expected Result:** All 74+ tests pass with no errors.

### Pure Logic Tests

**Files:**
- `logic.test.ts` — Core logic functions (aisle detection, unit grouping, etc.)
- `suggestCofidMatch.test.ts` — CofID matching algorithms
- `validateAiParse.test.ts` — AI parsing validation

**Run Tests:**
```bash
npx vitest run modules_new/canon/__tests__/logic.test.ts
npx vitest run modules_new/canon/__tests__/suggestCofidMatch.test.ts
npx vitest run modules_new/canon/__tests__/validateAiParse.test.ts
```

**Expected Result:** All logic tests pass (deterministic, no I/O).

---

## Manual Functional Testing

### Phase 1: Canon Items Admin UI

**Test Case 1.1: View Canon Items**
- [ ] Open "Canon Items" admin tool
- [ ] Verify items load successfully
- [ ] Check stats dashboard (total items, approved, unapproved)
- [ ] Verify items display with: name, aisle, unit, staple badge, approval status
- [ ] Search for "tomato" → Verify results filter correctly
- [ ] Clear search → Verify all items return

**Test Case 1.2: Create Canon Item**
- [ ] Click "+ Create Canon Item" button
- [ ] Fill form: Name="Carrot", Aisle="Produce", Unit="g", Staple=false
- [ ] Submit → Verify success toast
- [ ] Verify item appears in list (approved by default for manual creation)
- [ ] Verify item data persists after refresh

**Test Case 1.3: Edit Canon Item**
- [ ] Click edit icon on "Carrot" item
- [ ] Change name to "Carrots (organic)"
- [ ] Change staple to true
- [ ] Add synonyms: "Carrot", "Baby carrots"
- [ ] Submit → Verify success toast
- [ ] Verify changes reflected in list immediately
- [ ] Refresh page → Verify changes persist

**Test Case 1.4: Delete Canon Item**
- [ ] Click delete icon on "Carrots (organic)"
- [ ] Verify AlertDialog appears (destructive confirmation)
- [ ] Click outside dialog → Verify dialog doesn't close (AlertDialog behavior)
- [ ] Press Escape → Verify dialog closes (keyboard accessibility)
- [ ] Click delete icon again → Confirm deletion
- [ ] Verify success toast
- [ ] Verify item removed from list
- [ ] Refresh page → Verify deletion persists

**Test Case 1.5: Approval Workflow**
- [ ] Create unapproved item (simulate CoFID auto-creation via backend)
- [ ] Verify item appears with "Unapproved" badge
- [ ] Click "Approve" button
- [ ] Verify success toast
- [ ] Verify badge changes to "Approved" immediately
- [ ] Refresh page → Verify approval persists

---

### Phase 2: Canon Aisles Admin UI

**Test Case 2.1: View Aisles**
- [ ] Open "Canon Aisles" admin tool
- [ ] Verify aisles load successfully
- [ ] Check stats dashboard (total aisles)
- [ ] Verify aisles display with drag handles, name, edit/delete icons
- [ ] Verify aisles sorted by `sortOrder`

**Test Case 2.2: Create Aisle**
- [ ] Click "+ Create Aisle" button
- [ ] Fill form: Name="Frozen Foods"
- [ ] Submit → Verify success toast
- [ ] Verify aisle appears at bottom of list (default sortOrder=999)
- [ ] Verify data persists after refresh

**Test Case 2.3: Edit Aisle**
- [ ] Click edit icon on "Frozen Foods"
- [ ] Change name to "Frozen & Chilled Foods"
- [ ] Submit → Verify success toast
- [ ] Verify name updates in list immediately
- [ ] Refresh page → Verify changes persist

**Test Case 2.4: Delete Aisle**
- [ ] Click delete icon on "Frozen & Chilled Foods"
- [ ] Verify AlertDialog appears
- [ ] Confirm deletion → Verify success toast
- [ ] Verify aisle removed from list
- [ ] Refresh page → Verify deletion persists

**Test Case 2.5: Drag-and-Drop Reordering**
- [ ] Drag "Produce" aisle to bottom of list
- [ ] Verify visual feedback during drag (opacity change)
- [ ] Verify aisle order updates immediately after drop
- [ ] Refresh page → Verify new order persists
- [ ] Drag "Produce" back to top
- [ ] Verify order updates and persists

**Test Case 2.6: Keyboard Accessibility (Drag-and-Drop)**
- [ ] Focus on drag handle (GripVertical icon)
- [ ] Press Space to start drag mode
- [ ] Press Arrow Down → Verify item moves down
- [ ] Press Arrow Up → Verify item moves up
- [ ] Press Space again → Confirm placement
- [ ] Verify order persists after refresh

---

### Phase 3: Canon Units Admin UI

**Test Case 3.1: View Units**
- [ ] Open "Canon Units" admin tool
- [ ] Verify units load successfully
- [ ] Check stats dashboard (total units, weight/volume/count/colloquial breakdown)
- [ ] Verify units display with drag handles, name, plural, category, edit/delete icons
- [ ] Verify units sorted by `sortOrder` within category groups

**Test Case 3.2: Create Unit**
- [ ] Click "+ Create Unit" button
- [ ] Fill form: Name="dash", Plural="dashes", Category="colloquial"
- [ ] Submit → Verify success toast
- [ ] Verify unit appears in "Colloquial" section at bottom
- [ ] Verify data persists after refresh

**Test Case 3.3: Edit Unit**
- [ ] Click edit icon on "dash"
- [ ] Change plural to null (for units with no plural)
- [ ] Change category to "count"
- [ ] Submit → Verify success toast
- [ ] Verify unit moves to "Count" section immediately
- [ ] Refresh page → Verify changes persist

**Test Case 3.4: Delete Unit (No References)**
- [ ] Click delete icon on "dash"
- [ ] Verify AlertDialog appears (no cascade warning)
- [ ] Confirm deletion → Verify success toast
- [ ] Verify unit removed from list
- [ ] Refresh page → Verify deletion persists

**Test Case 3.5: Delete Unit (With References) — Cascade Warning**
- [ ] Create canon item with unit="g" (e.g., "Test Item")
- [ ] Attempt to delete unit "g"
- [ ] Verify AlertDialog shows cascade warning: "2 canon items use this unit"
- [ ] Cancel → Verify unit NOT deleted
- [ ] Confirm → Verify success toast despite warning
- [ ] Verify unit deleted, but items still reference "g" (denormalized field)

**Test Case 3.6: Drag-and-Drop Reordering (Within Category)**
- [ ] Drag "g" above "kg" in Weight section
- [ ] Verify visual feedback during drag
- [ ] Verify order updates immediately
- [ ] Refresh page → Verify new order persists
- [ ] Drag "kg" back above "g"
- [ ] Verify order updates and persists

**Test Case 3.7: Grouped Category Display**
- [ ] Verify units grouped by category: Weight, Volume, Count, Colloquial
- [ ] Verify each section has heading and divider
- [ ] Verify drag-and-drop only works within same category (cannot drag Weight unit into Volume section)

---

### Phase 4: CofID Aisle Mappings Admin UI

**Test Case 4.1: View CofID Mappings**
- [ ] Open "CofID Aisle Mappings" admin tool
- [ ] Verify mappings load successfully
- [ ] Check stats dashboard: Total mappings, Available groups (127), Coverage %
- [ ] Verify mappings display with: Group code, Group name, Aisle, Edit/Delete icons
- [ ] Verify mappings sorted alphabetically by group code

**Test Case 4.2: Create CofID Mapping**
- [ ] Click "+ Create Mapping" button
- [ ] Fill form: Group="XY", Group Name="Test Group", Aisle="Produce"
- [ ] Submit → Verify success toast
- [ ] Verify mapping appears in list (sorted alphabetically)
- [ ] Verify coverage % increases
- [ ] Refresh page → Verify data persists

**Test Case 4.3: Edit CofID Mapping**
- [ ] Click edit icon on "XY" mapping
- [ ] Change aisle to "Baking & Cooking Ingredients"
- [ ] Submit → Verify success toast
- [ ] Verify aisle name updates immediately (denormalized field auto-synced)
- [ ] Refresh page → Verify changes persist

**Test Case 4.4: Delete CofID Mapping**
- [ ] Click delete icon on "XY" mapping
- [ ] Verify AlertDialog appears
- [ ] Confirm deletion → Verify success toast
- [ ] Verify mapping removed from list
- [ ] Verify coverage % decreases
- [ ] Refresh page → Verify deletion persists

**Test Case 4.5: Search & Filter**
- [ ] Type "Cereals" in search input
- [ ] Verify only mappings with "Cereals" in group name or aisle appear
- [ ] Type "AA" in search input
- [ ] Verify only mapping with group code "AA" appears
- [ ] Clear search → Verify all mappings return

**Test Case 4.6: Bulk Import from JSON**
- [ ] Click "Bulk Import" button
- [ ] Verify file input dialog opens
- [ ] Select `scripts/cofid-aisle-mapping.json`
- [ ] Wait for import to complete (<5 seconds for 127 mappings)
- [ ] Verify success toast with count: "Imported 127 mappings"
- [ ] Verify coverage % shows 100% (127/127)
- [ ] Refresh page → Verify all mappings persist
- [ ] Check for skipped mappings toast if any aisles missing

**Test Case 4.7: Export Mappings to JSON**
- [ ] Click "Export Mappings" button
- [ ] Verify file download starts
- [ ] Open downloaded JSON file
- [ ] Verify format matches source file: `{"AA": {"name": "...", "aisle": "..."}}`
- [ ] Verify all mappings present (127 entries)
- [ ] Re-import downloaded file → Verify no duplicates created

**Test Case 4.8: Integrated Validation Report**
- [ ] Click "Show Validation Report" toggle
- [ ] Verify validation summary appears:
  - Total CofID items processed
  - Items with mappings
  - No mapping found count
  - Success rate %
- [ ] Verify "Failures (Unmapped Groups)" section lists groups without mappings
- [ ] Verify "Mapping Results" shows per-aisle breakdown
- [ ] Create mapping for unmapped group
- [ ] Re-generate report → Verify failure count decreases

**Test Case 4.9: Coverage Statistics**
- [ ] Verify stats dashboard shows:
  - Current mapping count
  - Total available groups (127)
  - Coverage percentage (mappings/127 * 100)
- [ ] Delete a mapping → Verify stats update immediately
- [ ] Create a mapping → Verify stats update immediately

---

## Mobile Responsiveness Testing

**Test Devices/Viewports:**
- 📱 **Mobile**: 375px (iPhone SE)
- 📱 **Tablet**: 768px (iPad)
- 💻 **Desktop**: 1024px, 1440px, 1920px

**Chrome DevTools Device Emulation:**
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select devices: iPhone SE, iPad, Responsive (custom widths)

### Mobile Testing Checklist (375px minimum)

**All Admin UIs:**
- [ ] **Layout**: Single column, no horizontal overflow
- [ ] **Buttons**: Touch-friendly (min 44px height)
- [ ] **Forms**: Full-width inputs, vertical stacking
- [ ] **Dialogs**: Responsive width, scrollable content if needed
- [ ] **Tables/Lists**: Readable without horizontal scroll
- [ ] **Icons**: Sufficient tap targets (min 40x40px)
- [ ] **Text**: Readable font sizes (min 14px for body)

**Canon Items Admin (Mobile):**
- [ ] Stats dashboard stacks vertically (1 column)
- [ ] Search input full width
- [ ] Action buttons (Create, Search) full width or stacked
- [ ] Item list: Card layout, no horizontal overflow
- [ ] Item actions (Edit, Delete) accessible without scroll
- [ ] Modal forms: Full-screen or max-width with padding

**Canon Aisles Admin (Mobile):**
- [ ] Stats dashboard single column
- [ ] Aisle list: Touch-friendly drag handles
- [ ] Drag-and-drop works on touch devices (mobile gestures)
- [ ] Edit/Delete icons sufficient tap targets
- [ ] Modal forms responsive

**Canon Units Admin (Mobile):**
- [ ] Stats dashboard stacks: Total, then category counts (2x2 grid or 1 column)
- [ ] Category sections collapse/expand on mobile (if implemented)
- [ ] Units list: Touch-friendly drag handles
- [ ] Cascade warning dialog readable without zoom
- [ ] Modal forms responsive

**CofID Mappings Admin (Mobile):**
- [ ] Stats dashboard: 3 cards stack vertically (Total, Available, Coverage)
- [ ] Search input full width
- [ ] Mapping list: Card layout, readable without scroll
- [ ] Validation report: Stacks vertically, tables scroll horizontally if needed
- [ ] Bulk import/export buttons stack vertically or wrap

### Tablet Testing Checklist (768px)

**All Admin UIs:**
- [ ] **Layout**: 2-column where appropriate, balanced spacing
- [ ] **Buttons**: Standard size (not full-width)
- [ ] **Forms**: 2-column for short fields (Name, Unit), full-width for long fields
- [ ] **Dialogs**: Max-width ~600px, centered
- [ ] **Tables**: Standard width, no scroll

**Specific UIs:**
- [ ] Canon Items: Stats dashboard 2x2 grid, item list 2 columns (if cards) or standard table
- [ ] Canon Aisles: Stats 1x1, aisle list standard width
- [ ] Canon Units: Stats 2x2 grid, units list grouped by category (standard)
- [ ] CofID Mappings: Stats 3x1 row, mapping list standard, validation report 2-column breakdown

### Desktop Testing Checklist (1024px+)

**All Admin UIs:**
- [ ] **Layout**: Full-width with max-container constraints (1200-1440px)
- [ ] **Buttons**: Standard size, inline actions
- [ ] **Forms**: Optimal input widths (Name: 250px, Dropdowns: auto)
- [ ] **Dialogs**: Max-width ~700px, centered
- [ ] **Tables**: Full columns visible, no scroll

**Specific UIs:**
- [ ] Canon Items: Stats 4x1 row, item table with all columns visible
- [ ] Canon Aisles: Stats inline, aisle list standard width
- [ ] Canon Units: Stats 4x1 row, units list all columns visible
- [ ] CofID Mappings: Stats 3x1 row, mapping table full-width, validation report 3-column breakdown

---

## Cross-Browser Compatibility

**Browsers to Test:**
- ✅ **Chrome** (latest) — Primary development browser
- ✅ **Firefox** (latest)
- ✅ **Safari** (latest, macOS/iOS) — WebKit engine differences
- ✅ **Edge** (latest) — Chromium-based, similar to Chrome

**Testing Matrix:**
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Load Admin UI | ☐ | ☐ | ☐ | ☐ |
| Create Item | ☐ | ☐ | ☐ | ☐ |
| Edit Item | ☐ | ☐ | ☐ | ☐ |
| Delete Item | ☐ | ☐ | ☐ | ☐ |
| Drag-and-Drop (Aisles) | ☐ | ☐ | ☐ | ☐ |
| Drag-and-Drop (Units) | ☐ | ☐ | ☐ | ☐ |
| Search/Filter | ☐ | ☐ | ☐ | ☐ |
| Bulk Import | ☐ | ☐ | ☐ | ☐ |
| Export JSON | ☐ | ☐ | ☐ | ☐ |
| Modal Animations | ☐ | ☐ | ☐ | ☐ |
| Toast Notifications | ☐ | ☐ | ☐ | ☐ |
| Dark Mode | ☐ | ☐ | ☐ | ☐ |

**Known Safari Issues to Check:**
- [ ] File input for bulk import (Safari has stricter file handling)
- [ ] Drag-and-drop touch gestures (may require polyfill)
- [ ] CSS Grid/Flexbox layout differences
- [ ] Date input compatibility (ISO format handling)

**Firefox-Specific Checks:**
- [ ] Scrollbar styling differences (Firefox doesn't support ::-webkit-scrollbar)
- [ ] Dialog backdrop blur (may render differently)
- [ ] File download prompts (Firefox has different UX)

---

## Performance Testing

### Large Dataset Performance

**Objective:** Verify UI remains responsive with real-world data volumes.

**Test Data Volumes:**
- **Canon Items**: 500-1000 items (typical kitchen catalog)
- **Canon Aisles**: 20-30 aisles
- **Canon Units**: 50-100 units
- **CofID Mappings**: 127 mappings (full dataset)
- **CofID Items**: 8000+ items (full CoFID database)

### Performance Benchmarks

**Canon Items Admin:**
- [ ] **Load Time**: <2 seconds for 1000 items
- [ ] **Search**: <500ms response time while typing
- [ ] **Create Item**: <1 second from submit to list update
- [ ] **Delete Item**: <1 second from confirm to list update
- [ ] **Scroll Performance**: Smooth scrolling with 1000+ items (virtualization not required)

**Canon Aisles Admin:**
- [ ] **Load Time**: <1 second for 30 aisles
- [ ] **Drag-and-Drop**: <300ms lag during drag
- [ ] **Reorder Persistence**: <2 seconds from drop to Firestore update

**Canon Units Admin:**
- [ ] **Load Time**: <2 seconds for 100 units
- [ ] **Category Grouping**: <500ms to render grouped list
- [ ] **Cascade Check**: <1 second to query 1000 items for references
- [ ] **Drag-and-Drop**: <300ms lag during drag

**CofID Mappings Admin:**
- [ ] **Load Time**: <2 seconds for 127 mappings
- [ ] **Search**: <300ms filter response
- [ ] **Bulk Import**: <5 seconds for 127 mappings (with aisle resolution)
- [ ] **Validation Report**: <3 seconds to generate report for 8000+ CofID items
- [ ] **Export JSON**: <2 seconds to download 127 mappings

### Memory Usage

**Chrome DevTools Performance Profiling:**
1. Open DevTools → Performance tab
2. Start recording
3. Perform CRUD operations (create, edit, delete 10 items)
4. Stop recording
5. Analyze:
   - [ ] **Heap Size**: Should not grow unbounded (no memory leaks)
   - [ ] **Frame Rate**: Maintain 60fps during interactions
   - [ ] **Scripting Time**: <100ms for most operations

**Memory Leak Detection:**
- [ ] Create 100 items → Delete 100 items → Check heap size returns to baseline
- [ ] Open/close 50 modal dialogs → Check no lingering event listeners
- [ ] Search 100 times → Check no cached search results accumulate

---

## Accessibility Audit

**Tools:**
- **Lighthouse** (Chrome DevTools → Lighthouse tab)
- **axe DevTools** (browser extension)
- **Keyboard-only navigation** (unplug mouse)
- **Screen reader** (NVDA on Windows, VoiceOver on macOS)

### Automated Accessibility Checks

**Lighthouse Audit:**
1. Open Chrome DevTools → Lighthouse
2. Select "Accessibility" category
3. Run audit on each admin UI
4. **Target Score**: 95+ (out of 100)

**Common Issues to Fix:**
- [ ] Missing `aria-label` on icon buttons
- [ ] Insufficient color contrast (text vs background)
- [ ] Missing form labels (`htmlFor` + `id` pairing)
- [ ] Missing `alt` text on images (if any)
- [ ] Heading hierarchy violations (h1 → h2 → h3, no skips)

### Keyboard Navigation Testing

**All Admin UIs:**
- [ ] **Tab Order**: Logical tab order (top to bottom, left to right)
- [ ] **Focus Indicators**: Visible focus ring on all interactive elements
- [ ] **Escape Key**: Closes modals/dialogs
- [ ] **Enter Key**: Submits forms, activates buttons
- [ ] **Space Key**: Toggles checkboxes, activates buttons
- [ ] **Arrow Keys**: Navigate drag-and-drop items (aisles, units)

**Specific UI Tests:**
- [ ] **Canon Items**: Tab through search → create button → item list → edit/delete buttons
- [ ] **Canon Aisles**: Tab to drag handle → Space to start drag → Arrow keys to move → Space to confirm
- [ ] **Canon Units**: Same as aisles (grouped by category)
- [ ] **CofID Mappings**: Tab through search → create → bulk import → item list → edit/delete

**Form Accessibility:**
- [ ] All form fields reachable via Tab
- [ ] Labels associated with inputs (`<label htmlFor="name">` + `<input id="name">`)
- [ ] Error messages announced by screen readers
- [ ] Required fields marked with `aria-required="true"`

### Screen Reader Testing

**NVDA (Windows) / VoiceOver (macOS):**
- [ ] **Headings**: Screen reader announces all section headings
- [ ] **Buttons**: Button labels clearly describe action ("Create Canon Item", "Edit Aisle", "Delete Unit")
- [ ] **Form Fields**: Labels read aloud before input value
- [ ] **Toast Notifications**: Success/error toasts announced (`role="status"` or `aria-live="polite"`)
- [ ] **Dialogs**: Dialog title announced when opened (`aria-labelledby`)
- [ ] **Lists**: Items announced with count ("3 of 10 items")

**Common Issues:**
- [ ] Icon-only buttons without `aria-label` (Edit icon, Delete icon)
- [ ] Status badges without semantic meaning ("Approved" badge)
- [ ] Drag handles without instructions (add `aria-label="Reorder item"`)

### Color Contrast

**WCAG AA Standards:**
- **Normal Text**: Minimum contrast ratio 4.5:1
- **Large Text** (18pt+): Minimum contrast ratio 3:1

**Color Pairs to Check:**
- [ ] Dark Mode: Text vs background (e.g., white text on gray-900)
- [ ] Light Mode: Text vs background (e.g., gray-900 text on white)
- [ ] Button text vs button background
- [ ] Link text vs page background
- [ ] Badge text vs badge background (Approved=green, Unapproved=amber)

**Tool:** Use Lighthouse or axe DevTools to auto-detect contrast issues.

---

## User Acceptance Testing

**Objective:** Validate that kitchen staff (non-technical users) can successfully use the Canon admin UIs without training.

### Test Participants

**Ideal Testers:**
- Kitchen manager (oversees inventory)
- Head chef (creates canonical items)
- Sous chef (manages aisles/units)

**Minimum:** 1 non-technical user unfamiliar with the system.

### UAT Scenarios

**Scenario 1: Add New Ingredient to Canon**
- **Task**: Add "Saffron" to canon items (Aisle: Herbs & Spices, Unit: g, Staple: false)
- **Success Criteria**:
  - User finds "Canon Items" admin tool without help
  - User clicks "Create Canon Item" button
  - User fills form correctly
  - User submits and sees success toast
  - User finds "Saffron" in item list

**Scenario 2: Reorganize Aisle Order**
- **Task**: Move "Frozen Foods" aisle to appear after "Dairy & Eggs"
- **Success Criteria**:
  - User finds "Canon Aisles" admin tool
  - User identifies drag handle (GripVertical icon)
  - User drags "Frozen Foods" to correct position
  - User refreshes page and confirms order persists

**Scenario 3: Bulk Import CofID Mappings**
- **Task**: Import all CofID group → aisle mappings from JSON file
- **Success Criteria**:
  - User finds "CofID Aisle Mappings" admin tool
  - User clicks "Bulk Import" button
  - User selects `cofid-aisle-mapping.json` file
  - User sees success toast with count
  - User checks coverage % shows 100%

**Scenario 4: Fix Incorrect Aisle Mapping**
- **Task**: Change "Cereals" group from "Baking" to "Breakfast Foods" aisle
- **Success Criteria**:
  - User finds mapping in list (search or scroll)
  - User clicks edit icon
  - User changes aisle dropdown
  - User submits and sees success toast
  - User confirms aisle name updated in list

**Scenario 5: Delete Unused Unit**
- **Task**: Delete "dash" unit (no items use it)
- **Success Criteria**:
  - User finds "Canon Units" admin tool
  - User locates "dash" unit in list
  - User clicks delete icon
  - User reads confirmation dialog
  - User confirms deletion
  - User sees success toast and unit disappears

### UAT Feedback Questions

**After each scenario, ask:**
1. Was the task easy to complete? (1-5 scale)
2. Did you encounter any confusion? Where?
3. Did the UI provide enough feedback (toasts, loading states)?
4. Would you change anything about the workflow?

**Post-UAT Survey:**
- Overall ease of use (1-5 scale)
- Visual clarity (buttons, labels, icons)
- Confidence in data persistence ("Did your changes save?")
- Preferred improvements or features

---

## Regression Testing Checklist

**Run these tests after any code changes to Canon admin UIs:**

### Quick Smoke Test (5 minutes)

- [ ] Load each admin UI → No errors in console
- [ ] Create one item in each UI → Success toast
- [ ] Edit one item in each UI → Changes persist
- [ ] Delete one item in each UI → Item removed
- [ ] Drag-and-drop one aisle/unit → Order updates

### Full Regression Test (30 minutes)

- [ ] Run all automated tests (`npx vitest run modules_new/canon`)
- [ ] Test all CRUD operations in each admin UI (Items, Aisles, Units, Mappings)
- [ ] Test approval workflow (Canon Items)
- [ ] Test drag-and-drop reordering (Aisles, Units)
- [ ] Test cascade warnings (Units deletion)
- [ ] Test bulk import (CofID Mappings)
- [ ] Test export JSON (CofID Mappings)
- [ ] Test validation report (CofID Mappings)
- [ ] Test search/filter (Items, Mappings)
- [ ] Test dark mode toggle → All UIs readable
- [ ] Test mobile layout (375px) → No horizontal overflow

---

## Sign-Off Criteria

**Phase 5 is complete when ALL of the following are met:**

### ✅ Automated Tests
- [ ] All contract compliance tests pass (74+ tests)
- [ ] All pure logic tests pass (logic.test.ts, suggestCofidMatch.test.ts, validateAiParse.test.ts)
- [ ] No TypeScript compilation errors in canon module
- [ ] No console errors on any admin UI

### ✅ Functional Testing
- [ ] All CRUD operations work in Items, Aisles, Units, Mappings admin UIs
- [ ] Approval workflow functions correctly (Canon Items)
- [ ] Drag-and-drop reordering works (Aisles, Units)
- [ ] Cascade warnings display correctly (Units deletion)
- [ ] Bulk import completes <5 seconds for 127 mappings (CofID Mappings)
- [ ] Export JSON downloads correct format (CofID Mappings)
- [ ] Validation report generates <3 seconds for 8000+ items (CofID Mappings)
- [ ] Search/filter returns correct results (Items, Mappings)

### ✅ Mobile Responsiveness
- [ ] All admin UIs render correctly at 375px (no horizontal overflow)
- [ ] All admin UIs render correctly at 768px (tablet layout)
- [ ] All admin UIs render correctly at 1024px+ (desktop layout)
- [ ] Touch interactions work on mobile (drag-and-drop, buttons)

### ✅ Cross-Browser Compatibility
- [ ] All admin UIs function correctly in Chrome (latest)
- [ ] All admin UIs function correctly in Firefox (latest)
- [ ] All admin UIs function correctly in Safari (latest)
- [ ] All admin UIs function correctly in Edge (latest)

### ✅ Performance
- [ ] Canon Items loads <2 seconds with 1000 items
- [ ] Canon Aisles loads <1 second with 30 aisles
- [ ] Canon Units loads <2 seconds with 100 units
- [ ] CofID Mappings loads <2 seconds with 127 mappings
- [ ] Bulk import completes <5 seconds
- [ ] Validation report generates <3 seconds
- [ ] No memory leaks detected (heap size returns to baseline)

### ✅ Accessibility
- [ ] Lighthouse accessibility score 95+ on all admin UIs
- [ ] All interactive elements keyboard-accessible (Tab, Enter, Escape, Space, Arrows)
- [ ] All forms have proper labels (`htmlFor` + `id`)
- [ ] All icon buttons have `aria-label`
- [ ] Color contrast meets WCAG AA standards (4.5:1 for text)
- [ ] Screen reader announces toasts, dialogs, headings correctly

### ✅ User Acceptance
- [ ] At least 1 non-technical user completes UAT scenarios successfully
- [ ] UAT feedback average rating ≥ 4/5 for ease of use
- [ ] No critical usability issues reported
- [ ] Any minor feedback documented for future iterations

### ✅ Documentation
- [ ] This testing guide completed (all checklists filled)
- [ ] Any bugs found documented and fixed
- [ ] Known limitations documented (if any)

---

## Post-Testing Actions

**After Phase 5 sign-off:**

1. **Create GitHub Issue for Phase 6** (if applicable)
   - Next iteration improvements based on UAT feedback
   - Optional enhancements (e.g., inline editing, undo, duplicate prevention)

2. **Update README.md** (Canon Module)
   - Mark Phase 5 as complete: ✅
   - Update testing section with contract test coverage

3. **Archive Test Data** (if needed)
   - Save emulator state with representative test data
   - Document seed data requirements for future testing

4. **Prepare for Production Deployment**
   - Review Firebase security rules
   - Verify Cloud Functions deployed (if any)
   - Run final smoke test in staging environment

---

## Appendix: Common Issues & Solutions

### Issue: Drag-and-Drop Not Working on Mobile

**Symptom:** Drag handles don't respond to touch gestures.
**Solution:** Verify @dnd-kit has touch event listeners enabled. Test with Safari on iOS.

### Issue: Bulk Import Fails with Missing Aisles

**Symptom:** Bulk import skips mappings with toast warning.
**Solution:** Ensure all aisles in `cofid-aisle-mapping.json` exist in Firestore. Seed aisles first.

### Issue: Validation Report Shows Incorrect Counts

**Symptom:** Report shows more unmapped items than expected.
**Solution:** Verify CofID items seeded correctly. Check `canonCofidItems` collection count matches 8000+.

### Issue: Dark Mode Contrast Issues

**Symptom:** Text hard to read in dark mode.
**Solution:** Add `dark:` variants to all text classes: `text-gray-900 dark:text-gray-100`.

### Issue: Modal Doesn't Close with Escape Key

**Symptom:** Pressing Escape doesn't close dialog.
**Solution:** Verify shadcn Dialog component installed correctly. Check for event listener conflicts.

---

## Testing Log Template

Use this template to track testing progress:

```markdown
## Phase 5 Testing Log

**Tester:** [Name]  
**Date:** [YYYY-MM-DD]  
**Environment:** [Local/Staging/Production]  
**Browser:** [Chrome 120 / Firefox 121 / Safari 17]  
**Viewport:** [375px / 768px / 1024px / 1920px]

### Tests Completed
- [ ] Automated Tests
- [ ] Canon Items Admin
- [ ] Canon Aisles Admin
- [ ] Canon Units Admin
- [ ] CofID Mappings Admin
- [ ] Mobile Responsiveness
- [ ] Cross-Browser Compatibility
- [ ] Performance Testing
- [ ] Accessibility Audit
- [ ] User Acceptance Testing

### Issues Found
1. **Issue:** [Description]  
   **Severity:** [Critical / High / Medium / Low]  
   **Steps to Reproduce:** [1. Do this, 2. Do that]  
   **Expected:** [What should happen]  
   **Actual:** [What actually happened]  
   **Status:** [Open / Fixed / Won't Fix]

2. ...

### Notes
[Any additional observations, feedback, or suggestions]

### Sign-Off
- [ ] All tests passed
- [ ] No critical issues remaining
- [ ] Ready for production deployment

**Signature:** ___________________  
**Date:** ___________________
```

---

**End of Phase 5 Testing Guide**
