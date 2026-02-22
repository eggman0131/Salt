/**
 * Firebase Planner Backend
 * 
 * Implements meal plan persistence using Firebase Firestore.
 * Extends BasePlannerBackend.
 */

import { BasePlannerBackend } from './base-planner-backend';
import { Plan, KitchenSettings } from '../../../types/contract';
import { db, auth } from '../../../shared/backend/firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy, runTransaction } from 'firebase/firestore';
import { systemBackend } from '../../../shared/backend/system-backend';

const TEMPLATE_ID = 'plan-template';

export class FirebasePlannerBackend extends BasePlannerBackend {
  private currentUser: any = null;

  constructor() {
    super();
    const user = auth.currentUser;
    if (user) {
      this.currentUser = user;
    }
  }

  // ==================== HELPER METHODS ====================

  private convertTimestamps(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const converted: any = Array.isArray(data) ? [] : {};
    
    for (const key in data) {
      const value = data[key];
      
      if (value && typeof value === 'object' && 'toDate' in value) {
        converted[key] = value.toDate().toISOString();
      }
      else if (value && typeof value === 'object') {
        converted[key] = this.convertTimestamps(value);
      }
      else {
        converted[key] = value;
      }
    }
    
    return converted;
  }

  // ==================== PLANS CRUD ====================

  async getPlans(): Promise<Plan[]> {
    const snapshot = await getDocs(
      query(collection(db, 'plans'), orderBy('startDate', 'desc'))
    );
    
    // Get valid user IDs for sanitization
    const users = await systemBackend.getUsers();
    const validUserIds = users.map(u => u.id);
    
    const plans: Plan[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      const plan = { ...data, id: doc.id } as Plan;
      
      // Sanitize plan (remove non-existent user IDs)
      const sanitized = this.sanitizePlan(plan, validUserIds);
      plans.push(sanitized);
    });
    
    return plans;
  }

  async getPlanByDate(date: string): Promise<Plan | null> {
    const deterministicId = date === 'template' ? TEMPLATE_ID : `plan-${date}`;
    const docSnap = await getDoc(doc(db, 'plans', deterministicId));
    
    if (docSnap.exists()) {
      const data = this.convertTimestamps(docSnap.data());
      const plan = { ...data, id: docSnap.id } as Plan;
      
      // Get valid user IDs for sanitization
      const users = await systemBackend.getUsers();
      const validUserIds = users.map(u => u.id);
      
      // Sanitize plan (remove non-existent user IDs)
      const sanitized = this.sanitizePlan(plan, validUserIds);
      
      return sanitized;
    }

    return null;
  }

  async createOrUpdatePlan(
    p: Omit<Plan, 'id' | 'createdAt' | 'createdBy' | 'imagePath'> & { id?: string }
  ): Promise<Plan> {
    const isTemplate = p.startDate === 'template' || p.id === TEMPLATE_ID;
    const id = isTemplate ? TEMPLATE_ID : `plan-${p.startDate}`;
    const docRef = doc(db, 'plans', id);

    return await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      
      // Use existing metadata if document exists, otherwise initialize it.
      const createdAt = sfDoc.exists() ? sfDoc.data().createdAt : new Date().toISOString();
      const createdBy = sfDoc.exists() ? sfDoc.data().createdBy : (this.currentUser?.id || 'unknown');

      const newPlan = {
        ...p,
        id,
        createdAt,
        createdBy
      };

      transaction.set(docRef, newPlan);
      return newPlan as Plan;
    });
  }

  async deletePlan(id: string): Promise<void> {
    await deleteDoc(doc(db, 'plans', id));
  }

  // ==================== SETTINGS ====================

  async getKitchenSettings(): Promise<KitchenSettings> {
    const docRef = doc(db, 'settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as KitchenSettings;
      return {
        directives: data.directives || '',
        debugEnabled: data.debugEnabled || false,
        userOrder: data.userOrder
      };
    }
    return { directives: '', debugEnabled: false };
  }

  async updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings> {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, settings, { merge: true });
    return settings;
  }
}
