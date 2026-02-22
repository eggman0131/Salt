import React from 'react';
import { Recipe } from '../../types/contract';

interface RecipeInstructionsSectionProps {
  recipe: Recipe;
  editedRecipe: Recipe | null;
  isEditing: boolean;
  onEditInstruction: (index: number, value: string) => void;
  onDeleteInstruction: (index: number) => void;
  onAddInstruction: () => void;
}

export const RecipeInstructionsSection: React.FC<RecipeInstructionsSectionProps> = ({
  recipe,
  editedRecipe,
  isEditing,
  onEditInstruction,
  onDeleteInstruction,
  onAddInstruction,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">Instructions</h3>
      {isEditing && editedRecipe ? (
        <div className="space-y-3">
          {(editedRecipe.instructions || []).map((inst, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm">
                {i + 1}
              </span>
              <div className="flex-1 flex gap-2">
                <textarea
                  value={inst}
                  onChange={(e) => onEditInstruction(i, e.target.value)}
                  className="flex-1 text-base border border-gray-300 rounded-lg px-3 py-2 resize-none"
                  rows={2}
                  placeholder="Step instruction"
                />
                <button
                  onClick={() => onDeleteInstruction(i)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Delete step"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={onAddInstruction}
            className="w-full h-9 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            + Add Step
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {(recipe.instructions || []).map((inst, i) => {
            // Get alerts for this step (stepAlerts indexes into technicalWarnings)
            const stepAlertIndices = recipe.stepAlerts?.[i] || [];
            const stepWarnings = stepAlertIndices
              .map(idx => recipe.workflowAdvice?.technicalWarnings?.[idx])
              .filter((w): w is string => typeof w === 'string' && w.length > 0);

            return (
              <div key={i} className="space-y-3">
                <div className="flex gap-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm">
                    {i + 1}
                  </span>
                  <p className="text-base text-gray-700 leading-relaxed">{inst}</p>
                </div>
                {stepWarnings.length > 0 && (
                  <div className="ml-13 space-y-2">
                    {stepWarnings.map((warning, wIdx) => (
                      <div key={wIdx} className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                        <span className="text-lg flex-shrink-0">⚠️</span>
                        <p className="text-sm text-red-800 font-medium leading-relaxed">{warning}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
