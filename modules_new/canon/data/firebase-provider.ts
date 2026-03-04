/**
 * Canon Firestore provider
 *
 * Read helpers for `canonAisles`, `canonUnits`, and CRUD for `canonItems`.
 * Called from api.ts only — never imported directly from UI or logic.
 */

import { Aisle, Unit } from '../../../types/contract';
import { db } from '../../../shared/backend/firebase';
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  Timestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { CanonItem } from '../logic/items';

const CANON_AISLES_COLLECTION = 'canonAisles';
const CANON_UNITS_COLLECTION = 'canonUnits';
const CANON_ITEMS_COLLECTION = 'canonItems';

/**
 * Fetch all canon aisles ordered by sortOrder.
 */
export async function fetchCanonAisles(): Promise<Aisle[]> {
  const q = query(
    collection(db, CANON_AISLES_COLLECTION),
    orderBy('sortOrder', 'asc'),
  );
  const snapshot = await getDocs(q);
  const aisles: Aisle[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    aisles.push({
      id: docSnap.id,
      name: data.name,
      sortOrder: data.sortOrder ?? 999,
      createdAt: data.createdAt ?? new Date().toISOString(),
    });
  });

  return aisles;
}

/**
 * Fetch all canon units ordered by sortOrder.
 */
export async function fetchCanonUnits(): Promise<Unit[]> {
  const q = query(
    collection(db, CANON_UNITS_COLLECTION),
    orderBy('sortOrder', 'asc'),
  );
  const snapshot = await getDocs(q);
  const units: Unit[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    units.push({
      id: docSnap.id,
      name: data.name,
      plural: data.plural ?? null,
      category: data.category,
      sortOrder: data.sortOrder ?? 999,
      createdAt: data.createdAt,
    });
  });

  return units;
}

// ── Canon Items CRUD ──────────────────────────────────────────────────────────

/**
 * Fetch all canon items.
 * Items are returned unsorted (use sortItems from logic layer).
 */
export async function fetchCanonItems(): Promise<CanonItem[]> {
  const snapshot = await getDocs(collection(db, CANON_ITEMS_COLLECTION));
  const items: CanonItem[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    items.push({
      id: docSnap.id,
      name: data.name,
      aisleId: data.aisleId,
      preferredUnitId: data.preferredUnitId,
      needsReview: data.needsReview ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  });

  return items;
}

/**
 * Fetch a single canon item by ID.
 */
export async function fetchCanonItemById(id: string): Promise<CanonItem | null> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    aisleId: data.aisleId,
    preferredUnitId: data.preferredUnitId,
    needsReview: data.needsReview ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Create a new canon item.
 * Returns the newly created item with its Firestore-generated ID.
 */
export async function createCanonItem(input: {
  name: string;
  aisleId: string;
  preferredUnitId: string;
  needsReview?: boolean;
}): Promise<CanonItem> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, CANON_ITEMS_COLLECTION), {
    name: input.name,
    aisleId: input.aisleId,
    preferredUnitId: input.preferredUnitId,
    needsReview: input.needsReview ?? true,
    createdAt: now,
  });

  return {
    id: docRef.id,
    name: input.name,
    aisleId: input.aisleId,
    preferredUnitId: input.preferredUnitId,
    needsReview: input.needsReview ?? true,
    createdAt: now,
  };
}

/**
 * Update an existing canon item.
 */
export async function updateCanonItem(
  id: string,
  updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId' | 'needsReview'>>
): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Approve a canon item (set needsReview = false).
 */
export async function approveCanonItem(id: string): Promise<void> {
  const docRef = doc(db, CANON_ITEMS_COLLECTION, id);
  await updateDoc(docRef, {
    needsReview: false,
    updatedAt: new Date().toISOString(),
  });
}

// ── CofID Items Read ──────────────────────────────────────────────────────────

const CANON_COFID_ITEMS_COLLECTION = 'canonCofidItems';

/**
 * Fetch all CofID items from canonCofidItems collection.
 * Used for diagnostics and mapping report generation.
 */
export async function fetchCanonCofidItems(): Promise<any[]> {
  const snapshot = await getDocs(collection(db, CANON_COFID_ITEMS_COLLECTION));
  const items: any[] = [];

  snapshot.forEach(docSnap => {
    items.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });

  return items;
}

// ── Seed Operations (batch writes) ───────────────────────────────────────────

/**
 * Batch write aisles to canonAisles collection.
 * Uses setDoc with the aisle's id as the document ID (idempotent).
 */
export async function seedAisles(aisles: Aisle[]): Promise<void> {
  const batch = writeBatch(db);
  
  aisles.forEach(aisle => {
    const docRef = doc(db, CANON_AISLES_COLLECTION, aisle.id);
    batch.set(docRef, {
      name: aisle.name,
      sortOrder: aisle.sortOrder,
      createdAt: aisle.createdAt,
    });
  });

  await batch.commit();
}

/**
 * Batch write units to canonUnits collection.
 * Uses setDoc with the unit's id as the document ID (idempotent).
 */
export async function seedUnits(units: Unit[]): Promise<void> {
  const batch = writeBatch(db);
  
  units.forEach(unit => {
    const docRef = doc(db, CANON_UNITS_COLLECTION, unit.id);
    batch.set(docRef, {
      name: unit.name,
      plural: unit.plural,
      category: unit.category,
      sortOrder: unit.sortOrder,
      createdAt: unit.createdAt,
    });
  });

  await batch.commit();
}
