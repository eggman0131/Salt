# SALT - Inventory Module Guidelines

This document defines the technical standards for managing kitchen equipment and verified accessories.

## 1. Data Hierarchy (Parent-Child)
- **Equipment (Parent):** Standalone units identified by `[Brand] [Model Name]`.
- **Accessories (Child):** Components specific to that equipment.
- **Ownership State:** Each accessory has an `owned: boolean`. This is the primary signal for the Recipe engine to know if a specific technique (e.g. "Use the Dough Hook") is possible.

## 2. Three-Phase AI Orchestration
To ensure data accuracy, the addition of new equipment follows three distinct AI phases:
- **Phase 1: Catalogue Search:** Broad search for UK variants. Max 3 candidates.
- **Phase 2: Tech-Spec Generation:** Creating the full `Equipment` object from a selected candidate. Must include standard vs. optional accessory mapping.
- **Phase 3: Accessory Validation:** Checking manually typed accessories against the known technical specs of that specific model.

## 3. Visual & UI Standards
- **No Thumbnails:** Equipment lists use text-based badges and concise descriptions. High density is preferred over imagery for the inventory.
- **Status Tracking:** Equipment must track availability (Available, In Use, Maintenance).

## 4. DO NOT MODIFY
- Do not change the `eq-` and `acc-` ID prefixing logic.
- Do not merge `Equipment` and `Accessory` into a flat list; the hierarchy must be preserved for valid recipe mapping.