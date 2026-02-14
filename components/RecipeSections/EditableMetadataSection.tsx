import React from 'react';
import { Recipe } from '../../types/contract';

interface EditableMetadataSectionProps {
  editedRecipe: Recipe;
  onMetadataChange: (field: 'prepTime' | 'cookTime' | 'totalTime' | 'servings' | 'complexity', value: string) => void;
}

export const EditableMetadataSection: React.FC<EditableMetadataSectionProps> = ({
  editedRecipe,
  onMetadataChange,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">Recipe Metadata</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Complexity */}
        <div className="flex flex-col gap-2">
          <label htmlFor="complexity" className="text-sm font-semibold text-gray-700">
            Complexity
          </label>
          <select
            id="complexity"
            value={editedRecipe.complexity}
            onChange={(e) => onMetadataChange('complexity', e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="Simple">Simple</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        {/* Prep Time */}
        <div className="flex flex-col gap-2">
          <label htmlFor="prepTime" className="text-sm font-semibold text-gray-700">
            Prep Time
          </label>
          <input
            id="prepTime"
            type="text"
            value={editedRecipe.prepTime}
            onChange={(e) => onMetadataChange('prepTime', e.target.value)}
            placeholder="e.g., 15 mins"
            className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Cook Time */}
        <div className="flex flex-col gap-2">
          <label htmlFor="cookTime" className="text-sm font-semibold text-gray-700">
            Cook Time
          </label>
          <input
            id="cookTime"
            type="text"
            value={editedRecipe.cookTime}
            onChange={(e) => onMetadataChange('cookTime', e.target.value)}
            placeholder="e.g., 30 mins"
            className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Total Time */}
        <div className="flex flex-col gap-2">
          <label htmlFor="totalTime" className="text-sm font-semibold text-gray-700">
            Total Time
          </label>
          <input
            id="totalTime"
            type="text"
            value={editedRecipe.totalTime}
            onChange={(e) => onMetadataChange('totalTime', e.target.value)}
            placeholder="e.g., 45 mins"
            className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Servings */}
        <div className="flex flex-col gap-2 col-span-2">
          <label htmlFor="servings" className="text-sm font-semibold text-gray-700">
            Servings
          </label>
          <input
            id="servings"
            type="text"
            value={editedRecipe.servings}
            onChange={(e) => onMetadataChange('servings', e.target.value)}
            placeholder="e.g., 4 servings"
            className="w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
};
