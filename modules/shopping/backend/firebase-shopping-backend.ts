/**
 * Firebase Shopping Backend
 * 
 * Implements shopping domain persistence using Firebase Firestore.
 * Extends BaseShoppingBackend for AI-powered operations.
 */

import { BaseShoppingBackend } from './base-shopping-backend';
import {
  ShoppingList,
  ShoppingListItem,
  CanonicalItem,
  Unit,
  Aisle,
  Recipe,
  RecipeIngredient,
} from '../../../types/contract';
import { db, auth, functions } from '../../../shared/backend/firebase';
import { canonBackend } from '../../canon';
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

export class FirebaseShoppingBackend extends BaseShoppingBackend {
  private currentIdToken: string | null = null;
  
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

  protected async callGenerateContentStream(params: GenerateContentParameters): Promise<AsyncIterable<GenerateContentResponse>> {
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

    const cloudGenerateContentStream = httpsCallable(functions, 'cloudGenerateContentStream');
    
    try {
      const result = await cloudGenerateContentStream({
        idToken,
        params
      });
      return result.data as AsyncIterable<GenerateContentResponse>;
    } catch (error) {
      throw error;
    }
  }

  protected async getSystemInstruction(customContext?: string): Promise<string> {
    // Simplified for shopping - full system instruction in shared/backend/prompts.ts later
    return customContext || "You are the Head Chef managing kitchen inventory and shopping.";
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
  
  private cleanUndefinedValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item));
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
  
  private async getCurrentUser() {
    // Simplified - will use shared auth later
    return auth.currentUser ? { email: auth.currentUser.email || 'unknown' } : null;
  }
  
  // For recipe integration (temporary - will come from recipes backend later)
  private async getRecipe(id: string): Promise<Recipe | null> {
    const docRef = doc(db, 'recipes', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = this.convertTimestamps(docSnap.data());
    return { ...data, id: docSnap.id } as Recipe;
  }
  
  // ==================== SHOPPING LISTS ====================
  
  async getShoppingLists(): Promise<ShoppingList[]> {
    const snapshot = await getDocs(collection(db, 'shopping_lists'));
    const lists: ShoppingList[] = [];
    
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      lists.push({
        ...data,
        id: doc.id
      } as ShoppingList);
    });
    
    return lists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getShoppingList(id: string): Promise<ShoppingList | null> {
    const docRef = doc(db, 'shopping_lists', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id
    } as ShoppingList;
  }

  async getDefaultShoppingList(): Promise<ShoppingList> {
    // Find list marked as default
    const snapshot = await getDocs(query(
      collection(db, 'shopping_lists'),
      where('isDefault', '==', true)
    ));
    
    if (!snapshot.empty) {
      const data = this.convertTimestamps(snapshot.docs[0].data());
      return {
        ...data,
        id: snapshot.docs[0].id
      } as ShoppingList;
    }
    
    // No default list exists, create one
    const defaultList = await this.createShoppingList({
      name: 'Shopping List',
      isDefault: true,
    });
    
    return defaultList;
  }

  async setDefaultShoppingList(id: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Remove default flag from all lists
    const allLists = await getDocs(collection(db, 'shopping_lists'));
    allLists.forEach(docSnap => {
      if (docSnap.data().isDefault) {
        batch.update(docSnap.ref, { isDefault: false });
      }
    });
    
    // Set new default
    batch.update(doc(db, 'shopping_lists', id), { isDefault: true });
    
    await batch.commit();
  }

  async createShoppingList(list: Omit<ShoppingList, 'id' | 'createdAt' | 'createdBy'>): Promise<ShoppingList> {
    const currentUser = await this.getCurrentUser();
    const now = new Date().toISOString();
    
    const newList: any = {
      ...list,
      createdAt: now,
      createdBy: currentUser?.email || 'unknown'
    };

    // Remove undefined values
    Object.keys(newList).forEach(key => {
      if (newList[key] === undefined) {
        delete newList[key];
      }
    });

    const id = `sl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'shopping_lists', id);
    await setDoc(docRef, newList);

    return {
      ...newList,
      id
    } as ShoppingList;
  }

  async updateShoppingList(id: string, updates: Partial<ShoppingList>): Promise<ShoppingList> {
    const docRef = doc(db, 'shopping_lists', id);
    
    // Remove undefined values
    const cleanUpdates: any = { 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    await updateDoc(docRef, cleanUpdates);
    
    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Shopping list ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id
    } as ShoppingList;
  }

  async deleteShoppingList(id: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete the list
    batch.delete(doc(db, 'shopping_lists', id));
    
    // Delete all items in this list
    const itemsSnap = await getDocs(query(
      collection(db, 'shopping_list_items'),
      where('shoppingListId', '==', id)
    ));
    
    itemsSnap.forEach(itemDoc => {
      batch.delete(itemDoc.ref);
    });
    
    await batch.commit();
  }
  
  // ==================== SHOPPING LIST ITEMS ====================
  
  async getShoppingListItems(shoppingListId: string): Promise<ShoppingListItem[]> {
    const snapshot = await getDocs(query(
      collection(db, 'shopping_list_items'),
      where('shoppingListId', '==', shoppingListId)
    ));
    
    const items: ShoppingListItem[] = [];
    snapshot.forEach((doc) => {
      const data = this.convertTimestamps(doc.data());
      items.push({
        ...data,
        id: doc.id
      } as ShoppingListItem);
    });
    
    return items;
  }

  async createShoppingListItem(item: Omit<ShoppingListItem, 'id'>): Promise<ShoppingListItem> {
    const newItem: any = { ...item };

    // Remove undefined values
    Object.keys(newItem).forEach(key => {
      if (newItem[key] === undefined) {
        delete newItem[key];
      }
    });

    const id = `sli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'shopping_list_items', id);
    await setDoc(docRef, newItem);

    return {
      ...newItem,
      id
    } as ShoppingListItem;
  }

  async updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): Promise<ShoppingListItem> {
    const docRef = doc(db, 'shopping_list_items', id);
    
    // Remove undefined values
    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    await updateDoc(docRef, cleanUpdates);
    
    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Shopping list item ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id
    } as ShoppingListItem;
  }

  async deleteShoppingListItem(id: string): Promise<void> {
    const docRef = doc(db, 'shopping_list_items', id);
    await deleteDoc(docRef);
  }

  // ==================== NOTIFICATION HOOKS ====================

  async onCanonItemsDeleted(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const uniqueIds = Array.from(new Set(ids));
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 10) {
      chunks.push(uniqueIds.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const snapshot = await getDocs(query(
        collection(db, 'shopping_list_items'),
        where('canonicalItemId', 'in', chunk)
      ));

      if (snapshot.empty) continue;

      let batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        batchCount++;

        if (batchCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }
  }
  
  // ==================== RECIPE INTEGRATION ====================
  
  async addRecipeToShoppingList(recipeId: string, shoppingListId: string): Promise<void> {
    // Get the recipe
    const recipe = await this.getRecipe(recipeId);
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      return; // No ingredients to add
    }

    // For each ingredient, find or create canonical item and add to list
    const batch = writeBatch(db);
    
    for (const ingredient of recipe.ingredients) {
      // Try to find existing canonical item
      let canonicalItem: CanonicalItem | undefined;
      
      if (ingredient.canonicalItemId) {
        // Use existing link
        const item = await canonBackend.getCanonicalItem(ingredient.canonicalItemId);
        if (item) canonicalItem = item;
      } else {
        // Try to find by name
        const normalizedName = ingredient.ingredientName.toLowerCase().trim();
        const existingItems = await canonBackend.getCanonicalItems();
        canonicalItem = existingItems.find(item => item.normalisedName === normalizedName);
        
        // Create new canonical item if not found
        if (!canonicalItem) {
          canonicalItem = await canonBackend.createCanonicalItem({
            name: ingredient.ingredientName,
            normalisedName: normalizedName,
            preferredUnit: ingredient.unit || '',
            aisle: '', // No aisle initially
            isStaple: false,
            synonyms: []
          });
        }
      }

      if (!canonicalItem) continue; // Skip if still no canonical item

      // Create shopping list item
      const itemId = `sli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newItem: any = {
        shoppingListId,
        canonicalItemId: canonicalItem.id,
        // Snapshot of canonical item data at creation time
        name: canonicalItem.name,
        aisle: canonicalItem.aisle || '',
        isStaple: canonicalItem.isStaple || false,
        // From recipe ingredient
        quantity: ingredient.quantity || 1,
        unit: ingredient.unit || canonicalItem.preferredUnit,
        checked: false,
        note: ingredient.preparation || undefined
      };

      // Remove undefined values
      Object.keys(newItem).forEach(key => {
        if (newItem[key] === undefined) {
          delete newItem[key];
        }
      });

      const itemRef = doc(db, 'shopping_list_items', itemId);
      batch.set(itemRef, newItem);
    }

    // Commit all items
    await batch.commit();
  }

  async addManualItemToShoppingList(
    shoppingListId: string,
    name: string,
    quantity: number,
    unit: string,
    aisle?: string
  ): Promise<ShoppingListItem> {
    // Normalize name
    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();
    const unitInput = unit.trim();
    const aisleInput = aisle?.trim() || '';
    
    // Find or create canonical item
    const existingItems = await canonBackend.getCanonicalItems();
    let canonicalItem = existingItems.find(item => item.normalisedName === normalizedName);
    const unitToUse = unitInput || canonicalItem?.preferredUnit || '';
    const aisleToUse = canonicalItem ? (canonicalItem.aisle || '') : aisleInput;

    const units = await canonBackend.getUnits();
    const unitExists = units.some(existingUnit => existingUnit.name.toLowerCase() === unitToUse.toLowerCase());
    if (!unitExists) {
      await canonBackend.createUnit({
        name: unitToUse,
        sortOrder: units.length
      });
    }

    if (!canonicalItem && aisleToUse) {
      const aisles = await canonBackend.getAisles();
      const aisleExists = aisles.some(existingAisle => existingAisle.name.toLowerCase() === aisleToUse.toLowerCase());
      if (!aisleExists) {
        await canonBackend.createAisle({
          name: aisleToUse,
          sortOrder: aisles.length
        });
      }
    }
    
    if (!canonicalItem) {
      // Create new canonical item
      canonicalItem = await canonBackend.createCanonicalItem({
        name: trimmedName,
        normalisedName: normalizedName,
        preferredUnit: unitToUse,
        aisle: aisleToUse,
        isStaple: false,
        synonyms: []
      });
    }

    // Create shopping list item
    const itemId = `sli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem: any = {
      shoppingListId,
      canonicalItemId: canonicalItem.id,
      // Snapshot of canonical item data at creation time
      name: canonicalItem.name,
      aisle: canonicalItem.aisle || '',
      isStaple: canonicalItem.isStaple || false,
      // From manual entry
      quantity,
      unit: unitToUse,
      checked: false,
      note: undefined
    };

    // Remove undefined values
    Object.keys(newItem).forEach(key => {
      if (newItem[key] === undefined) {
        delete newItem[key];
      }
    });

    const itemRef = doc(db, 'shopping_list_items', itemId);
    await setDoc(itemRef, newItem);

    // Return the created item
    const created = this.convertTimestamps(newItem);
    return {
      ...created,
      id: itemId
    } as ShoppingListItem;
  }

}
