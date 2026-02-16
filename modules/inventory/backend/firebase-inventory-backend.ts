/**
 * Firebase Inventory Backend
 * 
 * Implements inventory persistence using Firebase Firestore.
 * Extends BaseInventoryBackend for AI-powered operations.
 */

import { BaseInventoryBackend } from './base-inventory-backend';
import {
  Equipment,
  EquipmentCandidate,
  Accessory,
} from '../../../types/contract';
import { db, auth, functions } from '../../../shared/backend/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

export class FirebaseInventoryBackend extends BaseInventoryBackend {
  private currentIdToken: string | null = null;
  private currentUser: any = null;

  constructor() {
    super();
    // Set current user from auth
    const user = auth.currentUser;
    if (user) {
      this.currentUser = user;
    }
  }
  
  // ==================== AI TRANSPORT (Uses Cloud Functions) ====================
  
  protected async callGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    const user = auth.currentUser;
    let idToken = this.currentIdToken;
    
    if (!idToken && !user) {
      throw new Error('User not authenticated. Cannot call Gemini API.');
    }
    
    if (user) {
      try {
        idToken = await user.getIdToken(true);
        this.currentIdToken = idToken;
      } catch (e) {
        if (!idToken) throw e;
      }
    }
    
    if (!idToken) {
      throw new Error('Failed to obtain authentication token.');
    }

    const cloudGenerateContent = httpsCallable(functions, 'cloudGenerateContent');
    
    try {
      const result = await cloudGenerateContent({
        idToken,
        params
      });
      return result.data as GenerateContentResponse;
    } catch (error) {
      throw error;
    }
  }

  protected async getSystemInstruction(customContext?: string): Promise<string> {
    // Simplified for inventory
    return customContext || "You are a kitchen equipment expert managing a domestic kitchen inventory.";
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
  
  // ==================== EQUIPMENT CRUD ====================
  
  async getInventory(): Promise<Equipment[]> {
    const snapshot = await getDocs(collection(db, 'inventory'));
    const equipment: Equipment[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      equipment.push({
        ...data,
        id: doc.id
      } as Equipment);
    });
    
    return equipment;
  }

  async getEquipment(id: string): Promise<Equipment | null> {
    const docRef = doc(db, 'inventory', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id
    } as Equipment;
  }

  async createEquipment(
    equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<Equipment> {
    const id = `eq-${Math.random().toString(36).substr(2, 9)}`;
    const user = auth.currentUser;
    
    const newEquipment = {
      ...equipment,
      id,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'unknown'
    };
    
    await setDoc(doc(db, 'inventory', id), newEquipment);
    
    return newEquipment as Equipment;
  }

  async updateEquipment(
    id: string,
    updates: Partial<Equipment>
  ): Promise<Equipment> {
    const existing = await this.getEquipment(id);
    if (!existing) {
      throw new Error("Equipment not found");
    }
    
    const updated = { ...existing, ...updates };
    await setDoc(doc(db, 'inventory', id), updated);
    
    return updated as Equipment;
  }

  async deleteEquipment(id: string): Promise<void> {
    await deleteDoc(doc(db, 'inventory', id));
  }
}
