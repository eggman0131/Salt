# Step 1 Audit: Contract & Simulated Backend Behavior

## Overview
This audit maps each `ISaltBackend` method to its simulated implementation, documenting required fields, ID strategies, timestamp handling, and special logic for Firebase implementation.

---

## Authentication Methods

### `login(email: string): Promise<User>`
**Contract Requirements:**
- Returns `User` with required fields: `id`, `email`, `displayName`
- Must throw error if user not found

**Simulated Behavior:**
- Finds user by case-insensitive email match
- Sets `currentUser` state
- Persists session to localStorage
- Throws "Kitchen Access Denied." if no match

**Firebase Requirements:**
- Use Google Auth provider (signInWithPopup)
- After auth, check `users` collection for doc with email as ID
- If doc doesn't exist, sign out and throw "Access Denied"
- Store current user state
- Use email as document ID (no duplicate `id` field)

---

### `logout(): Promise<void>`
**Simulated Behavior:**
- Clears `currentUser` state
- Removes session from localStorage

**Firebase Requirements:**
- Call `signOut(auth)`
- Clear internal user state

---

### `getCurrentUser(): Promise<User | null>`
**Simulated Behavior:**
- Returns current user from memory state
- Returns null if not logged in

**Firebase Requirements:**
- Check `auth.currentUser`
- Fetch user doc from Firestore if auth exists
- Return null if no auth session

---

## User Management

### `getUsers(): Promise<User[]>`
**Contract Requirements:**
- Each User has: `id`, `email`, `displayName`

**Simulated Behavior:**
- Filters docCache for keys starting with `custom_user_`
- Returns array of all users

**Firebase Requirements:**
- Query `users` collection
- Map docs to User objects using email as `id`
- No Timestamp leakage

---

### `createUser(userData: Omit<User, 'id'>): Promise<User>`
**Simulated Behavior:**
- Generates ID: `user-${random}`
- Adds user to docCache with key `custom_user_${id}`
- Persists to localStorage

**Firebase Requirements:**
- Use email as document ID in `users` collection
- Return User object with email as `id`
- Use `setDoc()` to create document

---

### `deleteUser(id: string): Promise<void>`
**Simulated Behavior:**
- Deletes from docCache by key `custom_user_${id}`
- Persists change

**Firebase Requirements:**
- Delete document from `users` collection
- Use email (which is the ID) as doc reference

---

## Inventory (Equipment) Management

### `getInventory(): Promise<Equipment[]>`
**Contract Requirements:**
- Equipment has: `id`, `name`, `brand`, `modelName`, `description`, `type`, `class`, `accessories[]`, `status`, optional `createdBy`, optional `createdAt`
- Accessories: `id`, `name`, optional `description`, `owned`, `type` (standard/optional)

**Simulated Behavior:**
- Filters docCache for keys starting with `custom_eq_`
- **Soft delete:** Excludes items whose `id` is in `deletedIds` Set
- Returns filtered array

**Firebase Requirements:**
- Query `inventory` collection
- Use document ID as `id` field
- Convert Firestore Timestamps to ISO strings
- **Delete behavior:** Actual deleteDoc() or mark as deleted (prefer deleteDoc to mirror external behavior)
- Ensure accessories array properly mapped with IDs

---

### `getEquipment(id: string): Promise<Equipment | null>`
**Simulated Behavior:**
- Calls `getInventory()` and finds by ID
- Returns null if not found

**Firebase Requirements:**
- Get doc from `inventory/${id}`
- Return null if doesn't exist
- Convert Timestamps to ISO strings

---

### `createEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>): Promise<Equipment>`
**Simulated Behavior:**
- Generates ID: `eq-${random}`
- Sets `createdAt: new Date().toISOString()`
- Sets `createdBy: currentUser?.id || 'unknown'`
- Stores with key `custom_eq_${id}`

**Firebase Requirements:**
- Generate ID with prefix `eq-`
- Set `createdAt` as ISO string
- Set `createdBy` from current user
- Use generated ID as document ID in `inventory` collection
- Return complete Equipment object

---

### `updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment>`
**Simulated Behavior:**
- Fetches existing
- Throws if not found
- Merges updates
- Saves and returns updated object

**Firebase Requirements:**
- Get existing doc
- Throw error if not found
- Merge updates with `updateDoc()`
- Fetch and return updated document
- Convert Timestamps to ISO strings

---

### `deleteEquipment(id: string): Promise<void>`
**Simulated Behavior:**
- Adds ID to `deletedIds` Set (soft delete)
- Items with deleted IDs filtered out by getters

**Firebase Requirements:**
- Use `deleteDoc()` for actual deletion
- This mirrors the external behavior (item no longer returned)

---

## Recipe Management

### `getRecipes(): Promise<Recipe[]>`
**Contract Requirements:**
- Recipe has: `id`, `title`, `description`, `ingredients[]`, `instructions[]`, `equipmentNeeded[]`, `prepTime`, `cookTime`, `totalTime`, `servings`, `complexity`, optional `stepIngredients`, optional `stepAlerts`, optional `workflowAdvice`, optional `history[]`, optional `imagePath`, optional `collection`, **required** `createdAt`, **required** `createdBy`

**Simulated Behavior:**
- Filters docCache for keys starting with `custom_rec_`
- **Soft delete:** Excludes items in `deletedIds`
- Returns filtered array

**Firebase Requirements:**
- Query `recipes` collection
- Use document ID as `id`
- Convert all Timestamps to ISO strings
- **Delete behavior:** deleteDoc() for actual deletion

---

### `getRecipe(id: string): Promise<Recipe | null>`
**Simulated Behavior:**
- Calls `getRecipes()` and filters by ID
- Returns null if not found

**Firebase Requirements:**
- Get doc from `recipes/${id}`
- Return null if doesn't exist
- Convert Timestamps to ISO strings

---

### `createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>, imageData?: string): Promise<Recipe>`
**Simulated Behavior:**
- Generates ID: `rec-${random}`
- If `imageData` provided:
  - Compresses image (600px, JPEG 0.5 quality)
  - Creates path: `storage/${id}.jpg`
  - Stores in localStorage `salt_storage` object
  - Sets `imagePath` on recipe
- Sets `createdAt: new Date().toISOString()`
- Sets `createdBy: currentUser?.id || 'unknown'`
- Stores with key `custom_rec_${id}`

**Firebase Requirements:**
- Generate ID with prefix `rec-`
- If `imageData` provided:
  - Upload to Firebase Storage at `recipes/${id}/image.jpg`
  - Set `imagePath` to storage reference path
- Set `createdAt` as ISO string
- Set `createdBy` from current user
- Use generated ID as document ID in `recipes` collection
- Return complete Recipe object with imagePath

---

### `updateRecipe(id: string, updates: Partial<Recipe>, imageData?: string): Promise<Recipe>`
**Simulated Behavior:**
- Fetches existing
- Throws if not found
- If new `imageData` provided:
  - Compresses image
  - Creates new path: `storage/${id}-${Date.now()}.jpg`
  - Stores in localStorage
  - Updates `imagePath`
- Merges updates
- Saves and returns

**Firebase Requirements:**
- Get existing doc
- Throw if not found
- If new `imageData` provided:
  - Upload to Firebase Storage at `recipes/${id}/image-${timestamp}.jpg`
  - Update `imagePath` in updates
- Merge updates with `updateDoc()`
- Fetch and return updated document
- Convert Timestamps to ISO strings

---

### `resolveImagePath(path: string): Promise<string>`
**Simulated Behavior:**
- Reads from localStorage `salt_storage` object
- Returns base64 data URL or empty string

**Firebase Requirements:**
- Use `getDownloadURL(ref(storage, path))`
- Return download URL
- Handle errors gracefully (return empty string if not found)

---

### `deleteRecipe(id: string): Promise<void>`
**Simulated Behavior:**
- Adds ID to `deletedIds` Set (soft delete)

**Firebase Requirements:**
- Use `deleteDoc()` for actual deletion
- Optionally clean up associated images in Storage

---

## Settings Management

### `getKitchenSettings(): Promise<KitchenSettings>`
**Contract Requirements:**
- Single object with `directives: string`

**Simulated Behavior:**
- Gets from docCache key `custom_settings_global`
- Returns `{ directives: '' }` if not found

**Firebase Requirements:**
- Get doc from `settings/global`
- Return `{ directives: '' }` if doesn't exist
- No Timestamp conversion needed (only string field)

---

### `updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings>`
**Simulated Behavior:**
- Sets in docCache at `custom_settings_global`
- Persists
- Returns settings

**Firebase Requirements:**
- Use `setDoc(doc(db, 'settings', 'global'), settings, { merge: true })`
- Return settings object

---

## Planner Management

### Special Constants
- `TEMPLATE_ID = 'plan-template'`
- Template plans have `startDate: 'template'` or `id: 'plan-template'`

### `getPlans(): Promise<Plan[]>`
**Contract Requirements:**
- Plan has: `id`, `startDate`, `days[]`, **required** `createdAt`, **required** `createdBy`
- DayPlan has: `date`, `cookId`, `presentIds[]`, `userNotes` (record), `mealNotes`

**Simulated Behavior:**
- Filters docCache for keys starting with `custom_plan_`
- Sorts by `startDate` descending (newest first)
- Includes template plan

**Firebase Requirements:**
- Query `plans` collection
- Sort by `startDate` descending
- Use document ID as `id`
- Convert Timestamps to ISO strings

---

### `getPlanByDate(date: string): Promise<Plan | null>`
**Simulated Behavior:**
- Gets all plans
- Finds plan where `startDate === date`
- Returns null if not found

**Firebase Requirements:**
- Query `plans` collection where `startDate == date`
- Return first match or null
- Convert Timestamps to ISO strings

---

### `getPlanIncludingDate(date: string): Promise<Plan | null>`
**Simulated Behavior:**
- Gets all plans
- Excludes template plan (`startDate === 'template'` or `id === TEMPLATE_ID`)
- Finds plan where date falls within 7-day range (Friday to Thursday)
- Calculates: `today >= startDate && today < startDate + 7 days`
- Returns null if no match

**Firebase Requirements:**
- Query plans excluding template
- Check date range for 7-day periods
- May need to fetch multiple plans and filter in client
- Convert Timestamps to ISO strings

---

### `createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy'> & { id?: string }): Promise<Plan>`
**Simulated Behavior:**
- Detects if template: `p.startDate === 'template' || p.id === TEMPLATE_ID`
- For template:
  - Uses fixed ID: `TEMPLATE_ID`
  - Finds existing template by ID or startDate
- For regular plan:
  - Finds existing by `startDate`
  - Uses existing ID or provided ID or generates `plan-${random}`
- Sets `createdAt` (keeps existing or new ISO string)
- Sets `createdBy: currentUser?.id || 'unknown'` (only if new)
- Stores with key `custom_plan_${id}`

**Firebase Requirements:**
- Check if template plan (same logic)
- For template: use `plan-template` as doc ID
- For regular: query by startDate, use existing ID or generate
- Set `createdAt` only if creating (preserve if updating)
- Set `createdBy` from current user (only on create)
- Use `setDoc()` with merge for updates
- Return complete Plan object

---

### `deletePlan(id: string): Promise<void>`
**Simulated Behavior:**
- Deletes from docCache by key `custom_plan_${id}`
- Only persists if deletion succeeded

**Firebase Requirements:**
- Delete document from `plans` collection
- Use `deleteDoc()`

---

## System Import

### `importSystemState(json: string): Promise<void>`
**Contract Requirements:**
- JSON contains: `inventory[]`, `recipes[]`, `users[]`, `plans[]`, `settings`

**Simulated Behavior:**
- Parses JSON
- **Clears** `docCache` completely
- Imports each collection:
  - inventory → `custom_eq_${e.id}`
  - recipes → `custom_rec_${r.id}`
  - users → `custom_user_${u.id}`
  - plans → `custom_plan_${p.id}`
  - settings → `custom_settings_global`
- Persists all changes

**Firebase Requirements:**
- Parse JSON and validate structure
- **Clear all collections first** (per decision):
  - Delete all docs from `inventory`
  - Delete all docs from `recipes`
  - Delete all docs from `users`
  - Delete all docs from `plans`
  - Delete `settings/global`
- Use `writeBatch()` for atomic restore:
  - Write each inventory item to `inventory/${item.id}`
  - Write each recipe to `recipes/${recipe.id}`
  - Write each user to `users/${user.email}` (email is ID)
  - Write each plan to `plans/${plan.id}`
  - Write settings to `settings/global`
- Ensure all dates are ISO strings (validate/convert if needed)
- Commit batch

---

## Key Implementation Notes

### ID Strategy
- **Users:** Email is document ID (no separate `id` field in Firestore, but object has email as `id`)
- **Equipment:** `eq-${random}` as document ID
- **Recipes:** `rec-${random}` as document ID  
- **Plans:** `plan-${random}` or `plan-template` as document ID

### Timestamp Handling
- **CRITICAL:** Never return Firestore `Timestamp` objects
- Always convert to ISO 8601 strings: `timestamp.toDate().toISOString()`
- When creating: use `new Date().toISOString()` 
- Store as strings in Firestore (not Timestamp objects)

### Soft Delete vs Hard Delete
- **Simulated:** Uses soft delete (`deletedIds` Set)
- **Firebase:** Use actual `deleteDoc()` - external behavior is the same (item not returned)

### Required Fields
- **Equipment:** `createdAt` and `createdBy` are optional per contract but simulated always sets them
- **Recipe:** `createdAt` and `createdBy` are **required** per contract
- **Plan:** `createdAt` and `createdBy` are **required** per contract

### Template Plan Special Case
- ID must be exactly `'plan-template'`
- startDate is `'template'`
- Must be handled specially in `createOrUpdatePlan` and excluded from `getPlanIncludingDate`

### Image Handling
- **Simulated:** Stores compressed base64 in localStorage with path as key
- **Firebase:** Upload blob to Storage, store path in `imagePath`, resolve with `getDownloadURL()`

### Collections Topology
```
firestore/
├── users/                 (doc ID = email)
├── inventory/             (doc ID = eq-xxx)
├── recipes/               (doc ID = rec-xxx)  
├── plans/                 (doc ID = plan-xxx or plan-template)
└── settings/
    └── global             (single doc)
```

---

## AI Methods (Already Implemented in BaseSaltBackend)
These are inherited and don't need Firebase-specific implementation:
- `searchEquipmentCandidates`
- `generateEquipmentDetails`
- `validateAccessory`
- `generateRecipeFromPrompt`
- `chatWithRecipe`
- `summarizeAgreedRecipe`
- `chatForDraft`
- `generateRecipeImage`
