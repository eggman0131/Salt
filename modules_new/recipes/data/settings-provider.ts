/**
 * Kitchen settings and inventory provider.
 *
 * Provides kitchen-wide context needed by recipe AI workflows.
 * These collections do not yet have dedicated modules_new modules.
 */

import { db } from '../../../shared/backend/firebase';
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { debugLogger } from '../../../shared/backend/debug-logger';
import type { Equipment, KitchenSettings } from '../../../types/contract';

export async function getKitchenSettings(): Promise<KitchenSettings> {
  try {
    const docRef = doc(db, 'settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as KitchenSettings;
      return {
        directives: data.directives || '',
        debugEnabled: data.debugEnabled || false,
        userOrder: data.userOrder,
      };
    }
    return { directives: '', debugEnabled: false };
  } catch (error) {
    debugLogger.warn('getKitchenSettings', 'Failed to fetch settings, using defaults:', error);
    return { directives: '', debugEnabled: false };
  }
}

export async function getInventory(): Promise<Equipment[]> {
  const snapshot = await getDocs(collection(db, 'inventory'));
  const equipment: Equipment[] = [];

  snapshot.forEach((docSnap) => {
    equipment.push({ ...docSnap.data(), id: docSnap.id } as Equipment);
  });

  return equipment;
}

export async function getLeanInventoryString(): Promise<string> {
  const inventory = await getInventory();
  if (inventory.length === 0) return 'Standard domestic tools only.';
  return inventory.map((i) => i.name).join(', ');
}
