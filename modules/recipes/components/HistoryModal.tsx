import React from 'react';
import { Card } from '../../../components/UI';
import { Recipe, RecipeHistoryEntry } from '../../types/contract';

interface HistoryModalProps {
  recipe: Recipe;
  onClose: () => void;
  onRollback: (entry: RecipeHistoryEntry) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  recipe,
  onClose,
  onRollback,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      <Card className="w-full max-w-lg bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900">Recipe History</h3>
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {recipe.history && recipe.history.length > 0 ? (
              recipe.history.map((entry, idx) => (
                <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2 hover:bg-gray-50 transition-colors">
                  <p className="font-medium text-gray-900">{entry.changeDescription}</p>
                  <p className="text-xs text-gray-500">
                    {entry.userName} • {new Date(entry.timestamp).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => onRollback(entry)}
                    className="w-full h-9 text-sm font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    title="Rollback to this version (current version will be saved as a checkpoint)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"></path>
                    </svg>
                    Rollback to this version
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4 text-sm">No history available</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-full h-10 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </Card>
    </div>
  );
};
