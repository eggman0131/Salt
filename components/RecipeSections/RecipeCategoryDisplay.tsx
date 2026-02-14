import React from 'react';
import { RecipeCategory } from '../../types/contract';

interface RecipeCategoryDisplayProps {
  categoryIds: string[];
  categories: RecipeCategory[];
  onRemove: (categoryId: string) => void;
  onAddClick: () => void;
}

export const RecipeCategoryDisplay: React.FC<RecipeCategoryDisplayProps> = ({
  categoryIds,
  categories,
  onRemove,
  onAddClick,
}) => {
  const getCategoryName = (categoryId: string): string => {
    return categories.find(c => c.id === categoryId)?.name || categoryId;
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {categoryIds.map(catId => (
        <div key={catId} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-100">
          <span>{getCategoryName(catId)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(catId);
            }}
            className="ml-1 hover:text-blue-900 transition-colors"
            title="Remove category"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
      ))}
      <button
        onClick={onAddClick}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
      >
        + Add Category
      </button>
    </div>
  );
};
