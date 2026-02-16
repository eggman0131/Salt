import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Recipe, Equipment } from '../types/contract';

interface CookModeProps {
  recipe: Recipe;
  inventory: Equipment[];
  onClose: () => void;
}

export const CookMode: React.FC<CookModeProps> = ({ recipe, inventory, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [preppedIngredients, setPreppedIngredients] = useState<Set<number>>(new Set());
  const [hidePreppedIngredients, setHidePreppedIngredients] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState(0);

  const wakeLockRef = useRef<any>(null);

  const ingredients = recipe.ingredients || [];
  const instructions = recipe.instructions || [];
  const progress = currentStep === 0 ? 0 : Math.round(((currentStep) / instructions.length) * 100);

  const formatIngredient = (ing: Recipe['ingredients'][number]) =>
    typeof ing === 'string' ? ing : (ing.raw || ing.ingredientName);

  const contextualIngredients = useMemo(() => {
    if (currentStep === 0) return [];
    const stepData = recipe.stepIngredients?.[currentStep - 1];
    if (!Array.isArray(stepData)) return [];
    
    return stepData
      .map(idx => ({ name: formatIngredient(ingredients[idx]), index: idx }))
      .filter(item => !!item.name);
  }, [currentStep, recipe.stepIngredients, ingredients]);

  const currentStepAlerts = useMemo(() => {
    if (currentStep === 0) return [];
    const stepData = recipe.stepAlerts?.[currentStep - 1];
    if (!Array.isArray(stepData)) return [];

    return stepData
      .map(idx => recipe.workflowAdvice?.technicalWarnings?.[idx])
      .filter((w): w is string => typeof w === 'string' && w.length > 0);
  }, [currentStep, recipe.stepAlerts, recipe.workflowAdvice]);

  // Wake lock for cook mode
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (wakeLockRef.current && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Keyboard navigation in cook mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentStep > 0) {
        e.preventDefault();
        setCurrentStep(currentStep - 1);
      } else if (e.key === 'ArrowRight' && currentStep < instructions.length) {
        e.preventDefault();
        setCurrentStep(currentStep + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, instructions.length]);

  // Swipe navigation in cook mode
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => setSwipeStartX(e.touches[0]?.clientX || 0);
    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0]?.clientX || 0;
      const diff = swipeStartX - endX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentStep < instructions.length) setCurrentStep(currentStep + 1);
        else if (diff < 0 && currentStep > 0) setCurrentStep(currentStep - 1);
      }
    };
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentStep, swipeStartX, instructions.length]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {currentStep === 0 ? (
        <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 pb-4 md:pb-6 min-h-0 overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Prep Progress</span>
              <span className="text-sm font-semibold text-gray-600">
                {preppedIngredients.size}/{ingredients.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(preppedIngredients.size / ingredients.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setHidePreppedIngredients(!hidePreppedIngredients)}
              className="flex-1 h-9 text-xs bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200"
            >
              {hidePreppedIngredients ? 'Show All' : 'Hide Prepped'}
            </button>
            <button
              onClick={() => setPreppedIngredients(new Set(ingredients.map((_, i) => i)))}
              className="flex-1 h-9 text-xs bg-emerald-100 text-emerald-700 rounded-lg font-bold hover:bg-emerald-200"
            >
              Mark All Done
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto space-y-2 min-h-0 overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
          >
            {ingredients.map((ing, i) => {
              const isPrepared = preppedIngredients.has(i);
              if (hidePreppedIngredients && isPrepared) return null;
              return (
                <label
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    isPrepared ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isPrepared}
                    onChange={() => {
                      const next = new Set(preppedIngredients);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      setPreppedIngredients(next);
                    }}
                    className="w-5 h-5 text-emerald-600 rounded"
                  />
                  <span className={`text-sm font-medium ${isPrepared ? 'text-emerald-700' : 'text-gray-900'}`}>
                    {formatIngredient(ing)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 flex flex-col pb-[110px] md:pb-6 min-h-0">

          {contextualIngredients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contextualIngredients.map(item => (
                <span key={item.index} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold">
                  {item.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex-1 bg-white rounded-lg p-6 flex items-start justify-center border border-gray-200 min-h-[220px] shadow-sm overflow-hidden">
            <div className="w-full max-h-full overflow-y-auto">
              <p className="text-lg md:text-xl font-semibold text-gray-900 leading-relaxed text-center">
                {instructions[currentStep - 1]}
              </p>
            </div>
          </div>

          {currentStepAlerts.length > 0 && (
            <div className="space-y-2">
              {currentStepAlerts.map((w, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                  <span className="text-lg flex-shrink-0">⚠️</span>
                  <p className="text-sm text-red-800 font-medium leading-relaxed">{w}</p>
                </div>
              ))}
            </div>
          )}

          {currentStep < instructions.length && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs text-orange-700 font-bold mb-1">Next</p>
              <p className="text-sm text-orange-900">{instructions[currentStep]}</p>
            </div>
          )}
        </div>
      )}

      {/* Cook Mode Controls */}
      <div
        className="border-t border-gray-200 bg-white p-4 gap-2 flex"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', marginBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => currentStep === 0 ? onClose() : setCurrentStep(currentStep - 1)}
          className="h-12 px-4 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => {
            if (currentStep === 0) setCurrentStep(1);
            else if (currentStep < instructions.length) setCurrentStep(currentStep + 1);
            else onClose();
          }}
          className="flex-1 h-12 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors"
        >
          {currentStep === 0 ? 'Start' : currentStep < instructions.length ? 'Next →' : 'Finish'}
        </button>
      </div>
    </div>
  );
};
