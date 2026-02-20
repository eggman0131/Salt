import { useState, useEffect, useRef } from 'react';
import { Recipe } from '../../../../types/contract';
import { CookStep } from './types';

export const useCookTabLogic = (recipe: Recipe) => {
  const [currentStep, setCurrentStep] = useState<CookStep>('miseEnPlace');
  const [miseEnPlaceChecked, setMiseEnPlaceChecked] = useState<Set<string>>(new Set());
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(false);
  const touchStartX = useRef(0);

  // Keep-awake effect
  useEffect(() => {
    if (!keepAwakeEnabled) return;

    const preventLock = () => {
      document.documentElement.style.userSelect = 'none';
    };

    preventLock();
    const interval = setInterval(preventLock, 1000);
    return () => clearInterval(interval);
  }, [keepAwakeEnabled]);

  // Swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) < 50) return;

    if (diff > 0) {
      handleNext();
    } else {
      handlePrev();
    }
  };

  const handleMiseEnPlaceToggle = (ingredientId: string) => {
    const updated = new Set(miseEnPlaceChecked);
    if (updated.has(ingredientId)) {
      updated.delete(ingredientId);
    } else {
      updated.add(ingredientId);
    }
    setMiseEnPlaceChecked(updated);
  };

  const handleMiseEnPlaceToggleAll = () => {
    if (miseEnPlaceChecked.size === recipe.ingredients.length) {
      setMiseEnPlaceChecked(new Set());
    } else {
      setMiseEnPlaceChecked(new Set(recipe.ingredients.map(ing => ing.id)));
    }
  };

  const miseEnPlaceProgress = (miseEnPlaceChecked.size / recipe.ingredients.length) * 100;

  const handleNext = () => {
    if (currentStep === 'miseEnPlace') {
      setCurrentStep(0);
    } else if (typeof currentStep === 'number' && currentStep < recipe.instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (typeof currentStep === 'number' && currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (typeof currentStep === 'number' && currentStep === 0) {
      setCurrentStep('miseEnPlace');
    }
  };

  const isFirstStep = currentStep === 'miseEnPlace';
  const isLastStep = typeof currentStep === 'number' && currentStep === recipe.instructions.length - 1;

  return {
    currentStep,
    setCurrentStep,
    miseEnPlaceChecked,
    handleMiseEnPlaceToggle,
    handleMiseEnPlaceToggleAll,
    keepAwakeEnabled,
    setKeepAwakeEnabled,
    miseEnPlaceProgress,
    isFirstStep,
    isLastStep,
    handleNext,
    handlePrev,
    handleTouchStart,
    handleTouchEnd,
  };
};
