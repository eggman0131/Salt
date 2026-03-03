/**
 * Firebase Firestore provider for categories persistence
 * 
 * Handles all I/O to Firestore. Called from api.ts, never directly from UI.
 */

import { RecipeCategory } from '../../../types/contract';
import { db } from '../../../shared/backend/firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, writeBatch, deleteDoc } from 'firebase/firestore';

const CATEGORIES_COLLECTION = 'categories';

/**
 * Fetch all categories from Firestore
 */
export async function getAllCategories(): Promise<RecipeCategory[]> {
  const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
  const categories: RecipeCategory[] = [];

  snapshot.forEach((doc) => {
    const data = convertFirestoreTimestamps(doc.data());
    categories.push({
      ...data,
      id: doc.id,
    } as RecipeCategory);
  });

  return categories;
}

/**
 * Fetch a single category by ID
 */
export async function getCategoryById(id: string): Promise<RecipeCategory | null> {
  const docRef = doc(db, CATEGORIES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = convertFirestoreTimestamps(docSnap.data());
  return {
    ...data,
    id: docSnap.id,
  } as RecipeCategory;
}

/**
 * Create a new category in Firestore
 */
export async function createCategory(
  category: Omit<RecipeCategory, 'id' | 'createdAt'>
): Promise<RecipeCategory> {
  const now = new Date().toISOString();
  const newCat: any = {
    ...category,
    createdAt: now,
  };

  // Remove undefined values
  Object.keys(newCat).forEach(key => {
    if (newCat[key] === undefined) {
      delete newCat[key];
    }
  });

  const docRef = doc(collection(db, CATEGORIES_COLLECTION));
  await setDoc(docRef, newCat);

  return {
    ...newCat,
    id: docRef.id,
  } as RecipeCategory;
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: string,
  updates: Partial<RecipeCategory>
): Promise<RecipeCategory> {
  const docRef = doc(db, CATEGORIES_COLLECTION, id);
  const { id: _, createdAt, ...safeUpdates } = updates;

  await updateDoc(docRef, safeUpdates as any);

  const updated = await getCategoryById(id);
  if (!updated) {
    throw new Error(`Failed to retrieve updated category: ${id}`);
  }

  return updated;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<void> {
  const docRef = doc(db, CATEGORIES_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Get all pending (unapproved) categories
 */
export async function getPendingCategories(): Promise<RecipeCategory[]> {
  const q = query(collection(db, CATEGORIES_COLLECTION), where('isApproved', '==', false));
  const snapshot = await getDocs(q);
  const categories: RecipeCategory[] = [];

  snapshot.forEach((doc) => {
    const data = convertFirestoreTimestamps(doc.data());
    categories.push({
      ...data,
      id: doc.id,
    } as RecipeCategory);
  });

  return categories;
}

/**
 * Approve a pending category
 */
export async function approveCategoryInFirestore(id: string): Promise<void> {
  const docRef = doc(db, CATEGORIES_COLLECTION, id);
  await updateDoc(docRef, { isApproved: true });
}

/**
 * Helper: Convert Firestore timestamps to ISO strings
 * Handles recursive conversion for nested objects
 */
function convertFirestoreTimestamps(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const converted: any = Array.isArray(data) ? [] : {};

  for (const key in data) {
    const value = data[key];

    if (value && typeof value === 'object' && 'toDate' in value) {
      converted[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object') {
      converted[key] = convertFirestoreTimestamps(value);
    } else {
      converted[key] = value;
    }
  }

  return converted;
}
