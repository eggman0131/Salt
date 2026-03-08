import React from 'react';
import type { Recipe } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ArrowRight, Lock, LockOpen } from 'lucide-react';
import { MiseEnPlaceContent, CookingStepContent } from './shared';
import type { CookTabScreenProps } from './types';

export const CookTabDesktop: React.FC<CookTabScreenProps> = ({
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
    <Card className="p-8 border-l-4 border-l-primary bg-white dark:bg-gray-900">
      <MiseEnPlaceContent
        recipe={recipe}
        miseEnPlaceChecked={miseEnPlaceChecked}
        handleMiseEnPlaceToggle={handleMiseEnPlaceToggle}
        handleMiseEnPlaceToggleAll={handleMiseEnPlaceToggleAll}
        miseEnPlaceProgress={miseEnPlaceProgress}
      />
    </Card>
  );

  const renderCookingStep = (stepIndex: number) => {
    const step = CookingStepContent({ recipe, stepIndex });
    const { instruction, nextInstruction } = step;
    const warnings = step.renderWarnings();
    const ingredients = step.renderIngredients();

    return (
      <div className="grid grid-cols-3 gap-8">
        {/* Main Content (2 columns) */}
        <Card className="col-span-2 p-8 border-l-4 border-l-primary bg-white dark:bg-gray-900">
          <div className="space-y-6">
            {/* Ingredients */}
            {ingredients && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ingredients for this step</h3>
                {ingredients}
              </div>
            )}

            {/* Instruction */}
            <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">{instruction}</h2>

            {/* Warnings */}
            {warnings && (
              <div className="space-y-4">{warnings}</div>
            )}
          </div>
        </Card>

        {/* Sidebar (1 column) */}
        <div className="space-y-6">
          {/* Next Step Preview */}
          {nextInstruction && (
            <Card className="p-6 bg-linear-to-br from-primary/5 to-primary/10 border border-primary/20 sticky top-20">
              <div className="text-xs font-bold uppercase tracking-wider text-primary mb-4">Coming Next</div>
              <Separator className="mb-4" />
              <div className="text-lg font-semibold text-gray-900 dark:text-white leading-relaxed">{nextInstruction}</div>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col pb-20 relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-8 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{recipe.title}</h1>
          </div>
          <button
            onClick={() => setKeepAwakeEnabled(!keepAwakeEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
              keepAwakeEnabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {keepAwakeEnabled ? (
              <>
                <Lock className="w-4 h-4" />
                Screen Locked On
              </>
            ) : (
              <>
                <LockOpen className="w-4 h-4" />
                Keep Screen On
              </>
            )}
          </button>
        </div>
        {/* Progress bar */}
        <div className="max-w-7xl mx-auto mt-3">
          {currentStep !== 'miseEnPlace' && (
            <Progress value={((currentStep as number) / recipe.instructions.length) * 100} className="h-1 bg-gray-200 dark:bg-gray-800" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {currentStep === 'miseEnPlace' ? renderMiseEnPlace() : renderCookingStep(currentStep as number)}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 px-8 py-4 shadow-lg">
          <div className="col-span-2 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePrev}
              disabled={isFirstStep}
              className="flex-1"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>

            <Button
              size="lg"
              onClick={handleNext}
              className="flex-1"
            >
              {currentStep === 'miseEnPlace' ? "Let's Start Cooking" : isLastStep ? 'Finish' : 'Next'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        
      </div>
    </div>
  );
};
