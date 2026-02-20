import React, { useState, useEffect } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Clock, ChefHat } from 'lucide-react';
import { recipesBackend } from '../backend';

interface RecipeCardProps {
  recipe: Recipe;
  categories: RecipeCategory[];
  onClick: () => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, categories, onClick }) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // Load image if exists
  useEffect(() => {
    if (recipe.imagePath) {
      setIsLoadingImage(true);
      recipesBackend.resolveImagePath(recipe.imagePath)
        .then(setImageSrc)
        .catch(() => setImageSrc(''))
        .finally(() => setIsLoadingImage(false));
    }
  }, [recipe.imagePath]);

  // Get category names for this recipe
  const recipeCategories = categories.filter(cat => 
    recipe.categoryIds?.includes(cat.id)
  );

  // Complexity badge color
  const complexityVariant = {
    Simple: 'secondary',
    Intermediate: 'outline',
    Advanced: 'destructive',
  }[recipe.complexity] as 'secondary' | 'outline' | 'destructive';

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
          ) : imageSrc ? (
            <img 
              src={imageSrc} 
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ChefHat className="w-12 h-12 text-muted-foreground/20" />
            </div>
          )}
        </div>
      )}

      <CardHeader className="pb-3 p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold line-clamp-2 flex-1">{recipe.title}</h3>
          <Badge variant={complexityVariant}>
            {recipe.complexity}
          </Badge>
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
