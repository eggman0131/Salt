import React, { useState } from 'react';

interface ImportMFPRecipeModalProps {
  onSubmit: (title: string, servings: string, ingredients: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ImportMFPRecipeModal: React.FC<ImportMFPRecipeModalProps> = ({ 
  onSubmit, 
  onCancel, 
  isLoading = false 
}) => {
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !servings.trim() || !ingredients.trim()) {
      alert('Please fill in all fields.');
      return;
    }
    onSubmit(title, servings, ingredients);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 z-[400] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Import Recipe</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title Field */}
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
              Recipe Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chicken Stir Fry"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          {/* Servings Field */}
          <div>
            <label htmlFor="servings" className="block text-sm font-semibold text-gray-700 mb-2">
              Number of Servings
            </label>
            <input
              id="servings"
              type="text"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="e.g., 4 or 4 people"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          {/* Ingredients Field */}
          <div>
            <label htmlFor="ingredients" className="block text-sm font-semibold text-gray-700 mb-2">
              Ingredients
            </label>
            <textarea
              id="ingredients"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Paste ingredients here, one per line&#10;e.g.:&#10;2 chicken breasts&#10;200g broccoli&#10;3 cloves garlic"
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  Processing...
                </>
              ) : (
                'Create Recipe'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
