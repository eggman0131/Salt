/**
 * Planner Backend Interface
 * 
 * Defines contract for meal plan management.
 */

import { Plan, KitchenSettings } from '../../../types/contract';

export interface IPlannerBackend {
  // Plans CRUD
  getPlans(): Promise<Plan[]>;
  getPlanByDate(date: string): Promise<Plan | null>;
  createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy' | 'imagePath'> & { id?: string }): Promise<Plan>;
  deletePlan(id: string): Promise<void>;
  
  // Global settings (used by planner)
  getKitchenSettings(): Promise<KitchenSettings>;
  updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings>;
}
