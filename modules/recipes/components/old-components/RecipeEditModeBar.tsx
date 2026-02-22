import React from 'react';

interface RecipeEditModeBarProps {
  isUpdating: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export const RecipeEditModeBar: React.FC<RecipeEditModeBarProps> = ({
  isUpdating,
  onSave,
  onCancel,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 md:left-auto md:right-auto md:w-full md:max-w-6xl bg-white border-t border-gray-200 shadow-lg p-4 flex gap-2 z-40 md:rounded-b-none"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <button
        onClick={onSave}
        disabled={isUpdating}
        className="flex-1 h-11 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors"
      >
        {isUpdating ? 'Saving...' : 'Save Changes'}
      </button>
      <button
        onClick={onCancel}
        disabled={isUpdating}
        className="flex-1 h-11 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300 disabled:opacity-50 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
};
