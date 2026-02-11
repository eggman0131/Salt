
import { User, Recipe, Equipment, Plan, KitchenSettings } from '../types/contract';
import { BaseSaltBackend } from './base-backend';
import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

const TEMPLATE_ID = 'plan-template';

export class SaltSimulatedBackend extends BaseSaltBackend {
  private docCache: Map<string, any> = new Map();
  private deletedIds: Set<string> = new Set();
  private currentUser: User | null = null;
  private readonly emailLinkKey = 'salt_email_link';

  constructor() {
    super();
    this.initialize();
  }

  // -- AI TRANSPORT (DIRECT SDK) --

  protected async callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
    return await ai.models.generateContent(params);
  }

  protected async callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
    return await ai.models.generateContentStream(params);
  }

  // -- STORAGE OPTIMIZATION --

  /**
   * Compresses high-res AI images specifically for localStorage limits.
   * Resizes to 600px width and uses 0.5 JPEG quality.
   */
  private async compressImageForStorage(base64: string): Promise<string> {
    if (!base64.startsWith('data:image')) return base64;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        } else {
          resolve(base64);
        }
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  }

  // -- PERSISTENCE LOGIC --

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
    this.docCache.set('custom_settings_global', { directives: '' });
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
    if (data.settings) this.docCache.set('custom_settings_global', data.settings);
    this.persistCache();
  }

  async login(email: string): Promise<void> {
    localStorage.setItem(this.emailLinkKey, email);

    const users = await this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error("Kitchen Access Denied.");
    }

    this.currentUser = user;
    localStorage.setItem('salt_auth_session', JSON.stringify(user));
    localStorage.removeItem(this.emailLinkKey);
  }

  async handleRedirectResult(): Promise<User | null> {
    if (this.currentUser) return this.currentUser;

    const pendingEmail = localStorage.getItem(this.emailLinkKey);
    if (!pendingEmail) return null;

    const users = await this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === pendingEmail.toLowerCase());
    localStorage.removeItem(this.emailLinkKey);

    if (!user) {
      throw new Error("Kitchen Access Denied.");
    }

    this.currentUser = user;
    localStorage.setItem('salt_auth_session', JSON.stringify(user));
    return this.currentUser;
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem('salt_auth_session');
    localStorage.removeItem(this.emailLinkKey);
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
    this.docCache.forEach((v, k) => { 
      if (k.startsWith('custom_rec_') && !this.deletedIds.has(v.id)) {
        items.push(this.normalizeRecipeData(v) as Recipe);
      } 
    });
    return items;
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    const recipes = await this.getRecipes();
    return recipes.find(r => r.id === id) || null;
  }

  async resolveImagePath(path: string): Promise<string> {
    const storage = JSON.parse(localStorage.getItem('salt_storage') || '{}');
    return storage[path] || '';
  }

  async createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>, imageData?: string): Promise<Recipe> {
    const id = `rec-${Math.random().toString(36).substr(2, 9)}`;
    let imagePath = undefined;
    
    if (imageData) {
      const compressed = await this.compressImageForStorage(imageData);
      imagePath = `storage/${id}.jpg`;
      const storage = JSON.parse(localStorage.getItem('salt_storage') || '{}');
      storage[imagePath] = compressed;
      localStorage.setItem('salt_storage', JSON.stringify(storage));
    }
    
    // Validate and sanitize recipe data
    const normalized = this.normalizeRecipeData(recipe);
    
    const newRecipe = { 
      ...normalized, 
      id, 
      imagePath, 
      createdAt: new Date().toISOString(), 
      createdBy: this.currentUser?.id || 'unknown' 
    };
    this.docCache.set(`custom_rec_${id}`, newRecipe);
    this.persistCache();
    return newRecipe as Recipe;
  }

  async updateRecipe(id: string, updates: Partial<Recipe>, imageData?: string): Promise<Recipe> {
    const existing = await this.getRecipe(id);
    if (!existing) throw new Error("Recipe not found");
    
    let imagePath = updates.imagePath || existing.imagePath;
    if (imageData) {
      const compressed = await this.compressImageForStorage(imageData);
      imagePath = `storage/${id}-${Date.now()}.jpg`;
      const storage = JSON.parse(localStorage.getItem('salt_storage') || '{}');
      storage[imagePath] = compressed;
      localStorage.setItem('salt_storage', JSON.stringify(storage));
    }
    
    // Validate and sanitize updates
    const normalizedUpdates = this.normalizeRecipeData({ ...existing, ...updates });
    
    const updated = { ...existing, ...normalizedUpdates, imagePath };
    this.docCache.set(`custom_rec_${id}`, updated);
    this.persistCache();
    return updated as Recipe;
  }

  async deleteRecipe(id: string): Promise<void> { this.deletedIds.add(id); this.persistCache(); }

  async getKitchenSettings(): Promise<KitchenSettings> {
    const s = this.docCache.get('custom_settings_global');
    return s || { directives: '' };
  }

  async updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings> {
    this.docCache.set('custom_settings_global', settings);
    this.persistCache();
    return settings;
  }

  async getPlans(): Promise<Plan[]> {
    const plans: Plan[] = [];
    this.docCache.forEach((v, k) => { if (k.startsWith('custom_plan_')) plans.push(v); });
    return plans.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }
  async getPlanByDate(date: string): Promise<Plan | null> {
    const id = date === 'template' ? TEMPLATE_ID : `plan-${date}`;
    // Check for deterministic ID in cache
    const cached = this.docCache.get(`custom_plan_${id}`);
    if (cached) return cached;
    return null;
  }
  async getPlanIncludingDate(date: string): Promise<Plan | null> {
    const all = await this.getPlans();
    // Normalize to UTC midnight for consistent relative comparison
    const targetTime = new Date(`${date}T00:00:00Z`).getTime();
    return all.find(p => {
      // Exclude template from being returned as a live date-based plan
      if (p.startDate === 'template' || p.id === TEMPLATE_ID) return false;
      const startTime = new Date(`${p.startDate}T00:00:00Z`).getTime();
      return targetTime >= startTime && targetTime < (startTime + 7 * 24 * 60 * 60 * 1000);
    }) || null;
  }
  async createOrUpdatePlan(p: any): Promise<Plan> {
    const isTemplate = p.startDate === 'template' || p.id === TEMPLATE_ID;
    const id = isTemplate ? TEMPLATE_ID : `plan-${p.startDate}`;
    const cacheKey = `custom_plan_${id}`;
    
    const existing = this.docCache.get(cacheKey);
    
    const newPlan = { 
      ...p, 
      id, 
      createdAt: existing?.createdAt || new Date().toISOString(), 
      createdBy: existing?.createdBy || this.currentUser?.id || 'unknown' 
    };
    
    this.docCache.set(cacheKey, newPlan);
    this.persistCache();
    return newPlan as Plan;
  }
  async deletePlan(id: string): Promise<void> { if (this.docCache.delete(`custom_plan_${id}`)) this.persistCache(); }
}