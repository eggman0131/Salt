/**
 * Cook guides data provider.
 *
 * Owns all Firestore I/O for the cookGuides collection.
 */

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
import type { Recipe } from '../../../types/contract';
import type { CookGuide } from '../types';
import { hashRecipe, ensureStepIds } from '../logic/guide-utils';
import { generateGuideWithAI } from './ai-provider';

const COLLECTION = 'cookGuides';

// Mutex: prevents concurrent generation for the same recipe
const generatingGuides = new Map<string, Promise<CookGuide>>();

export async function getOrGenerateCookGuide(recipe: Recipe): Promise<CookGuide> {
  if (generatingGuides.has(recipe.id)) {
    return generatingGuides.get(recipe.id)!;
  }

  const work = (async () => {
    const q = query(collection(db, COLLECTION), where('recipeId', '==', recipe.id));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const guide = snapshot.docs[0].data() as CookGuide;
      if (guide.recipeVersion === hashRecipe(recipe)) return guide;
      // Stale — delete and regenerate
      await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
    }

    return generateCookGuide(recipe);
  })();

  generatingGuides.set(recipe.id, work);
  try {
    return await work;
  } finally {
    generatingGuides.delete(recipe.id);
  }
}

export async function generateCookGuide(recipe: Recipe): Promise<CookGuide> {
  const guideData = await generateGuideWithAI(recipe);

  const guide: CookGuide = {
    id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ...guideData,
    generatedAt: new Date().toISOString(),
    generatedBy: 'system',
    steps: ensureStepIds(guideData.steps),
  };

  await setDoc(doc(db, COLLECTION, guide.id), guide);
  return guide;
}

export async function getCookGuide(guideId: string): Promise<CookGuide | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, guideId));
  if (!snapshot.exists()) return null;
  const guide = snapshot.data() as CookGuide;
  // Backfill missing step IDs for older guides
  if (guide.steps.some((s) => !s.id)) {
    guide.steps = ensureStepIds(guide.steps);
  }
  return guide;
}

export async function updateCookingStep(
  guideId: string,
  stepId: string,
  updatedStep: Partial<CookGuide['steps'][0]>
): Promise<CookGuide> {
  const guide = await getCookGuide(guideId);
  if (!guide) throw new Error(`Cook guide ${guideId} not found`);

  const idx = guide.steps.findIndex((s) => s.id === stepId);
  if (idx === -1) throw new Error(`Step ${stepId} not found in guide ${guideId}`);

  guide.steps[idx] = { ...guide.steps[idx], ...updatedStep };
  await setDoc(doc(db, COLLECTION, guideId), guide);
  return guide;
}

export async function updatePrepGroups(
  guideId: string,
  prepGroups: CookGuide['prepGroups']
): Promise<CookGuide> {
  const guide = await getCookGuide(guideId);
  if (!guide) throw new Error(`Cook guide ${guideId} not found`);

  guide.prepGroups = prepGroups;
  await setDoc(doc(db, COLLECTION, guideId), guide);
  return guide;
}

export async function deleteCookGuide(guideId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, guideId));
}

export async function getAllCookGuides(): Promise<CookGuide[]> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map((d) => d.data() as CookGuide);
}

export async function getCookGuidesForRecipe(recipeId: string): Promise<CookGuide[]> {
  const q = query(collection(db, COLLECTION), where('recipeId', '==', recipeId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as CookGuide);
}
