/**
 * !!! PROTECTION LOCK !!!
 * FILE: backend/firebase-backend.ts
 * ROLE: The Hands (Cloud Persistence)
 * 
 * DESIGN PATTERN: Concrete Implementation.
 * This class houses ONLY Firestore and Firebase Auth logic.
 * 
 * FOR FUTURE AI UPDATES:
 * 1. Focus exclusively on mapping JSON objects to Firestore collections.
 * 2. NEVER import @google/genai here. Use methods inherited from BaseSaltBackend.
 * 3. Ensure all Dates are stored as ISO Strings, never Firestore Timestamps.
 */

import { User, Recipe, Equipment, Plan } from '../types/contract';
import { BaseSaltBackend } from './base-backend';
import { db, auth } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc } from 'firebase/firestore';

export class SaltFirebaseBackend extends BaseSaltBackend {
  
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
  async createRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy'>): Promise<Recipe> {
    throw new Error("Method not implemented.");
  }
  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe> {
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
  async createOrUpdatePlan(p: Omit<Plan, 'id' | 'createdAt' | 'createdBy'>): Promise<Plan> {
    throw new Error("Method not implemented.");
  }
  async deletePlan(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}