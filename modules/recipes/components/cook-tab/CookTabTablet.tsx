import React from 'react';
import { Recipe } from '../../../../types/contract';
import { Button } from '../../../../components/ui/button';
import { Separator } from '../../../../components/ui/separator';
import { ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react';
import { MiseEnPlaceContent, CookingStepContent } from './shared';
import { CookTabScreenProps } from './types';

export const CookTabTablet: React.FC<CookTabScreenProps> = ({
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
        <div className="space-y-2">
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
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{instruction}</h2>

        <Separator />

        {/* Two-Column Layout */}
        <div className="grid grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Warnings */}
            {warnings && (
              <div className="space-y-3">{warnings}</div>
            )}
          </div>

          {/* Right Column */}
          {nextInstruction && (
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-300 dark:border-gray-600 h-fit sticky top-20">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Next Step</div>
              <div className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">{nextInstruction}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-white dark:bg-gray-950 flex flex-col pb-20"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/50 dark:bg-gray-950/50 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{recipe.title}</h1>
            <span className="text-sm font-bold text-muted-foreground">
              {currentStep === 'miseEnPlace' ? '0' : `${(currentStep as number) + 1}`} / {recipe.instructions.length}
            </span>
          </div>
          <button
            onClick={() => setKeepAwakeEnabled(!keepAwakeEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              keepAwakeEnabled
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {keepAwakeEnabled ? (
              <>
                <Lock className="w-4 h-4" />
                Screen On
              </>
            ) : (
              <>
                <LockOpen className="w-4 h-4" />
                Keep On
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {currentStep === 'miseEnPlace' ? renderMiseEnPlace() : renderCookingStep(currentStep as number)}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrev}
            disabled={isFirstStep}
            className="flex-1"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <Button
            variant="default"
            size="lg"
            onClick={handleNext}
            disabled={isLastStep}
            className="flex-1"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
