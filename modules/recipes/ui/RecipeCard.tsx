import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Timer, Flame, Clock, Users } from 'lucide-react';
import type { Recipe } from '@/types/contract';
import { useRecipeImage } from '@/hooks/useRecipeImage';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  onRepair?: (recipe: Recipe) => void;
}

export function RecipeCard({ recipe, onClick, onRepair }: RecipeCardProps) {
  const { src: imageUrl, isLoading: imageLoading } = useRecipeImage(recipe.imagePath);

  const hasIssues =
    !recipe.title ||
    !recipe.description ||
    !recipe.ingredients ||
    recipe.ingredients.length === 0 ||
    !recipe.instructions ||
    recipe.instructions.length === 0;

  const formatTime = (time: string | number | undefined) => {
    if (!time) return null;
    if (typeof time === 'string') return time;
    if (time < 60) return `${time}m`;
    const hours = Math.floor(time / 60);
    const mins = time % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Card
      className="group relative overflow-hidden transition-all hover:shadow-md cursor-pointer"
      onClick={onClick}
    >
      {/* Image Section */}
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {imageLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={recipe.title || 'Recipe'}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
      </div>

      {/* Content Section */}
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Title and Issue Badge */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg line-clamp-2">
              {recipe.title || 'Untitled Recipe'}
            </h3>
            {hasIssues && (
              <Badge variant="destructive" className="shrink-0">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Issues
              </Badge>
            )}
          </div>

          {/* Description */}
          {recipe.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {recipe.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {recipe.prepTime && (
              <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{formatTime(recipe.prepTime)}</span>
            )}
            {recipe.cookTime && (
              <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{formatTime(recipe.cookTime)}</span>
            )}
            {recipe.totalTime && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(recipe.totalTime)}</span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{recipe.servings}</span>
            )}
            {recipe.complexity && (
              <Badge variant="outline" className="text-xs">
                {recipe.complexity}
              </Badge>
            )}
          </div>

          {/* Categories */}
          {recipe.categoryIds && recipe.categoryIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.categoryIds.slice(0, 3).map((categoryId) => (
                <Badge key={categoryId} variant="secondary" className="text-xs">
                  {categoryId}
                </Badge>
              ))}
              {recipe.categoryIds.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{recipe.categoryIds.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Repair Button */}
          {hasIssues && onRepair && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={(e) => {
                e.stopPropagation();
                onRepair(recipe);
              }}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Repair Recipe
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
