/**
 * Base Planner Backend
 * 
 * Contains domain logic for meal plan management.
 * Subclasses (Firebase, Simulation) implement persistence.
 */

import { Plan, KitchenSettings } from '../../../types/contract';
import { IPlannerBackend } from './planner-backend.interface';

export abstract class BasePlannerBackend implements IPlannerBackend {
  // Subclasses MUST implement persistence
  abstract getPlans(): Promise<Plan[]>;
  abstract getPlanByDate(date: string): Promise<Plan | null>;
  abstract createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy' | 'imagePath'> & { id?: string }): Promise<Plan>;
  abstract deletePlan(id: string): Promise<void>;
  abstract getKitchenSettings(): Promise<KitchenSettings>;
  abstract updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings>;
  
  // ==================== HELPER METHODS ====================
  
  /**
   * Get plan that includes a specific date
   */
  async getPlanIncludingDate(date: string): Promise<Plan | null> {
    const all = await this.getPlans();
    // Normalize to UTC midnight for consistent relative comparison
    const targetTime = new Date(`${date}T00:00:00Z`).getTime();
    
    return all.find(p => {
      if (p.startDate === 'template') return false;
      
      const startTime = new Date(`${p.startDate}T00:00:00Z`).getTime();
      return targetTime >= startTime && targetTime < (startTime + 7 * 24 * 60 * 60 * 1000);
    }) || null;
  }
  
  /**
   * Safely extract user IDs in order from kitchen settings
   */
  getOrderedUserIds(settings: KitchenSettings | null): string[] {
    if (!settings?.userOrder || !Array.isArray(settings.userOrder)) {
      return [];
    }
    return settings.userOrder;
  }

  /**
   * Sanitize a plan by removing presentIds that don't exist in validUserIds
   * Returns the sanitized plan (mutates in-place)
   */
  sanitizePlan(plan: Plan, validUserIds: string[]): Plan {
    const validIdSet = new Set(validUserIds);
    
    const sanitizedDays = plan.days.map(day => ({
      ...day,
      // Remove cookId if it's not in valid list, remove invalid presentIds
      cookId: (day.cookId && validIdSet.has(day.cookId)) ? day.cookId : null,
      presentIds: day.presentIds.filter(id => validIdSet.has(id))
    }));

    return {
      ...plan,
      days: sanitizedDays
    };
  }
}
