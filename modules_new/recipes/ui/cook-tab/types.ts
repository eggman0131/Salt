import type { Recipe } from '@/types/contract';

export type CookStep = 'miseEnPlace' | number;

export interface CookTabScreenProps {
  recipe: Recipe;
  currentStep: CookStep;
  setCurrentStep: (step: CookStep) => void;
  miseEnPlaceChecked: Set<string>;
  handleMiseEnPlaceToggle: (ingredientId: string) => void;
  handleMiseEnPlaceToggleAll: () => void;
  keepAwakeEnabled: boolean;
  setKeepAwakeEnabled: (enabled: boolean) => void;
  miseEnPlaceProgress: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  handleNext: () => void;
  handlePrev: () => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  onClose?: () => void;
}
