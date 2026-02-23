/**
 * Firebase Cook Mode Backend
 * 
 * Persistence layer for cook guides using Firestore.
 */

import { Recipe } from '../../../types/contract';
import { CookGuide } from '../types';
import { BaseCookModeBackend } from './base-cook-mode-backend';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../../shared/backend/firebase';

export class FirebaseCookModeBackend extends BaseCookModeBackend {
  private collectionName = 'cookGuides';

  async getOrGenerateCookGuide(recipe: Recipe): Promise<CookGuide> {
    // Check if guide exists
    const q = query(collection(db, this.collectionName), where('recipeId', '==', recipe.id));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const guide = snapshot.docs[0].data() as CookGuide;
      const recipeVersion = this.hashRecipe(recipe);

      // Return if version matches
      if (guide.recipeVersion === recipeVersion) {
        return guide;
      }
    }

    // Generate new guide
    return this.generateCookGuide(recipe);
  }

  async generateCookGuide(recipe: Recipe): Promise<CookGuide> {
    const guideData = await this.generateGuideWithAI(recipe);

    const guide: CookGuide = {
      id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ...guideData,
      generatedAt: new Date().toISOString(),
      generatedBy: 'system', // TODO: Use actual user ID from auth
    };

    // Save to Firestore
    await setDoc(doc(db, this.collectionName, guide.id), guide);

    return guide;
  }

  async getCookGuide(guideId: string): Promise<CookGuide | null> {
    const snapshot = await getDoc(doc(db, this.collectionName, guideId));
    return snapshot.exists() ? (snapshot.data() as CookGuide) : null;
  }

  async deleteCookGuide(guideId: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, guideId));
  }

  async getCookGuidesForRecipe(recipeId: string): Promise<CookGuide[]> {
    const q = query(collection(db, this.collectionName), where('recipeId', '==', recipeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as CookGuide);
  }
}
