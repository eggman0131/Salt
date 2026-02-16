import React from 'react';
import { Card } from '../../../components/UI';
import { RecipeCategory } from '../../types/contract';

interface CategoryPickerModalProps {
  categories: RecipeCategory[];
  selectedCategoryIds: string[];
  onAdd: (categoryId: string) => void;
  onClose: () => void;
}

export const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  categories,
  selectedCategoryIds,
  onAdd,
  onClose,
}) => {
  const availableCategories = categories.filter(cat => !selectedCategoryIds.includes(cat.id));

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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Add Categories</h3>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Close category picker"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-[320px] overflow-y-auto">
            {availableCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => onAdd(cat.id)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm bg-blue-50 text-blue-700 font-semibold border border-blue-100 hover:bg-blue-100 transition-colors"
              >
                {cat.name}
              </button>
            ))}
            {availableCategories.length === 0 && (
              <p className="text-sm text-gray-500">All categories already added.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
