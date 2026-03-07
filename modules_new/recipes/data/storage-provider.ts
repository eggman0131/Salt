/**
 * Firebase Storage provider for recipe images.
 */

import { auth, storage } from '../../../shared/backend/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { debugLogger } from '../../../shared/backend/debug-logger';

export async function resolveImagePath(path: string): Promise<string> {
  if (!path) return '';

  if (import.meta.env.DEV) {
    const bucket =
      storage.app.options.storageBucket ||
      'gen-lang-client-0015061880.firebasestorage.app';
    const encodedPath = encodeURIComponent(path);
    return `/v0/b/${bucket}/o/${encodedPath}?alt=media`;
  }

  try {
    return await getDownloadURL(ref(storage, path));
  } catch {
    return '';
  }
}

export async function uploadRecipeImage(
  path: string,
  imageData: string
): Promise<void> {
  if (import.meta.env.DEV) {
    try {
      const bucket =
        storage.app.options.storageBucket ||
        'gen-lang-client-0015061880.firebasestorage.app';
      const encodedPath = encodeURIComponent(path);
      const uploadUrl = `/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;

      const res = await fetch(imageData);
      const blob = await res.blob();

      const token = await auth.currentUser?.getIdToken();
      const headers: HeadersInit = { 'Content-Type': 'image/jpeg' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: blob,
        headers,
      });

      if (!response.ok) {
        debugLogger.error(
          'Firebase Storage',
          'Manual upload failed:',
          response.statusText
        );
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      return;
    } catch (e) {
      debugLogger.error(
        'Firebase Storage',
        'Manual upload failed, falling back to SDK',
        e
      );
    }
  }

  const storageRef = ref(storage, path);
  const format = imageData.startsWith('data:') ? 'data_url' : 'base64';
  await uploadString(storageRef, imageData, format as 'data_url' | 'base64');
}
