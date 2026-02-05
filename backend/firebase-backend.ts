
/**
 * !!! PROTECTION LOCK !!!
 * FILE: backend/firebase-backend.ts
 * ROLE: The Hands (Cloud Persistence & Transport)
 * 
 * DESIGN PATTERN: Concrete Implementation.
 * This class houses ONLY Firestore, Firebase Auth, and AI Delivery logic.
 */

import { User, Recipe, Equipment, Plan, KitchenSettings } from '../types/contract';
import { BaseSaltBackend } from './base-backend';
import { db, auth } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

export class SaltFirebaseBackend extends BaseSaltBackend {

  // -- AI TRANSPORT (READY FOR PROXYING) --

  /**
   * For production, simply replace this method with a fetch() call to a 
   * Firebase Function to hide your API Key.
   */
  protected async callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
    return await ai.models.generateContent(params);
  }

  protected async callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
    return await ai.models.generateContentStream(params);
  }
  
  // -- AUTHENTICATION --
  async login(email: string): Promise<User> {
    throw new Error("Method not implemented. Implement using firebase/auth.");
  }
  async logout(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async getCurrentUser(): Promise<User | null> {
    return null;
  }
  async getUsers(): Promise<User[]> {
    return [];
  }
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    throw new Error("Method not implemented.");
  }
  async deleteUser(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // -- RECIPES --
  async getRecipes(): Promise<Recipe[]> {
    return [];
  }
  async getRecipe(id: string): Promise<Recipe | null> {
    return null;
  }
  async resolveImagePath(path: string): Promise<string> {
    throw new Error("Method not implemented. Implement using firebase/storage.");
  }
  async createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>, imageData?: string): Promise<Recipe> {
    throw new Error("Method not implemented.");
  }
  async updateRecipe(id: string, updates: Partial<Recipe>, imageData?: string): Promise<Recipe> {
    throw new Error("Method not implemented.");
  }
  async deleteRecipe(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // -- INVENTORY (KITCHEN KIT) --
  async getInventory(): Promise<Equipment[]> {
    return [];
  }
  async getEquipment(id: string): Promise<Equipment | null> {
    return null;
  }
  async createEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>): Promise<Equipment> {
    throw new Error("Method not implemented.");
  }
  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment> {
    throw new Error("Method not implemented.");
  }
  async deleteEquipment(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // -- SYSTEM --
  async getKitchenSettings(): Promise<KitchenSettings> {
    const docRef = doc(db, 'settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as KitchenSettings;
    }
    return { directives: '' };
  }
  async updateKitchenSettings(settings: KitchenSettings): Promise<KitchenSettings> {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, settings, { merge: true });
    return settings;
  }
  async importSystemState(json: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // -- PLANNER --
  async getPlans(): Promise<Plan[]> {
    return [];
  }
  async getPlanByDate(date: string): Promise<Plan | null> {
    return null;
  }
  async getPlanIncludingDate(date: string): Promise<Plan | null> {
    return null;
  }
  async createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy'> & { id?: string }): Promise<Plan> {
    throw new Error("Method not implemented.");
  }
  async deletePlan(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
