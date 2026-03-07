import React from 'react';
import type { Recipe } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { MiseEnPlaceContent, CookingStepContent } from './shared';
import type { CookTabScreenProps } from './types';

export const CookTabMobile: React.FC<CookTabScreenProps> = ({
  recipe,
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
  onClose,
}) => {
  const renderMiseEnPlace = () => (
    <MiseEnPlaceContent
      recipe={recipe}
      miseEnPlaceChecked={miseEnPlaceChecked}
      handleMiseEnPlaceToggle={handleMiseEnPlaceToggle}
      handleMiseEnPlaceToggleAll={handleMiseEnPlaceToggleAll}
      miseEnPlaceProgress={miseEnPlaceProgress}
    />
  );

  const renderCookingStep = (stepIndex: number) => {
    const step = CookingStepContent({ recipe, stepIndex });
    const { instruction, nextInstruction } = step;
    const warnings = step.renderWarnings();
    const ingredients = step.renderIngredients();

    return (
      <div className="space-y-6">
        {/* Instruction */}
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white text-center">{instruction}</h2>

        {/* Warnings */}
        {warnings && (
          <div className="space-y-3">{warnings}</div>
        )}

        {/* Next Step Preview */}
        {nextInstruction && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-300 dark:border-gray-600">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Next</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{nextInstruction}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-200 bg-white dark:bg-gray-950 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate flex-1">{recipe.title}</h1>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close cook mode"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {/* Progress bar */}
        {currentStep !== 'miseEnPlace' && (
          <Progress value={((currentStep as number) / recipe.instructions.length) * 100} className="h-1 bg-gray-200 dark:bg-gray-800" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 pb-20 overflow-y-auto">
        {currentStep === 'miseEnPlace' ? renderMiseEnPlace() : renderCookingStep(currentStep as number)}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={isFirstStep}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            className="flex-1"
          >
            {currentStep === 'miseEnPlace' ? "Let's Start Cooking" : isLastStep ? 'Finish' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
