/**
 * Cook Mode Module
 *
 * Main component for step-by-step autism-friendly cooking.
 * Shows prep phase first, then cooking steps with sensory guidance.
 */

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Recipe } from '../../../types/contract';
import { CookGuide } from '../types';
import {
  getOrGenerateCookGuide,
  regenerateCookGuide,
  isGuideStale,
  updateCookingStep,
  updatePrepGroups,
  deleteCookGuide,
} from '../internal';
import { PrepPhaseView } from './PrepPhaseView';
import { CookingStepView } from './CookingStepView';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, HandHelping, ArrowLeft, ArrowRight, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

interface CookModeModuleProps {
  recipe: Recipe;
  onClose: () => void;
}

type CookStep = 'prep' | number;

export const CookModeModule: React.FC<CookModeModuleProps> = ({ recipe, onClose }) => {
  const [guide, setGuide] = useState<CookGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingGuide, setIsDeletingGuide] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [currentStep, setCurrentStep] = useState<CookStep>('prep');

  const stale = guide ? isGuideStale(guide, recipe) : false;

  useEffect(() => {
    const loadGuide = async () => {
      try {
        setIsLoading(true);
        const cookGuide = await getOrGenerateCookGuide(recipe);
        setGuide(cookGuide);
      } catch (err) {
        console.error('Failed to load cook guide:', err);
        if (err instanceof Error && err.message.includes('Gemini API key not configured')) {
          softToast.error('Cooking guide service key is missing');
        } else {
          softToast.error('Failed to load cooking guide');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadGuide();
  }, [recipe]);

  const handleRegenerate = async () => {
    setShowRegenerateConfirm(false);
    setIsRegenerating(true);
    try {
      const newGuide = await regenerateCookGuide(recipe);
      setGuide(newGuide);
      setCurrentStep('prep');
      softToast.success('Guide regenerated');
    } catch (err) {
      console.error('Failed to regenerate guide:', err);
      softToast.error('Failed to regenerate guide');
    } finally {
      setIsRegenerating(false);
    }
  };

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentStep]);

  if (isLoading || isRegenerating) {
    return (
      <div className="fixed inset-0 z-200 bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {isRegenerating ? 'Regenerating Assist Mode guide...' : 'Generating Assist Mode guide...'}
          </p>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="fixed inset-0 z-200 bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Failed to load cooking guide</p>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const currentStepData = typeof currentStep === 'number' ? guide.steps[currentStep] : null;
  const allStepsComplete = typeof currentStep === 'number' && currentStep >= guide.steps.length;
  const isFirstStep = currentStep === 'prep';
  const isLastStep = typeof currentStep === 'number' && currentStep === guide.steps.length - 1;

  const handleNext = () => {
    if (currentStep === 'prep') {
      setCurrentStep(0);
    } else if (typeof currentStep === 'number' && currentStep < guide.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (typeof currentStep === 'number' && currentStep === guide.steps.length - 1) {
      onClose();
    }
  };

  const handlePrev = () => {
    if (typeof currentStep === 'number' && currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (typeof currentStep === 'number' && currentStep === 0) {
      setCurrentStep('prep');
    }
  };

  const handleStepUpdate = async (guideId: string, stepId: string, updatedStep: any) => {
    try {
      const updatedGuide = await updateCookingStep(guideId, stepId, updatedStep);
      setGuide(updatedGuide);
      softToast.success('Step updated', {
        description: 'Your changes have been saved',
      });
    } catch (error) {
      console.error('Failed to update step:', error);
      softToast.error('Save failed', {
        description: error instanceof Error ? error.message : 'Unable to save changes',
      });
    }
  };

  const handleDeleteGuide = async () => {
    if (!guide || isDeletingGuide) return;
    setIsDeletingGuide(true);
    try {
      await deleteCookGuide(guide.id);
      softToast.success('Assist Mode guide deleted');
      onClose();
    } catch (error) {
      console.error('Failed to delete guide:', error);
      softToast.error('Failed to delete guide');
    } finally {
      setIsDeletingGuide(false);
    }
  };

  const handlePrepGroupsUpdate = async (guideId: string, prepGroups: any) => {
    try {
      const updatedGuide = await updatePrepGroups(guideId, prepGroups);
      setGuide(updatedGuide);
      softToast.success('Prep phase updated', {
        description: 'Your changes have been saved',
      });
    } catch (error) {
      console.error('Failed to update prep groups:', error);
      softToast.error('Save failed', {
        description: error instanceof Error ? error.message : 'Unable to save changes',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-200 bg-white dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <HandHelping className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{guide.recipeTitle}</h1>
              <p className="text-xs text-muted-foreground">Assist Mode • Step-by-step guidance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            aria-label="Close assist mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {typeof currentStep === 'number' && (
          <Progress value={(currentStep / guide.steps.length) * 100} className="h-1 bg-gray-200 dark:bg-gray-800" />
        )}
      </div>

      {/* Stale guide warning */}
      {stale && guide.isReviewed && (
        <div className="mx-4 mb-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Recipe has changed since this guide was reviewed
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Your reviewed guide is preserved. Regenerating will replace all human edits.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
              onClick={() => setShowRegenerateConfirm(true)}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-0 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {currentStep === 'prep' && (
            <div className="space-y-6">
              <PrepPhaseView
                prepGroups={guide.prepGroups}
                guideId={guide.id}
                onPrepGroupsUpdate={handlePrepGroupsUpdate}
              />
            </div>
          )}

          {typeof currentStep === 'number' && !allStepsComplete && currentStepData && (
            <div className="space-y-6">
              <CookingStepView
                step={currentStepData}
                totalSteps={guide.steps.length}
                recipeInstruction={recipe.instructions[currentStepData?.instructionIndex ?? (currentStepData.stepNumber - 1)]?.text}
                guideId={guide.id}
                onStepUpdate={handleStepUpdate}
                onDeleteGuide={handleDeleteGuide}
                isDeletingGuide={isDeletingGuide}
              />
            </div>
          )}

          {allStepsComplete && (
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
      </div>

      {/* Bottom Navigation */}
      {!allStepsComplete && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
            <Button
              variant="outline"
              disabled={isFirstStep}
              onClick={handlePrev}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1"
            >
              {currentStep === 'prep' ? "Let's Start Cooking" : isLastStep ? 'Finish' : 'Next'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Regenerate confirmation dialog */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Assist Mode guide?</AlertDialogTitle>
            <AlertDialogDescription>
              This guide has been reviewed and edited by a person. Regenerating will
              permanently replace all human edits with a new AI-generated guide.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current guide</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
