/**
 * Cook Mode Module
 * 
 * Main component for step-by-step autism-friendly cooking.
 * Shows prep phase first, then cooking steps with sensory guidance.
 */

import React, { useState, useEffect } from 'react';
import { Recipe } from '../../../types/contract';
import { CookGuide } from '../types';
import { cookModeBackend } from '../backend';
import { PrepPhaseView } from './PrepPhaseView';
import { CookingStepView } from './CookingStepView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ChefHat, ArrowLeft, ArrowRight } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

interface CookModeModuleProps {
  recipe: Recipe;
  onClose: () => void;
}

enum Phase {
  PREP = 'prep',
  COOKING = 'cooking',
}

export const CookModeModule: React.FC<CookModeModuleProps> = ({ recipe, onClose }) => {
  const [guide, setGuide] = useState<CookGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>(Phase.PREP);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Load or generate cook guide
  useEffect(() => {
    const loadGuide = async () => {
      try {
        setIsLoading(true);
        const cookGuide = await cookModeBackend.getOrGenerateCookGuide(recipe);
        setGuide(cookGuide);
      } catch (err) {
        console.error('Failed to load cook guide:', err);
        softToast.error('Failed to load cooking guide');
      } finally {
        setIsLoading(false);
      }
    };

    loadGuide();
  }, [recipe]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Preparing your cooking guide...</p>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Failed to load cooking guide</p>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const currentStep = guide.steps[currentStepIdx];
  const allStepsComplete = currentStepIdx >= guide.steps.length;

  return (
    <div className="min-h-screen bg-background space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <Card className="sticky top-0 z-40 border-b">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ChefHat className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg md:text-xl">{guide.recipeTitle}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Autism-friendly cooking mode</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="max-w-2xl mx-auto px-4 md:px-6 space-y-6">
        {/* Phase tabs */}
        <div className="flex gap-2">
          <Button
            variant={phase === Phase.PREP ? 'default' : 'outline'}
            onClick={() => {
              setPhase(Phase.PREP);
              setCurrentStepIdx(0);
            }}
            className="flex-1"
            size="sm"
          >
            Prep Phase
          </Button>
          <Button
            variant={phase === Phase.COOKING ? 'default' : 'outline'}
            onClick={() => {
              setPhase(Phase.COOKING);
              setCurrentStepIdx(0);
            }}
            className="flex-1"
            size="sm"
          >
            Cook Steps
          </Button>
        </div>

        {/* Prep phase */}
        {phase === Phase.PREP && (
          <div className="space-y-6">
            <PrepPhaseView prepGroups={guide.prepGroups} />
            <Button onClick={() => setPhase(Phase.COOKING)} className="w-full">
              Let's Start Cooking →
            </Button>
          </div>
        )}

        {/* Cooking phase */}
        {phase === Phase.COOKING && (
          <div className="space-y-6">
            {!allStepsComplete ? (
              <>
                <CookingStepView step={currentStep} totalSteps={guide.steps.length} />

                {/* Navigation */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    disabled={currentStepIdx === 0}
                    onClick={() => setCurrentStepIdx(Math.max(0, currentStepIdx - 1))}
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={() => setCurrentStepIdx(currentStepIdx + 1)}
                    className="flex-1"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                {/* Step progress */}
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Step {currentStepIdx + 1} of {guide.steps.length}
                  </p>
                </div>
              </>
            ) : (
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="text-4xl">🍽️</div>
                  <div>
                    <h3 className="font-semibold text-lg">Dinner is served!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      You've completed all the steps. Enjoy your meal.
                    </p>
                  </div>
                  <Button onClick={onClose} className="w-full">
                    Finish
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
