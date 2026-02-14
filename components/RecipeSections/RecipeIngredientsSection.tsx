import React from 'react';
import { Recipe } from '../../types/contract';

interface RecipeIngredientsSectionProps {
  recipe: Recipe;
  editedRecipe: Recipe | null;
  isEditing: boolean;
  onEditIngredient: (index: number, value: string) => void;
  onDeleteIngredient: (index: number) => void;
  onAddIngredient: () => void;
}

export const RecipeIngredientsSection: React.FC<RecipeIngredientsSectionProps> = ({
  recipe,
  editedRecipe,
  isEditing,
  onEditIngredient,
  onDeleteIngredient,
  onAddIngredient,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">Ingredients</h3>
      {isEditing && editedRecipe ? (
        <div className="space-y-2">
          {(editedRecipe.ingredients || []).map((ing, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={ing}
                onChange={(e) => onEditIngredient(i, e.target.value)}
                className="flex-1 text-base border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ingredient"
              />
              <button
                onClick={() => onDeleteIngredient(i)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors flex-shrink-0 -mr-1"
                title="Delete ingredient"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
          <button
            onClick={onAddIngredient}
            className="w-full h-9 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            + Add Ingredient
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {(recipe.ingredients || []).map((ing, i) => (
            <li key={i} className="flex items-start gap-3 text-base text-gray-700">
              <span className="mt-2 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
              {ing}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
