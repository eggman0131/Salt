import React, { useState, useEffect } from 'react';
import { Stack, Section } from '@/shared/components/primitives';
import { Card } from '@/components/ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChefHat, BookOpen, ArrowRight } from 'lucide-react';
import { User, Recipe, Plan, DayPlan } from '@/types/contract';
import { cn } from '@/lib/utils';
import { resolveImagePath } from '@/modules/recipes';

interface DashboardProps {
  user: User;
  todaysMeal: DayPlan | undefined;
  currentPlan: Plan | null;
  nextPlan: Plan | null;
  allUsers: User[];
  recipes: Recipe[];
  equipmentCount: number;
  onTabChange: (tabId: string) => void;
  onShowImportModal: () => void;
}

/**
 * Dashboard - Clean, card-based kitchen overview following the design system.
 * 
 * Uses:
 * - Design tokens (semantic colours, spacing, typography)
 * - Layout primitives (Page, Section, Stack patterns)
 * - shadcn/ui components (Card, Button, Badge)
 * - Mobile-first responsive design (sm:, md:, lg: prefixes)
 * - Token-based spacing (space-y-6, gap-4, p-6, etc.)
 */

/**
 * RecipeImage - Helper component to resolve and display recipe images
 * Validates image exists via fetch before setting img src to avoid 404 console errors
 */
const RecipeImage: React.FC<{ imagePath: string; title: string }> = ({ imagePath, title }) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setImageSrc('');

    resolveImagePath(imagePath)
      .then(async (url) => {
        if (!url) {
          setImageSrc('');
          return;
        }

        // Validate the image exists without logging errors to console
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            setImageSrc(url);
          }
        } catch {
          // Image doesn't exist, stay silent
        }
      })
      .catch(() => setImageSrc(''))
      .finally(() => setIsLoading(false));
  }, [imagePath]);

  if (isLoading) {
    return (
      <div className="w-full h-32 bg-muted flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!imageSrc) {
    return null;
  }

  return (
    <div className="w-full h-32 bg-muted overflow-hidden border-b border-border">
      <img
        src={imageSrc}
        alt={title}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  todaysMeal,
  currentPlan,
  nextPlan,
  allUsers,
  recipes,
  equipmentCount,
  onTabChange,
  onShowImportModal,
}) => {
  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();
  const recentRecipes = recipes.slice(0, 3);

  return (
    <Stack spacing="gap-6">
      {/* Section: Today's Meal */}
      <Section>
        <Stack spacing="gap-4">
          <h2 className="text-lg font-semibold">Tonight's Service</h2>
        
        {todaysMeal ? (
          <Card
            className="p-6 cursor-pointer transition-all duration-200 hover:shadow-lg"
            onClick={() => onTabChange('planner')}
          >
            <Stack spacing="gap-4">
              {/* Meal Name */}
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Meal</p>
                <h3 className="text-2xl font-semibold">{todaysMeal.mealNotes || "Chef's Choice"}</h3>
              </div>

              {/* Cook & Guests Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cook */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Head Chef</p>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {allUsers.find(u => u.id === todaysMeal.cookId)?.avatarUrl && (
                        <AvatarImage src={allUsers.find(u => u.id === todaysMeal.cookId)?.avatarUrl} alt={allUsers.find(u => u.id === todaysMeal.cookId)?.displayName} />
                      )}
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                        {allUsers.find(u => u.id === todaysMeal.cookId)?.displayName?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">
                      {allUsers.find(u => u.id === todaysMeal.cookId)?.displayName || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Guests Count */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Guests</p>
                  <p className="text-sm font-medium">
                    {todaysMeal.presentIds.length} person{todaysMeal.presentIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Guest List */}
              {todaysMeal.presentIds.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <div className="flex flex-wrap gap-2">
                    {todaysMeal.presentIds.map((userId) => {
                      const guest = allUsers.find(u => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary">
                          {guest?.displayName || 'Unknown'}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </Stack>
          </Card>
        ) : (
          <Card className="p-6">
            <Stack spacing="gap-3" className="text-center">
              <p className="text-sm text-muted-foreground">No meal planned for today</p>
              <Button
                onClick={() => onTabChange('planner')}
              >
                Plan Today's Meal
              </Button>
            </Stack>
          </Card>
        )}
        </Stack>
      </Section>

      {/* Section: Quick Actions */}
      <Section>
        <Stack spacing="gap-4">
          <h2 className="text-lg font-semibold">Quick Actions</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Import Recipe */}
          <button
            onClick={onShowImportModal}
            className="text-left transition-all duration-200 hover:shadow-md"
          >
            <Card className="p-4 h-full hover:bg-muted/50">
              <Stack spacing="gap-2">
                <p className="text-sm font-semibold">Import Recipe</p>
                <p className="text-xs text-muted-foreground">From MyFitnessPal or URL</p>
              </Stack>
            </Card>
          </button>

          {/* Ask Chef */}
          <button
            onClick={() => onTabChange('ai')}
            className="text-left transition-all duration-200 hover:shadow-md"
          >
            <Card className="p-4 h-full hover:bg-muted/50">
              <Stack spacing="gap-2">
                <p className="text-sm font-semibold">Ask the Chef</p>
                <p className="text-xs text-muted-foreground">Generate a recipe idea</p>
              </Stack>
            </Card>
          </button>
        </div>
        </Stack>
      </Section>

      {/* Section: Recent Recipes */}
      {recentRecipes.length > 0 && (
        <Section>
          <Stack spacing="gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Recipes</h2>
            <button
              onClick={() => onTabChange('recipes')}
              className="text-sm font-medium text-primary hover:underline transition-all flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {recentRecipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => onTabChange('recipes')}
                className="text-left transition-all duration-200 hover:shadow-md"
              >
                <Card className="overflow-hidden h-full hover:bg-muted/50">
                  {/* Image */}
                  {recipe.imagePath && (
                    <RecipeImage imagePath={recipe.imagePath} title={recipe.title} />
                  )}

                  {/* Content */}
                  <div className="p-4">
                    <Stack spacing="gap-2">
                      <h3 className="font-medium text-sm line-clamp-2">{recipe.title}</h3>
                    
                    {/* Metadata */}
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {recipe.prepTime && <span>{recipe.prepTime}</span>}
                        {recipe.servings && <span>•</span>}
                        {recipe.servings && <span>{recipe.servings}</span>}
                      </div>
                    </Stack>
                  </div>
                </Card>
              </button>
            ))}
          </div>
          </Stack>
        </Section>
      )}

      {/* Section: Kitchen Overview */}
      <Section>
        <Stack spacing="gap-4">
        <h2 className="text-lg font-semibold">Kitchen Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Equipment */}
          <button
            onClick={() => onTabChange('inventory')}
            className="transition-all duration-200 hover:shadow-md"
          >
            <Card className="p-6 text-center h-full hover:bg-muted/50">
              <p className="text-3xl font-bold text-foreground mb-2">{equipmentCount}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Equipment</p>
            </Card>
          </button>

          {/* Recipes */}
          <button
            onClick={() => onTabChange('recipes')}
            className="transition-all duration-200 hover:shadow-md"
          >
            <Card className="p-6 text-center h-full hover:bg-muted/50">
              <p className="text-3xl font-bold text-foreground mb-2">{recipes.length}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Recipes</p>
            </Card>
          </button>
        </div>
        </Stack>
      </Section>

    </Stack>
  );
};
