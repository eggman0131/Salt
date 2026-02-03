
import { User, Recipe, Equipment, Plan } from '../types/contract';
import { BaseSaltBackend } from './base-backend';

export class SaltSimulatedBackend extends BaseSaltBackend {
  private docCache: Map<string, any> = new Map();
  private deletedIds: Set<string> = new Set();
  private currentUser: User | null = null;

  constructor() {
    super();
    this.initialize();
  }

  private initialize() {
    const savedUser = localStorage.getItem('salt_auth_session');
    const customCache = localStorage.getItem('salt_custom_cache');
    const savedDeletedIds = localStorage.getItem('salt_deleted_ids');
    
    if (savedUser) {
      try { this.currentUser = JSON.parse(savedUser); } catch (e) { localStorage.removeItem('salt_auth_session'); }
    }
    if (savedDeletedIds) this.deletedIds = new Set(JSON.parse(savedDeletedIds));
    if (customCache) {
      try {
        const parsed = JSON.parse(customCache);
        Object.entries(parsed).forEach(([k, v]) => this.docCache.set(k, v));
      } catch (e) { console.warn("Cache corrupted."); }
    }
    if (!Array.from(this.docCache.keys()).some(k => k.startsWith('custom_'))) {
      this.seedDefaultData();
    }
  }

  private seedDefaultData() {
    this.docCache.set('custom_user_user-daniel', { id: 'user-daniel', email: 'daniel@salt.uk', displayName: 'Daniel' });
    this.persistCache();
  }

  private persistCache() {
    const obj: any = {};
    this.docCache.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem('salt_custom_cache', JSON.stringify(obj));
    localStorage.setItem('salt_deleted_ids', JSON.stringify(Array.from(this.deletedIds)));
    if (this.currentUser) localStorage.setItem('salt_auth_session', JSON.stringify(this.currentUser));
    localStorage.setItem('salt_last_sync', new Date().toISOString());
  }

  async importSystemState(json: string): Promise<void> {
    const data = JSON.parse(json);
    this.docCache.clear();
    if (data.inventory) data.inventory.forEach((e: any) => this.docCache.set(`custom_eq_${e.id}`, e));
    if (data.recipes) data.recipes.forEach((r: any) => this.docCache.set(`custom_rec_${r.id}`, r));
    if (data.users) data.users.forEach((u: any) => this.docCache.set(`custom_user_${u.id}`, u));
    if (data.plans) data.plans.forEach((p: any) => this.docCache.set(`custom_plan_${p.id}`, p));
    this.persistCache();
  }

  async login(email: string): Promise<User> {
    const users = await this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      this.currentUser = user;
      localStorage.setItem('salt_auth_session', JSON.stringify(user));
      return user;
    }
    throw new Error("Kitchen Access Denied.");
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem('salt_auth_session');
  }

  async getCurrentUser(): Promise<User | null> { return this.currentUser; }
  async getUsers(): Promise<User[]> {
    const users: User[] = [];
    this.docCache.forEach((v, k) => { if (k.startsWith('custom_user_')) users.push(v); });
    return users;
  }
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const id = `user-${Math.random().toString(36).substr(2, 9)}`;
    const newUser = { ...userData, id };
    this.docCache.set(`custom_user_${id}`, newUser);
    this.persistCache();
    return newUser;
  }
  async deleteUser(id: string): Promise<void> { this.docCache.delete(`custom_user_${id}`); this.persistCache(); }

  async getInventory(): Promise<Equipment[]> {
    const items: Equipment[] = [];
    this.docCache.forEach((v, k) => { if (k.startsWith('custom_eq_') && !this.deletedIds.has(v.id)) items.push(v); });
    return items;
  }

  async getEquipment(id: string): Promise<Equipment | null> {
    const inv = await this.getInventory();
    return inv.find(i => i.id === id) || null;
  }

  async createEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>): Promise<Equipment> {
    const id = `eq-${Math.random().toString(36).substr(2, 9)}`;
    const newEq = { ...equipment, id, createdAt: new Date().toISOString(), createdBy: this.currentUser?.id || 'unknown' };
    this.docCache.set(`custom_eq_${id}`, newEq);
    this.persistCache();
    return newEq as Equipment;
  }

  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment> {
    const existing = await this.getEquipment(id);
    if (!existing) throw new Error("Equipment not found");
    const updated = { ...existing, ...updates };
    this.docCache.set(`custom_eq_${id}`, updated);
    this.persistCache();
    return updated as Equipment;
  }

  async deleteEquipment(id: string): Promise<void> { this.deletedIds.add(id); this.persistCache(); }

  async getRecipes(): Promise<Recipe[]> {
    const items: Recipe[] = [];
    this.docCache.forEach((v, k) => { if (k.startsWith('custom_rec_') && !this.deletedIds.has(v.id)) items.push(v); });
    return items;
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    const recipes = await this.getRecipes();
    return recipes.find(r => r.id === id) || null;
  }

  async createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy'>): Promise<Recipe> {
    const id = `rec-${Math.random().toString(36).substr(2, 9)}`;
    const newRecipe = { ...recipe, id, createdAt: new Date().toISOString(), createdBy: this.currentUser?.id || 'unknown' };
    this.docCache.set(`custom_rec_${id}`, newRecipe);
    this.persistCache();
    return newRecipe as Recipe;
  }

  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe> {
    const existing = await this.getRecipe(id);
    if (!existing) throw new Error("Recipe not found");
    const updated = { ...existing, ...updates };
    this.docCache.set(`custom_rec_${id}`, updated);
    this.persistCache();
    return updated as Recipe;
  }

  async deleteRecipe(id: string): Promise<void> { this.deletedIds.add(id); this.persistCache(); }

  async getPlans(): Promise<Plan[]> {
    const plans: Plan[] = [];
    this.docCache.forEach((v, k) => { if (k.startsWith('custom_plan_')) plans.push(v); });
    return plans.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }
  async getPlanByDate(date: string): Promise<Plan | null> {
    const plans = await this.getPlans();
    return plans.find(p => p.startDate === date) || null;
  }
  async getPlanIncludingDate(date: string): Promise<Plan | null> {
    const all = await this.getPlans();
    const today = new Date(date).setHours(0,0,0,0);
    return all.find(p => {
      const start = new Date(p.startDate).setHours(0,0,0,0);
      return today >= start && today < (start + 7 * 24 * 60 * 60 * 1000);
    }) || null;
  }
  async createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy'>): Promise<Plan> {
    const existing = await this.getPlanByDate(p.startDate);
    const id = existing ? existing.id : `plan-${Math.random().toString(36).substr(2, 9)}`;
    const newPlan = { ...p, id, createdAt: existing?.createdAt || new Date().toISOString(), createdBy: this.currentUser?.id || 'unknown' };
    this.docCache.set(`custom_plan_${id}`, newPlan);
    this.persistCache();
    return newPlan as Plan;
  }
  async deletePlan(id: string): Promise<void> { if (this.docCache.delete(`custom_plan_${id}`)) this.persistCache(); }
}
