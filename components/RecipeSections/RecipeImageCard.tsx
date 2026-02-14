import React from 'react';
import { Recipe } from '../../types/contract';

interface RecipeImageCardProps {
  recipe: Recipe;
  isRegeneratingImage: boolean;
  imageActionsVisible: boolean;
  onImageClick: () => void;
  onRegenerateImage: () => void;
  onEditImage: () => void;
  RemoteImage: React.FC<{ path?: string; className?: string; alt?: string }>;
}

export const RecipeImageCard: React.FC<RecipeImageCardProps> = ({
  recipe,
  isRegeneratingImage,
  imageActionsVisible,
  onImageClick,
  onRegenerateImage,
  onEditImage,
  RemoteImage,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div
        className="aspect-video bg-gray-100 relative group"
        onClick={onImageClick}
      >
        {recipe.imagePath ? (
          <RemoteImage path={recipe.imagePath} className="w-full h-full object-cover" alt={recipe.title} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs uppercase tracking-wide">No Image</div>
        )}

        <div
          className={`absolute inset-0 flex items-center justify-center gap-3 px-3 transition-opacity duration-200 ${imageActionsVisible ? 'opacity-100' : 'opacity-0'} md:opacity-0 md:group-hover:opacity-100`}
        >
          <button
            onClick={onRegenerateImage}
            disabled={isRegeneratingImage}
            className="px-3 py-2 bg-white/95 text-gray-900 text-xs font-semibold rounded-lg shadow-sm border border-white/70 hover:bg-white disabled:opacity-60"
          >
            {isRegeneratingImage ? 'Generating...' : 'Regenerate Image'}
          </button>
          <button
            onClick={onEditImage}
            className="px-3 py-2 bg-white/95 text-gray-900 text-xs font-semibold rounded-lg shadow-sm border border-white/70 hover:bg-white"
          >
            Upload & Crop
          </button>
        </div>
      </div>
    </div>
  );
};
