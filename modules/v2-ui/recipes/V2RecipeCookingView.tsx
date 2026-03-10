import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Recipe, RecipeInstruction } from '../../../types/contract';
import { Button } from '../design-system/components/Button';
import { Progress } from '../../../components/ui/progress';
import { Badge } from '../design-system/components/Badge';
import { Checkbox } from '../design-system/components/Checkbox';
import { ArrowLeft, ArrowRight, X, CheckCircle2, AlertTriangle, ChefHat } from 'lucide-react';
import { useCookTabLogic } from '../../recipes/ui/cook-tab/useCookTabLogic';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '../../../components/ui/alert-dialog';

interface V2RecipeCookingViewProps {
  recipe: Recipe;
  onClose: () => void;
}

export const V2RecipeCookingView: React.FC<V2RecipeCookingViewProps> = ({ recipe, onClose }) => {
  const {
    currentStep,
    miseEnPlaceChecked,
    handleMiseEnPlaceToggle,
    handleMiseEnPlaceToggleAll,
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
  } = useCookTabLogic(recipe, onClose);

  // Calculate overall progress for the top bar
  const totalSteps = recipe.instructions.length + 1; // +1 for Mise en Place
  const currentStepNumber = currentStep === 'miseEnPlace' ? 0 : (currentStep as number) + 1;
  const overallProgress = (currentStepNumber / totalSteps) * 100;

  // Sort ingredients: unchecked first, checked at the bottom
  const sortedIngredients = useMemo(() => {
    return [...recipe.ingredients].sort((a, b) => {
      const aChecked = miseEnPlaceChecked.has(a.id);
      const bChecked = miseEnPlaceChecked.has(b.id);
      if (aChecked === bChecked) return 0;
      return aChecked ? 1 : -1;
    });
  }, [recipe.ingredients, miseEnPlaceChecked]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const renderMiseEnPlace = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-4xl md:text-6xl font-black tracking-tight bg-gradient-to-br from-[var(--color-v2-foreground)] to-[var(--color-v2-muted-foreground)] bg-clip-text text-transparent">
          Mise en Place
        </h2>
        <p className="text-xl md:text-2xl text-[var(--color-v2-muted-foreground)] font-medium">Gather and prepare all your ingredients</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-bold uppercase tracking-widest text-[var(--color-v2-muted-foreground)]">Preparation Progress</span>
          <span className="text-xl font-black text-[var(--color-v2-primary)]">{miseEnPlaceChecked.size} / {recipe.ingredients.length}</span>
        </div>
        <Progress value={miseEnPlaceProgress} className="h-3 md:h-4 bg-[var(--color-v2-secondary)] [&>div]:bg-[var(--color-v2-primary)]" />
      </div>

      <div className="space-y-4 pt-8">
        <div 
          className="flex items-center justify-between p-6 md:p-8 rounded-[var(--radius-v2-2xl)] bg-[var(--color-v2-primary)]/10 border-2 border-[var(--color-v2-primary)]/30 cursor-pointer hover:bg-[var(--color-v2-primary)]/20 transition-colors"
          onClick={handleMiseEnPlaceToggleAll}
        >
          <span className="text-xl md:text-2xl font-black text-[var(--color-v2-primary)]">Tick All Ingredients</span>
          <Checkbox 
            checked={miseEnPlaceChecked.size === recipe.ingredients.length} 
            className="w-8 h-8 md:w-10 md:h-10 border-2 border-[var(--color-v2-primary)] data-[state=checked]:bg-[var(--color-v2-primary)] data-[state=checked]:text-white"
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={handleMiseEnPlaceToggleAll}
          />
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {sortedIngredients.map((ingredient) => (
            <li 
              key={ingredient.id} 
              className={`flex items-center gap-4 p-4 md:p-5 rounded-[var(--radius-v2-xl)] border-2 transition-all duration-300 cursor-pointer ${
                miseEnPlaceChecked.has(ingredient.id) 
                  ? 'bg-[var(--color-v2-secondary)] border-[var(--color-v2-border)] opacity-50 scale-[0.98]' 
                  : 'v2-glass hover:bg-[var(--color-v2-card)] border-[var(--color-v2-border)]/50 shadow-sm'
              }`}
              onClick={() => handleMiseEnPlaceToggle(ingredient.id)}
            >
              <Checkbox
                checked={miseEnPlaceChecked.has(ingredient.id)}
                className={`w-6 h-6 md:w-8 md:h-8 border-2 rounded-lg ${miseEnPlaceChecked.has(ingredient.id) ? 'border-[var(--color-v2-muted-foreground)] data-[state=checked]:bg-[var(--color-v2-muted-foreground)]' : 'border-[var(--color-v2-primary)]'}`}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={() => handleMiseEnPlaceToggle(ingredient.id)}
              />
              <div className="flex-1 min-w-0">
                <div className={`text-lg md:text-xl font-bold font-sans transition-colors truncate ${miseEnPlaceChecked.has(ingredient.id) ? 'text-[var(--color-v2-muted-foreground)] line-through' : 'text-[var(--color-v2-foreground)]'}`}>
                  {ingredient.quantity && ingredient.unit && (
                    <span className="text-[var(--color-v2-primary)] mr-2.5">{ingredient.quantity} {ingredient.unit}</span>
                  )}
                  {ingredient.ingredientName}
                </div>
                {ingredient.preparation && (
                  <div className={`text-sm md:text-base mt-1 font-medium truncate ${miseEnPlaceChecked.has(ingredient.id) ? 'text-[var(--color-v2-muted-foreground)]/70' : 'text-[var(--color-v2-muted-foreground)]'}`}>{ingredient.preparation}</div>
                )}
              </div>
              {miseEnPlaceChecked.has(ingredient.id) && (
                <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-[var(--color-v2-muted-foreground)] shrink-0" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const renderCookingStep = (stepIndex: number) => {
    const instr = recipe.instructions[stepIndex] as RecipeInstruction;
    const nextInstr = stepIndex < recipe.instructions.length - 1 
      ? (recipe.instructions[stepIndex + 1] as RecipeInstruction) 
      : null;

    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 h-full flex flex-col justify-center">
        
        <div className="text-center mb-6">
           <span className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-[var(--color-v2-card)] border-[3px] border-[var(--color-v2-primary)] text-2xl md:text-3xl font-black text-[var(--color-v2-primary)] shadow-xl shadow-[var(--color-v2-primary)]/20 mb-4">
              {stepIndex + 1}
           </span>
        </div>

        {/* Massive Instruction */}
        <h2 className="text-3xl md:text-5xl lg:text-7xl font-black tracking-tight text-[var(--color-v2-foreground)] text-center leading-[1.2] drop-shadow-sm max-w-5xl mx-auto">
          {instr.text}
        </h2>

        <div className="max-w-4xl mx-auto w-full space-y-6 pt-12">
          {/* Warnings */}
          {instr.technicalWarnings && instr.technicalWarnings.length > 0 && (
            <div className="v2-glass bg-orange-500/10 border-orange-500/30 p-6 md:p-8 rounded-[var(--radius-v2-2xl)]">
              <h3 className="text-sm md:text-base font-bold uppercase tracking-widest text-orange-500 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Chef Warnings
              </h3>
              <ul className="space-y-3">
                {instr.technicalWarnings.map((warning, idx) => (
                  <li key={idx} className="flex gap-3 text-lg md:text-2xl font-medium text-orange-600 dark:text-orange-400">
                    <span className="shrink-0 mt-1.5">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ingredients Used in Step */}
          {instr.ingredients && instr.ingredients.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 md:gap-4 pt-4">
              {instr.ingredients.map((ingredient) => (
                <Badge key={ingredient.id} variant="secondary" className="text-sm md:text-base py-2 px-4 rounded-xl bg-[var(--color-v2-card)]/80 backdrop-blur-xl border border-[var(--color-v2-border)] shadow-md">
                  {ingredient.quantity && ingredient.unit ? (
                    <>
                      <span className="text-[var(--color-v2-primary)] mr-1.5 font-bold">{ingredient.quantity} {ingredient.unit}</span>
                      {ingredient.ingredientName}
                    </>
                  ) : (
                    ingredient.ingredientName
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Next Step Preview */}
        {nextInstr && (
          <div className="mt-8 mx-auto max-w-3xl text-center opacity-60">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-v2-muted-foreground)] mb-3">Up Next</div>
            <div className="text-lg md:text-xl text-[var(--color-v2-foreground)] font-medium line-clamp-2">{nextInstr.text}</div>
          </div>
        )}
      </div>
    );
  };

  const content = (
    <>
      <AlertDialog open={!!pendingResume}>
        <AlertDialogContent className="bg-[var(--color-v2-card)] border border-[var(--color-v2-border)] text-[var(--color-v2-foreground)] rounded-[var(--radius-v2-2xl)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">Hold on Chef!</AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium text-[var(--color-v2-muted-foreground)]">
              You left off part way through this recipe. Would you like to resume where you were, or start fresh?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3 sm:gap-0">
            <AlertDialogCancel onClick={restartProgress} className="h-12 rounded-xl border-[var(--color-v2-border)]">Start Fresh</AlertDialogCancel>
            <AlertDialogAction onClick={resumeProgress} className="h-12 rounded-xl bg-[var(--color-v2-primary)] hover:bg-[var(--color-v2-primary)]/90 text-white">Resume Cooking</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div 
        className="fixed inset-0 z-[100] bg-[var(--color-v2-background)] flex flex-col pt-[max(env(safe-area-inset-top),16px)]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Dynamic Progress Indicator at the absolute top */}
        <div className="absolute top-0 inset-x-0 h-1.5 md:h-2 bg-[var(--color-v2-secondary)] z-50">
           <div className="h-full bg-[var(--color-v2-primary)] transition-all duration-700 ease-out" style={{ width: `${overallProgress}%` }} />
        </div>

        {/* Header */}
        <div className="shrink-0 sticky top-0 z-40 px-4 md:px-8 py-4 md:py-6 flex items-center justify-between pointer-events-none">
           <div className="pointer-events-auto flex items-center gap-3 md:gap-4 bg-[var(--color-v2-card)]/50 backdrop-blur-2xl border border-[var(--color-v2-border)]/50 p-2 md:p-3 pr-6 md:pr-8 rounded-[var(--radius-v2-2xl)] shadow-lg max-w-[70%]">
             <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[var(--color-v2-primary)] flex items-center justify-center text-white shrink-0">
               <ChefHat className="w-5 h-5 md:w-6 md:h-6" />
             </div>
             <h1 className="text-lg md:text-2xl font-black text-[var(--color-v2-foreground)] truncate">{recipe.title}</h1>
           </div>
           
           <Button 
             variant="outline" 
             onClick={onClose}
             className="pointer-events-auto rounded-[var(--radius-v2-2xl)] h-14 md:h-16 px-6 md:px-8 bg-[var(--color-v2-card)]/50 backdrop-blur-2xl border border-[var(--color-v2-border)]/50 shadow-lg hover:bg-[var(--color-v2-secondary)] hover:text-[var(--color-v2-destructive)] group shrink-0"
           >
             <X className="w-6 h-6 md:w-8 md:h-8 mr-2 md:mr-3 group-hover:scale-110 transition-transform" />
             <span className="font-bold text-lg md:text-xl">Exit</span>
           </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-12 pb-48 md:pb-64 no-scrollbar">
          <div className="max-w-6xl mx-auto h-full">
            {currentStep === 'miseEnPlace' ? renderMiseEnPlace() : renderCookingStep(currentStep as number)}
          </div>
        </div>

        {/* Enormous Bottom Interaction Area */}
        <div className="fixed bottom-0 inset-x-0 h-28 md:h-40 flex z-50 p-4 gap-4 bg-gradient-to-t from-[var(--color-v2-background)] via-[var(--color-v2-background)]/90 to-transparent pointer-events-none">
           <Button
             variant="outline"
             onClick={handlePrev}
             disabled={isFirstStep}
             className="flex-1 h-full rounded-[var(--radius-v2-2xl)] bg-[var(--color-v2-card)]/80 backdrop-blur-xl border-2 border-[var(--color-v2-border)]/50 shadow-lg hover:bg-[var(--color-v2-secondary)] pointer-events-auto text-lg md:text-2xl font-bold disabled:opacity-30 transition-all active:scale-[0.98]"
           >
             <ArrowLeft className="w-6 h-6 md:w-8 md:h-8 mr-2 md:mr-3" />
             Back
           </Button>
           <Button
             onClick={handleNext}
             className="flex-1 h-full rounded-[var(--radius-v2-2xl)] bg-[var(--color-v2-primary)] hover:bg-[var(--color-v2-primary)]/90 text-white shadow-xl shadow-[var(--color-v2-primary)]/30 pointer-events-auto text-xl md:text-3xl font-bold transition-all active:scale-[0.98]"
           >
             {currentStep === 'miseEnPlace' ? "Let's Cook" : isLastStep ? 'Finish' : 'Next'}
             <ArrowRight className="w-6 h-6 md:w-8 md:h-8 ml-2 md:ml-3" />
           </Button>
        </div>
      </div>
    </>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
};
