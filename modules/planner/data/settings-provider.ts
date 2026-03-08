/**
 * Kitchen settings data provider.
 *
 * Owns all Firestore I/O for the settings/global document.
 */

import { db } from '../../../shared/backend/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { KitchenSettings } from '../../../types/contract';

export async function getKitchenSettings(): Promise<KitchenSettings> {
  const docSnap = await getDoc(doc(db, 'settings', 'global'));
  if (docSnap.exists()) {
    const data = docSnap.data() as KitchenSettings;
    return {
      directives: data.directives || '',
      debugEnabled: data.debugEnabled || false,
      userOrder: data.userOrder,
    };
  }
  return { directives: '', debugEnabled: false };
}

export async function updateKitchenSettings(
  settings: KitchenSettings
): Promise<KitchenSettings> {
  await setDoc(doc(db, 'settings', 'global'), settings, { merge: true });
  return settings;
}
