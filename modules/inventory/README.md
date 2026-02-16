# Inventory Module

Manages kitchen equipment inventory with AI-powered discovery and technical specification generation.

## Architecture

```
modules/inventory/
  ├── backend/
  │   ├── inventory-backend.interface.ts    # IInventoryBackend contract
  │   ├── base-inventory-backend.ts         # AI & domain logic (extends IInventoryBackend)
  │   ├── firebase-inventory-backend.ts     # Firebase persistence (extends BaseInventoryBackend)
  │   └── index.ts                          # Exports inventoryBackend singleton
  ├── components/
  │   └── InventoryModule.tsx               # Main equipment management UI
  ├── index.ts                              # Public API
  └── README.md                             # This file
```

## Backend Overview

### IInventoryBackend
Defines 8 core methods:
- **CRUD:** `getInventory()`, `getEquipment()`, `createEquipment()`, `updateEquipment()`, `deleteEquipment()`
- **AI Discovery:** `searchEquipmentCandidates()`, `generateEquipmentDetails()`, `validateAccessory()`

### BaseInventoryBackend
Implements AI-powered operations:
- **Equipment Search:** Uses Gemini 2.5-flash to find equipment candidates from text queries
- **Detail Generation:** Generates technical specs (power consumption, dimensions, materials, etc.) from equipment candidates
- **Accessory Validation:** Validates accessory compatibility with equipment using AI

### FirebaseInventoryBackend
Implements persistence using Firebase Firestore:
- Stores equipment in `inventory` collection
- Auto-generates IDs on creation
- Tracks creation metadata (`createdAt`, `createdBy`)
- Delegates AI calls to Cloud Functions via `callGenerateContent()`

## Usage

### Component Usage
```typescript
import { InventoryModule, inventoryBackend } from '../modules/inventory';

// In parent component
const [inventory, setInventory] = useState<Equipment[]>([]);

useEffect(() => {
  inventoryBackend.getInventory().then(setInventory);
}, []);

<InventoryModule 
  inventory={inventory} 
  onRefresh={() => inventoryBackend.getInventory().then(setInventory)}
/>
```

### Direct Backend Usage
```typescript
// Search for equipment
const candidates = await inventoryBackend.searchEquipmentCandidates('Kenwood Mixer');

// Get technical details
const details = await inventoryBackend.generateEquipmentDetails(candidate);

// Create equipment
const eq = await inventoryBackend.createEquipment({
  name: 'Kenwood Chef XL',
  brand: 'Kenwood',
  modelName: 'Chef XL',
  type: 'Mixer',
  class: 'Countertop Appliance',
  description: '...',
  status: 'Available'
});

// Update equipment
await inventoryBackend.updateEquipment(eq.id, {
  status: 'Available',
  accessories: [...]
});

// Delete equipment
await inventoryBackend.deleteEquipment(eq.id);

// Validate accessories
const validated = await inventoryBackend.validateAccessory('Kenwood Chef XL', 'Pasta Attachement');
```

## Equipment Model

```typescript
interface Equipment {
  id: string;
  name: string;                 // Display name
  brand: string;                // Manufacturer
  modelName: string;            // Model identifier
  type: string;                 // Functional type (Mixer, Hob, etc.)
  class: string;                // Placement class (Countertop, Built-in, etc.)
  description: string;          // Technical overview
  status: 'Available' | 'Maintenance' | 'Archived';
  specifications?: Record<string, any>; // AI-generated specs
  accessories?: Accessory[];    // Owned/missing accessories
  createdAt: string;            // ISO timestamp
  createdBy: string;            // User ID
}
```

## AI Discovery Workflow

### 1. Search Phase
User enters "Kenwood Mixer" → `searchEquipmentCandidates()` → Gemini returns list of real products

### 2. Detail Phase  
User selects candidate → `generateEquipmentDetails()` → Gemini generates technical specs
- Power consumption (watts)
- Dimensions (metric)
- Bowl capacity
- Number of speeds
- Accessories included

### 3. Accessory Validation
User adds "Pasta Attachment" → `validateAccessory()` → Gemini confirms compatibility

## Data Flow

```
Component (InventoryModule)
  ↓
inventoryBackend (singleton)
  ├─ searchEquipmentCandidates() → Cloud Function → Gemini 2.5-flash
  ├─ generateEquipmentDetails() → Cloud Function → Gemini 2.5-flash
  ├─ validateAccessory() → Cloud Function → Gemini 2.5-flash
  ├─ createEquipment() → Firestore: /inventory/{id}
  ├─ updateEquipment() → Firestore: /inventory/{id}
  ├─ deleteEquipment() → Firestore: /inventory/{id}
  ├─ getEquipment() ← Firestore: /inventory/{id}
  └─ getInventory() ← Firestore: /inventory/*
```

## Error Handling

All AI methods include try-catch with JSON parsing fallback:
- Gemini failures → console error + alert to user
- Invalid JSON responses → graceful degradation to provided data
- Network errors → surfaced to component for user feedback

## Future Enhancements

- [ ] Equipment photos/images (Firebase Storage)
- [ ] Maintenance history tracking
- [ ] Equipment warranty documents
- [ ] Barcode scanning for quick inventory
- [ ] Equipment borrowing/lending system
- [ ] Integration with shopping lists for replacements
