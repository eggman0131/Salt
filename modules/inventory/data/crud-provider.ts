/**
 * Inventory CRUD provider.
 *
 * Native Firestore implementation replacing FirebaseInventoryBackend persistence methods.
 */

import { db, auth } from '../../../shared/backend/firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import type { Equipment } from '../../../types/contract';

function convertTimestamps(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const converted: any = Array.isArray(data) ? [] : {};
  for (const key in data) {
    const value = data[key];
    if (value && typeof value === 'object' && 'toDate' in value) {
      converted[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object') {
      converted[key] = convertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

export async function getInventory(): Promise<Equipment[]> {
  const snapshot = await getDocs(collection(db, 'inventory'));
  const equipment: Equipment[] = [];
  snapshot.forEach((docSnap) => {
    const data = convertTimestamps(docSnap.data());
    equipment.push({ ...data, id: docSnap.id } as Equipment);
  });
  return equipment;
}

export async function getEquipment(id: string): Promise<Equipment | null> {
  const docRef = doc(db, 'inventory', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = convertTimestamps(docSnap.data());
  return { ...data, id: docSnap.id } as Equipment;
}

export async function createEquipment(
  equipment: Omit<Equipment, 'id' | 'createdAt' | 'createdBy'>
): Promise<Equipment> {
  const id = `eq-${Math.random().toString(36).substr(2, 9)}`;
  const user = auth.currentUser;
  const newEquipment = {
    ...equipment,
    id,
    createdAt: new Date().toISOString(),
    createdBy: user?.uid || 'unknown',
  };
  await setDoc(doc(db, 'inventory', id), newEquipment);
  return newEquipment as Equipment;
}

export async function updateEquipment(
  id: string,
  updates: Partial<Equipment>
): Promise<Equipment> {
  const existing = await getEquipment(id);
  if (!existing) throw new Error('Equipment not found');
  const updated = { ...existing, ...updates };
  await setDoc(doc(db, 'inventory', id), updated);
  return updated as Equipment;
}

export async function deleteEquipment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'inventory', id));
}
