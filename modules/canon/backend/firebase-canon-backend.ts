/**
 * Firebase Canon Backend
 *
 * Implements canon persistence using Firebase Firestore.
 */

import { BaseCanonBackend } from './base-canon-backend';
import {
  Unit,
  Aisle,
  CanonicalItem,
} from '../../../types/contract';
import { db, auth, functions } from '../../../shared/backend/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, orderBy, query, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

export class FirebaseCanonBackend extends BaseCanonBackend {
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

    const result = await cloudGenerateContent({
      idToken,
      params,
    });
    return result.data as GenerateContentResponse;
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

    const result = await cloudGenerateContentStream({
      idToken,
      params,
    });
    return result.data as AsyncIterable<GenerateContentResponse>;
  }

  protected async getSystemInstruction(customContext?: string): Promise<string> {
    return customContext || 'You are the Head Chef managing the canon of items, units, and aisles.';
  }

  // ==================== HELPER METHODS ====================

  private convertTimestamps(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const converted: any = Array.isArray(data) ? [] : {};

    for (const key in data) {
      const value = data[key];

      if (value && typeof value === 'object' && 'toDate' in value) {
        converted[key] = value.toDate().toISOString();
      } else if (value && typeof value === 'object') {
        converted[key] = this.convertTimestamps(value);
      } else {
        converted[key] = value;
      }
    }

    return converted;
  }

  // ==================== UNITS ====================

  async getUnits(): Promise<Unit[]> {
    const snapshot = await getDocs(query(
      collection(db, 'units'),
      orderBy('sortOrder', 'asc')
    ));
    const units: Unit[] = [];

    snapshot.forEach((docSnap) => {
      const data = this.convertTimestamps(docSnap.data());
      units.push({
        ...data,
        id: docSnap.id,
      } as Unit);
    });

    return units;
  }

  async createUnit(unit: Omit<Unit, 'id' | 'createdAt'>): Promise<Unit> {
    const now = new Date().toISOString();
    const newUnit: any = {
      ...unit,
      createdAt: now,
      sortOrder: unit.sortOrder ?? 999,
    };

    Object.keys(newUnit).forEach(key => {
      if (newUnit[key] === undefined) {
        delete newUnit[key];
      }
    });

    const id = `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'units', id), newUnit);

    return {
      ...newUnit,
      id,
    } as Unit;
  }

  async updateUnit(id: string, updates: Partial<Unit>): Promise<Unit> {
    const docRef = doc(db, 'units', id);

    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });

    await updateDoc(docRef, cleanUpdates);

    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Unit ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id,
    } as Unit;
  }

  async deleteUnit(id: string): Promise<void> {
    await deleteDoc(doc(db, 'units', id));
  }

  // ==================== AISLES ====================

  async getAisles(): Promise<Aisle[]> {
    const snapshot = await getDocs(query(
      collection(db, 'aisles'),
      orderBy('sortOrder', 'asc')
    ));
    const aisles: Aisle[] = [];

    snapshot.forEach((docSnap) => {
      const data = this.convertTimestamps(docSnap.data());
      aisles.push({
        ...data,
        id: docSnap.id,
      } as Aisle);
    });

    return aisles;
  }

  async createAisle(aisle: Omit<Aisle, 'id' | 'createdAt'>): Promise<Aisle> {
    const now = new Date().toISOString();
    const newAisle: any = {
      ...aisle,
      createdAt: now,
      sortOrder: aisle.sortOrder ?? 999,
    };

    Object.keys(newAisle).forEach(key => {
      if (newAisle[key] === undefined) {
        delete newAisle[key];
      }
    });

    const id = `aisle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'aisles', id), newAisle);

    return {
      ...newAisle,
      id,
    } as Aisle;
  }

  async updateAisle(id: string, updates: Partial<Aisle>): Promise<Aisle> {
    const docRef = doc(db, 'aisles', id);

    const cleanUpdates: any = { ...updates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });

    await updateDoc(docRef, cleanUpdates);

    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Aisle ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id,
    } as Aisle;
  }

  async deleteAisle(id: string): Promise<void> {
    await deleteDoc(doc(db, 'aisles', id));
  }

  // ==================== CANONICAL ITEMS ====================

  async getCanonicalItems(): Promise<CanonicalItem[]> {
    const snapshot = await getDocs(collection(db, 'canonical_items'));
    const items: CanonicalItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = this.convertTimestamps(docSnap.data());
      items.push({
        ...data,
        id: docSnap.id,
      } as CanonicalItem);
    });

    return items;
  }

  async getCanonicalItem(id: string): Promise<CanonicalItem | null> {
    const docRef = doc(db, 'canonical_items', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = this.convertTimestamps(docSnap.data());
    return {
      ...data,
      id: docSnap.id,
    } as CanonicalItem;
  }

  async createCanonicalItem(item: Omit<CanonicalItem, 'id' | 'createdAt'>): Promise<CanonicalItem> {
    await this.validateItemNameUniqueness(item.name);

    const validSynonyms = await this.filterValidSynonyms(item.synonyms);
    if (validSynonyms.length > 0) {
      await this.validateUniqueSynonyms(validSynonyms);
    }

    const now = new Date().toISOString();
    const newItem: any = {
      ...item,
      createdAt: now,
      isStaple: item.isStaple ?? false,
      synonyms: validSynonyms,
    };

    Object.keys(newItem).forEach(key => {
      if (newItem[key] === undefined) {
        delete newItem[key];
      }
    });

    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'canonical_items', id), newItem);

    return {
      ...newItem,
      id,
    } as CanonicalItem;
  }

  async updateCanonicalItem(id: string, updates: Partial<CanonicalItem>): Promise<CanonicalItem> {
    if (updates.name !== undefined) {
      await this.validateItemNameUniqueness(updates.name, id);
    }

    let finalUpdates = { ...updates };
    if (updates.synonyms !== undefined) {
      const validSynonyms = await this.filterValidSynonyms(updates.synonyms, id);
      finalUpdates = { ...finalUpdates, synonyms: validSynonyms };
    }

    const docRef = doc(db, 'canonical_items', id);

    const cleanUpdates: any = { ...finalUpdates };
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });

    await updateDoc(docRef, cleanUpdates);

    const updated = await getDoc(docRef);
    if (!updated.exists()) {
      throw new Error(`Canonical item ${id} not found after update`);
    }

    const data = this.convertTimestamps(updated.data());
    return {
      ...data,
      id: updated.id,
    } as CanonicalItem;
  }

  async deleteCanonicalItem(id: string): Promise<void> {
    await this.deleteCanonicalItems([id]);
  }

  async deleteCanonicalItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const batch = writeBatch(db);

    for (const id of ids) {
      batch.delete(doc(db, 'canonical_items', id));
    }

    await batch.commit();
  }
}
