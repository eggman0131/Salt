import { useEffect, useState } from 'react';
import { systemBackend } from '../backend/system-backend';

/**
 * Hook to resolve avatar paths to downloadable URLs at runtime.
 * Handles both dev and prod environments automatically.
 * 
 * Usage:
 * const avatarUrl = useAvatarUrl(user.avatarPath);
 * <AvatarImage src={avatarUrl} />
 */
export const useAvatarUrl = (avatarPath?: string): string => {
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  useEffect(() => {
    if (!avatarPath) {
      setAvatarUrl('');
      return;
    }

    const resolveUrl = async () => {
      try {
        const url = await systemBackend.resolveAvatarPath(avatarPath);
        setAvatarUrl(url);
      } catch (error) {
        console.error('Failed to resolve avatar URL:', error);
        setAvatarUrl('');
      }
    };

    resolveUrl();
  }, [avatarPath]);

  return avatarUrl;
};
