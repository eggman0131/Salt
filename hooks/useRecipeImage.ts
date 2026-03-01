import { useState, useEffect } from 'react';

interface UseRecipeImageOptions {
  onError?: () => void;
}

/**
 * Hook for safely loading recipe images
 * Returns the image URL without validation - let the img tag handle missing files
 */
export const useRecipeImage = (imagePath: string | undefined, _options?: UseRecipeImageOptions) => {
  const [src, setSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);

    if (!imagePath) {
      setSrc('');
      setIsLoading(false);
      return;
    }

    // Resolve the image URL without validation
    // The img tag's onError handler will catch missing files silently
    if (import.meta.env.DEV) {
      const bucket = 'gen-lang-client-0015061880.firebasestorage.app';
      const encodedPath = encodeURIComponent(imagePath);
      setSrc(`/v0/b/${bucket}/o/${encodedPath}?alt=media`);
    } else {
      setSrc(`https://firebasestorage.googleapis.com/v0/b/${imagePath}`);
    }

    setIsLoading(false);
  }, [imagePath]);

  return { src, isLoading };
};
