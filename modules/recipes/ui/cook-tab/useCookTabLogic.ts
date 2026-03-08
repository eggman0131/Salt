import { useState, useEffect, useRef, useCallback } from 'react';
import type { Recipe } from '@/types/contract';
import type { CookStep } from './types';

const STORAGE_KEY_PREFIX = 'salt-cook-progress-';

interface CookProgress {
  currentStep: CookStep;
  miseEnPlaceChecked: string[];
  timestamp: number;
}

function getStorageKey(recipeId: string) {
  return `${STORAGE_KEY_PREFIX}${recipeId}`;
}

function loadProgress(recipeId: string): CookProgress | null {
  try {
    const raw = localStorage.getItem(getStorageKey(recipeId));
    if (!raw) return null;
    return JSON.parse(raw) as CookProgress;
  } catch {
    return null;
  }
}

function saveProgress(recipeId: string, progress: CookProgress) {
  try {
    localStorage.setItem(getStorageKey(recipeId), JSON.stringify(progress));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function clearProgress(recipeId: string) {
  try {
    localStorage.removeItem(getStorageKey(recipeId));
  } catch {
    // Silently ignore
  }
}

export const useCookTabLogic = (recipe: Recipe, onClose?: () => void) => {
  const [currentStep, setCurrentStep] = useState<CookStep>('miseEnPlace');
  const [miseEnPlaceChecked, setMiseEnPlaceChecked] = useState<Set<string>>(new Set());
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(false);
  const [pendingResume, setPendingResume] = useState<CookProgress | null>(null);
  const touchStartX = useRef(0);

  // Check for saved progress on mount
  useEffect(() => {
    const saved = loadProgress(recipe.id);
    if (saved) {
      // Only offer to resume if they were past the start
      const hasMiseProgress = saved.miseEnPlaceChecked.length > 0;
      const hasCookProgress = typeof saved.currentStep === 'number';
      if (hasMiseProgress || hasCookProgress) {
        setPendingResume(saved);
      }
    }
  }, [recipe.id]);

  const resumeProgress = useCallback(() => {
    if (!pendingResume) return;
    setCurrentStep(pendingResume.currentStep);
    setMiseEnPlaceChecked(new Set(pendingResume.miseEnPlaceChecked));
    setPendingResume(null);
  }, [pendingResume]);

  const restartProgress = useCallback(() => {
    clearProgress(recipe.id);
    setCurrentStep('miseEnPlace');
    setMiseEnPlaceChecked(new Set());
    setPendingResume(null);
  }, [recipe.id]);

  // Persist progress whenever step or mise en place changes
  useEffect(() => {
    // Don't save while the resume prompt is showing
    if (pendingResume) return;

    saveProgress(recipe.id, {
      currentStep,
      miseEnPlaceChecked: Array.from(miseEnPlaceChecked),
      timestamp: Date.now(),
    });
  }, [currentStep, miseEnPlaceChecked, recipe.id, pendingResume]);

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
    } else if (typeof currentStep === 'number' && currentStep === recipe.instructions.length - 1) {
      // On last step, finish and close
      if (onClose) {
        onClose();
      }
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
    pendingResume,
    resumeProgress,
    restartProgress,
  };
};
