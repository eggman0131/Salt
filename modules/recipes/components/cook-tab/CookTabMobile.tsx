import React from 'react';
import { Recipe } from '../../../../types/contract';
import { Button } from '../../../../components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { MiseEnPlaceContent, CookingStepContent } from './shared';
import { CookTabScreenProps } from './types';

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
        {/* Step Header */}
        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 bg-primary/10 rounded-full">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Step {stepIndex + 1} of {recipe.instructions.length}
            </span>
          </div>
        </div>

        {/* Ingredients */}
        {ingredients && (
          <div className="space-y-3">{ingredients}</div>
        )}

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
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
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
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 pb-20 overflow-y-auto">
        {currentStep === 'miseEnPlace' ? renderMiseEnPlace() : renderCookingStep(currentStep as number)}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={isFirstStep}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button
            variant="default"
            onClick={handleNext}
            disabled={isLastStep}
            className="flex-1"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
