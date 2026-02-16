/**
 * Inventory Backend Interface
 * 
 * Manages all equipment and inventory operations:
 * - Equipment CRUD (create, read, update, delete)
 * - Equipment search and discovery
 * - AI-powered equipment detail generation
 * - Accessory validation
 */

import {
  Equipment,
  EquipmentCandidate,
  Accessory,
} from '../../../types/contract';

export interface IInventoryBackend {
  // ==================== EQUIPMENT CRUD ====================
  
  getInventory: () => Promise<Equipment[]>;
  getEquipment: (id: string) => Promise<Equipment | null>;
  createEquipment: (
    equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>
  ) => Promise<Equipment>;
  updateEquipment: (
    id: string,
    equipment: Partial<Equipment>
  ) => Promise<Equipment>;
  deleteEquipment: (id: string) => Promise<void>;
  
  // ==================== EQUIPMENT DISCOVERY & AI ====================
  
  // Search for equipment candidates (e.g., from appliance databases)
  searchEquipmentCandidates: (query: string) => Promise<EquipmentCandidate[]>;
  
  // Generate detailed equipment info from candidate (AI-powered)
  generateEquipmentDetails: (
    candidate: EquipmentCandidate
  ) => Promise<Partial<Equipment>>;
  
  // Validate that an accessory is compatible with equipment
  validateAccessory: (
    equipmentName: string,
    accessoryName: string
  ) => Promise<Omit<Accessory, 'id'>>;
}
