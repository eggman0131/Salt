import React, { useState } from 'react';
import { Recipe } from '../../types/contract';

interface AtAGlanceSectionProps {
  recipe: Recipe;
  onServingsChange?: (newServings: string) => void;
  isServingsChanging?: boolean;
}

export const AtAGlanceSection: React.FC<AtAGlanceSectionProps> = ({ recipe, onServingsChange, isServingsChanging = false }) => {
  const [isAdjustingServings, setIsAdjustingServings] = useState(false);
  const [servingsInput, setServingsInput] = useState(recipe.servings);

  const handleServingsSubmit = () => {
    if (servingsInput && servingsInput !== recipe.servings && onServingsChange) {
      onServingsChange(servingsInput);
      // Don't reset until the save completes (isServingsChanging becomes false)
      return;
    }
    setIsAdjustingServings(false);
    setServingsInput(recipe.servings);
  };

  const handleServingsCancel = () => {
    setIsAdjustingServings(false);
    setServingsInput(recipe.servings);
  };

  // Sync servings input when recipe updates (e.g., from server)
  React.useEffect(() => {
    setServingsInput(recipe.servings);
  }, [recipe.servings]);

  // Exit edit mode when save completes
  React.useEffect(() => {
    if (isAdjustingServings && !isServingsChanging) {
      setIsAdjustingServings(false);
    }
  }, [isServingsChanging]);

  const getSiteFromUrl = (url: string): string => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  const sourceSite = recipe.source ? getSiteFromUrl(recipe.source) : '';

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">At a Glance</h3>
        {recipe.collection && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-50 text-orange-700 border border-orange-100">
            {recipe.collection}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px] text-gray-700">
        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h8M12 8v8"/></svg>
            Complexity
          </p>
          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.complexity}</p>
        </div>
        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-9 4h10m-7 4h4"/></svg>
            Prep
          </p>
          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.prepTime}</p>
        </div>
        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2s-2 2-2 5 2 5 2 5 2-2 2-5-2-5-2-5zm5 7c0 4-3 7-5 7s-5-3-5-7"/></svg>
            Cook
          </p>
          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.cookTime}</p>
        </div>
        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
            Total
          </p>
          <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.totalTime}</p>
        </div>
        <div className={`p-2 rounded-md bg-orange-50/60 border transition-colors ${isAdjustingServings || isServingsChanging ? 'border-orange-300' : 'border-orange-100 group cursor-pointer hover:border-orange-200'}`} onClick={() => !isServingsChanging && onServingsChange && setIsAdjustingServings(true)}>
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="3" strokeWidth="2"/><circle cx="17" cy="9" r="2" strokeWidth="2"/></svg>
            Servings
          </p>
          {isAdjustingServings ? (
            <div className="mt-0.5 flex gap-0.5 items-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={servingsInput}
                onChange={(e) => setServingsInput(e.target.value)}
                onBlur={handleServingsSubmit}
                disabled={isServingsChanging}
                className="w-12 h-5 text-xs px-1 border border-orange-300 rounded bg-white text-gray-900 text-center focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleServingsSubmit();
                  if (e.key === 'Escape' && !isServingsChanging) handleServingsCancel();
                }}
              />
              {isServingsChanging && (
                <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
          ) : (
            <p className="mt-0.5 text-xs font-semibold text-gray-900">{recipe.servings}</p>
          )}
        </div>
        <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-9 4h10m-7 4h4"/></svg>
            Created
          </p>
          <p className="mt-0.5 text-xs font-semibold text-gray-900">{new Date(recipe.createdAt).toLocaleDateString()}</p>
        </div>
        {sourceSite && (
          <div className="p-2 rounded-md bg-orange-50/60 border border-orange-100 sm:col-span-2 lg:col-span-2">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-orange-600 font-semibold">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8h6m-6 4h6m-6 4h6M6 8h.01M6 12h.01M6 16h.01"/></svg>
              Source
            </p>
            <a
              href={recipe.source}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-xs font-semibold text-orange-600 hover:text-orange-700 underline"
            >
              {sourceSite}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
