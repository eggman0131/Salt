
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
import { db, auth, googleProvider } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

export class SaltFirebaseBackend extends BaseSaltBackend {
  private currentUser: User | null = null;

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
  
  /**
   * Login using Google provider with authorization gate.
   * User must exist in the 'users' collection to gain access.
   */
  async login(email: string): Promise<User> {
    try {
      // Sign in with Google
      const result = await signInWithPopup(auth, googleProvider);
      const userEmail = result.user.email;
      
      if (!userEmail) {
        await signOut(auth);
        throw new Error("Kitchen Access Denied.");
      }
      
      // Check if user exists in the authorized users collection
      const userDoc = await getDoc(doc(db, 'users', userEmail));
      
      if (!userDoc.exists()) {
        // User not authorized - sign them out
        await signOut(auth);
        throw new Error("Kitchen Access Denied.");
      }
      
      // User is authorized
      const userData = userDoc.data();
      this.currentUser = {
        id: userEmail,
        email: userEmail,
        displayName: userData.displayName || result.user.displayName || userEmail
      };
      
      return this.currentUser;
    } catch (error: any) {
      // Preserve "Kitchen Access Denied" errors
      if (error.message === "Kitchen Access Denied.") {
        throw error;
      }
      // Handle auth cancellation gracefully
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        throw new Error("Login cancelled.");
      }
      throw new Error("Authentication failed.");
    }
  }
  
  async logout(): Promise<void> {
    await signOut(auth);
    this.currentUser = null;
  }
  
  async getCurrentUser(): Promise<User | null> {
    // Check if we have cached user
    if (this.currentUser) {
      return this.currentUser;
    }
    
    // Check Firebase Auth state
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      return null;
    }
    
    // Fetch user from Firestore
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.email));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        this.currentUser = {
          id: firebaseUser.email,
          email: firebaseUser.email,
          displayName: userData.displayName || firebaseUser.displayName || firebaseUser.email
        };
        return this.currentUser;
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
    
    return null;
  }
  
  async getUsers(): Promise<User[]> {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users: User[] = [];
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id, // email is the document ID
        email: doc.id,
        displayName: data.displayName || doc.id
      });
    });
    
    return users;
  }
  
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const userDoc = {
      email: userData.email,
      displayName: userData.displayName
    };
    
    // Use email as document ID
    await setDoc(doc(db, 'users', userData.email), userDoc);
    
    return {
      id: userData.email,
      email: userData.email,
      displayName: userData.displayName
    };
  }
  
  async deleteUser(id: string): Promise<void> {
    // id is the email (document ID)
    await deleteDoc(doc(db, 'users', id));
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
