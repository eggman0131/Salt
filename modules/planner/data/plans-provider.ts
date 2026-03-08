/**
 * Plans data provider.
 *
 * Owns all Firestore I/O for the plans collection.
 */

import { db, auth } from '../../../shared/backend/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import type { Plan } from '../../../types/contract';
import { systemBackend } from '../../../shared/backend/system-backend';
import { sanitizePlan } from '../logic/plan-utils';
import { TEMPLATE_ID } from '../logic/dates';

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

async function getValidUserIds(): Promise<string[]> {
  const users = await systemBackend.getUsers();
  return users.map((u) => u.id);
}

export async function getPlans(): Promise<Plan[]> {
  const snapshot = await getDocs(
    query(collection(db, 'plans'), orderBy('startDate', 'desc'))
  );
  const validUserIds = await getValidUserIds();
  const plans: Plan[] = [];
  snapshot.forEach((docSnap) => {
    const data = convertTimestamps(docSnap.data());
    const plan = { ...data, id: docSnap.id } as Plan;
    plans.push(sanitizePlan(plan, validUserIds));
  });
  return plans;
}

export async function getPlanByDate(date: string): Promise<Plan | null> {
  const id = date === 'template' ? TEMPLATE_ID : `plan-${date}`;
  const docSnap = await getDoc(doc(db, 'plans', id));
  if (!docSnap.exists()) return null;
  const data = convertTimestamps(docSnap.data());
  const plan = { ...data, id: docSnap.id } as Plan;
  const validUserIds = await getValidUserIds();
  return sanitizePlan(plan, validUserIds);
}

export async function createOrUpdatePlan(
  p: Omit<Plan, 'id' | 'createdAt' | 'createdBy' | 'imagePath'> & { id?: string }
): Promise<Plan> {
  const isTemplate = p.startDate === 'template' || p.id === TEMPLATE_ID;
  const id = isTemplate ? TEMPLATE_ID : `plan-${p.startDate}`;
  const docRef = doc(db, 'plans', id);

  return runTransaction(db, async (tx) => {
    const existing = await tx.get(docRef);
    const createdAt = existing.exists() ? existing.data().createdAt : new Date().toISOString();
    const createdBy = existing.exists()
      ? existing.data().createdBy
      : (auth.currentUser?.uid ?? 'unknown');

    const newPlan = { ...p, id, createdAt, createdBy } as Plan;
    tx.set(docRef, newPlan);
    return newPlan;
  });
}

export async function deletePlan(id: string): Promise<void> {
  await deleteDoc(doc(db, 'plans', id));
}
