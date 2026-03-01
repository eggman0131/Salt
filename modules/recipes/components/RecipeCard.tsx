import React, { useState, useEffect } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Clock, ChefHat, Upload, RefreshCw, Wrench, AlertTriangle } from 'lucide-react';
import { useRecipeImage } from '../../../hooks/useRecipeImage';

interface RecipeCardProps {
  recipe: Recipe;
  categories: RecipeCategory[];
  onClick: () => void;
  onUploadImage?: () => void;
  onRegenerateImage?: () => void;
  onRepair?: () => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, categories, onClick, onUploadImage, onRegenerateImage, onRepair }) => {
  const { src: imageSrc, isLoading: isLoadingImage } = useRecipeImage(recipe.imagePath);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  // Reset error state when image src changes
  useEffect(() => {
    setHasImageError(false);
  }, [imageSrc]);

  // Get category names for this recipe
  const recipeCategories = categories.filter(cat => 
    recipe.categoryIds?.includes(cat.id)
  );

  // Check for unlinked ingredients
  const unlinkedIngredientCount = recipe.ingredients?.reduce((count, ing) => {
    return count + (ing.canonicalItemId ? 0 : 1);
  }, 0) || 0;
  const hasUnlinkedItems = unlinkedIngredientCount > 0;

  // Complexity badge color
  const complexityVariant = {
    Simple: 'secondary',
    Intermediate: 'outline',
    Advanced: 'destructive',
  }[recipe.complexity] as 'secondary' | 'outline' | 'destructive';

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUploadImage?.();
  };

  const handleRegenerateClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRegenerating(true);
    try {
      await onRegenerateImage?.();
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleImageError = (e: React.SyntheticEvent) => {
    e.currentTarget.style.display = 'none';
    setHasImageError(true);
  };

  const handleRepairClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRepair?.();
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow group"
      onClick={onClick}
    >
      {/* Image */}
      {recipe.imagePath && (
        <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
          {isLoadingImage ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : imageSrc && !hasImageError ? (
            <img 
              src={imageSrc} 
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={handleImageError}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ChefHat className="w-12 h-12 text-muted-foreground/20" />
            </div>
          )}
          {/* Image control buttons overlay */}
          {(onUploadImage || onRegenerateImage) && (
            <div className="absolute top-3 right-3 flex gap-2 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {onUploadImage && (
                <Button
                  size="icon"
                  className="bg-white/50 hover:bg-white/70 text-black"
                  onClick={handleUploadClick}
                  title="Upload image"
                >
                  <Upload className="w-4 h-4" />
                </Button>
              )}
              {onRegenerateImage && (
                <Button
                  size="icon"
                  className="bg-white/50 hover:bg-white/70 text-black"
                  onClick={handleRegenerateClick}
                  disabled={isRegenerating}
                  title="Generate AI image"
                >
                  <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <CardHeader className="pb-3 p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold line-clamp-2 flex-1">{recipe.title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {hasUnlinkedItems && (
              <div 
                className="text-amber-600 dark:text-amber-400" 
                title={`${unlinkedIngredientCount} unlinked ingredient${unlinkedIngredientCount === 1 ? '' : 's'}`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            {onRepair && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={handleRepairClick}
                title="Repair recipe"
              >
                <Wrench className="w-4 h-4" />
              </Button>
            )}
            <Badge variant={complexityVariant}>
              {recipe.complexity}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 md:p-6 pt-0 md:pt-0">
        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {recipe.description}
        </p>

        {/* Time and Servings */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{recipe.totalTime}</span>
          </div>
          {recipe.servings && (
            <span>• {recipe.servings}</span>
          )}
        </div>

        {/* Categories */}
        {recipeCategories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipeCategories.map(cat => (
              <Badge key={cat.id} variant="outline" className="text-xs">
                {cat.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
