import { useState, useEffect } from 'react';
import { resolveImagePath } from '../modules/recipes/data/storage-provider';

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
    if (!imagePath) {
      setSrc('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    resolveImagePath(imagePath)
      .then(url => setSrc(url))
      .catch(() => setSrc(''))
      .finally(() => setIsLoading(false));
  }, [imagePath]);

  return { src, isLoading };
};
