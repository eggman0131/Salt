import React from 'react';
import { Card } from '../UI';

interface RepairRecipeModalProps {
  stages: {
    categorise: boolean;
    relinkIngredients: boolean;
  };
  onToggle: (key: 'categorise' | 'relinkIngredients') => void;
  onRun: () => void;
  onCancel: () => void;
  isRunning?: boolean;
}

export const RepairRecipeModal: React.FC<RepairRecipeModalProps> = ({
  stages,
  onToggle,
  onRun,
  onCancel,
  isRunning = false,
}) => {
  const nothingSelected = !stages.categorise && !stages.relinkIngredients;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
      onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      <Card
        className="w-full max-w-md bg-white shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      >
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Repair Recipe</h3>
            <p className="text-sm text-gray-600 mt-1">Choose one or more checks to run.</p>
          </div>
          <div className="space-y-2">
            <label className={`flex gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              stages.categorise ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <input
                type="checkbox"
                checked={stages.categorise}
                onChange={() => onToggle('categorise')}
                className="mt-1 w-4 h-4 text-orange-600"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Re-categorise recipe</p>
                <p className="text-xs text-gray-600">Refresh the category list from the current recipe.</p>
              </div>
            </label>
            <label className={`flex gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              stages.relinkIngredients ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <input
                type="checkbox"
                checked={stages.relinkIngredients}
                onChange={() => onToggle('relinkIngredients')}
                className="mt-1 w-4 h-4 text-orange-600"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Relink ingredients</p>
                <p className="text-xs text-gray-600">Match ingredients to the item list again.</p>
              </div>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onRun}
              disabled={isRunning || nothingSelected}
              className="flex-1 h-10 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50"
            >
              {isRunning ? 'Repairing...' : 'Run Repair'}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 h-10 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
