import React, { useState, useEffect } from 'react';
import type { Recipe } from '@/types/contract';
import { useCookTabLogic } from './cook-tab/useCookTabLogic';
import { CookTabMobile } from './cook-tab/CookTabMobile';
import { CookTabTablet } from './cook-tab/CookTabTablet';
import { CookTabDesktop } from './cook-tab/CookTabDesktop';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface CookTabProps {
  recipe: Recipe;
  onClose?: () => void;
}

type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function CookTab({ recipe, onClose }: CookTabProps) {
  const [deviceType, setDeviceType] = useState<DeviceType>('mobile');

  // All the state and logic from useCookTabLogic hook
  const cookTabLogic = useCookTabLogic(recipe, onClose);
  const { pendingResume, resumeProgress, restartProgress } = cookTabLogic;

  // Media query listener to determine device type
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    // Set initial device type
    handleResize();

    // Listen for window resize
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Select the appropriate component based on device type
  const selectedComponent = {
    mobile: <CookTabMobile {...cookTabLogic} recipe={recipe} onClose={onClose} />,
    tablet: <CookTabTablet {...cookTabLogic} recipe={recipe} onClose={onClose} />,
    desktop: <CookTabDesktop {...cookTabLogic} recipe={recipe} onClose={onClose} />,
  }[deviceType];

  return (
    <>
      <AlertDialog open={!!pendingResume}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue where you left off?</AlertDialogTitle>
            <AlertDialogDescription>
              You have saved progress for this recipe. Would you like to carry on or start fresh?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={restartProgress}>Start Fresh</AlertDialogCancel>
            <AlertDialogAction onClick={resumeProgress}>Carry On</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {selectedComponent}
    </>
  );
}
