import React, { useState } from 'react';
import { Card, Button } from './UI';
import { Badge } from './ui/badge';
import { Utensils, ChefHat, BookOpen, ArrowRight } from 'lucide-react';
import { User, Recipe, Plan } from '@/types/contract';
import { cn } from '@/lib/utils';

interface DashboardProps {
  user: User;
  todaysMeal: { date: string; cookId: string | null; presentIds: string[]; mealNotes: string } | undefined;
  currentPlan: Plan | null;
  nextPlan: Plan | null;
  allUsers: User[];
  recipes: Recipe[];
  equipmentCount: number;
  shoppingListsCount: number;
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
export const Dashboard: React.FC<DashboardProps> = ({
  user,
  todaysMeal,
  currentPlan,
  nextPlan,
  allUsers,
  recipes,
  equipmentCount,
  shoppingListsCount,
  onTabChange,
  onShowImportModal,
}) => {
  const [viewWeek, setViewWeek] = useState<'current' | 'next'>('current');
  const activePlan = viewWeek === 'current' ? currentPlan : nextPlan;

  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();
  const recentRecipes = recipes.slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

      {/* Section: Today's Meal */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Tonight's Service</h2>
        
        {todaysMeal ? (
          <Card
            className="p-6 cursor-pointer transition-all duration-200 hover:shadow-lg"
            onClick={() => onTabChange('planner')}
          >
            <div className="space-y-4">
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
                    <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm shadow-sm">
                      {allUsers.find(u => u.id === todaysMeal.cookId)?.displayName?.[0] || '?'}
                    </div>
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
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="text-center space-y-3">
              <Utensils className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-sm text-muted-foreground">No meal planned for today</p>
              <Button
                size="sm"
                onClick={() => onTabChange('planner')}
              >
                Plan Today's Meal
              </Button>
            </div>
          </Card>
        )}
      </section>

      {/* Section: Weekly Planner */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">This Week's Menu</h2>
          <button
            onClick={() => setViewWeek(viewWeek === 'current' ? 'next' : 'current')}
            className="text-sm font-medium text-primary hover:underline transition-all"
          >
            {viewWeek === 'current' ? 'Next week' : 'This week'}
          </button>
        </div>

        {activePlan ? (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {activePlan.days.map((day) => {
                const isToday = day.date === todayStr;
                const dayNum = parseInt(day.date.split('-')[2], 10);
                const dayName = new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' });

                return (
                  <div
                    key={day.date}
                    className={cn(
                      'p-4 transition-all',
                      isToday ? 'bg-primary/5' : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Date */}
                      <div className="min-w-fit">
                        <p className="text-xs text-muted-foreground font-medium uppercase">{dayName}</p>
                        <p className="text-lg font-semibold">{dayNum}</p>
                      </div>

                      {/* Meal & Cook */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{day.mealNotes || 'TBC'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {allUsers.find(u => u.id === day.cookId)?.displayName || 'Unassigned'}
                        </p>
                      </div>

                      {/* Today indicator */}
                      {isToday && (
                        <Badge variant="default" className="shrink-0">Live</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="text-center space-y-3">
              <Utensils className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-sm text-muted-foreground">No plan created yet</p>
              <Button
                size="sm"
                onClick={() => onTabChange('planner')}
              >
                Create Weekly Plan
              </Button>
            </div>
          </Card>
        )}
      </section>

      {/* Section: Quick Actions */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Quick Actions</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Import Recipe */}
          <button
            onClick={onShowImportModal}
            className="text-left transition-all duration-200 hover:shadow-md"
          >
            <Card className="p-4 h-full hover:bg-muted/50">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Import Recipe</p>
                <p className="text-xs text-muted-foreground">From MyFitnessPal or URL</p>
              </div>
            </Card>
          </button>

          {/* Ask Chef */}
          <button
            onClick={() => onTabChange('ai')}
            className="text-left transition-all duration-200 hover:shadow-md"
          >
            <Card className="p-4 h-full hover:bg-muted/50">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Ask the Chef</p>
                <p className="text-xs text-muted-foreground">Generate a recipe idea</p>
              </div>
            </Card>
          </button>
        </div>
      </section>

      {/* Section: Recent Recipes */}
      {recentRecipes.length > 0 && (
        <section className="space-y-4">
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
                    <div className="w-full h-32 bg-muted overflow-hidden border-b border-border">
                      <img
                        src={recipe.imagePath}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-medium text-sm line-clamp-2">{recipe.title}</h3>
                    
                    {/* Metadata */}
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {recipe.prepTime && <span>{recipe.prepTime}</span>}
                      {recipe.servings && <span>•</span>}
                      {recipe.servings && <span>{recipe.servings}</span>}
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Section: Kitchen Overview */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Kitchen Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          {/* Shopping Lists */}
          <button
            onClick={() => onTabChange('shopping')}
            className="transition-all duration-200 hover:shadow-md"
          >
            <Card className="p-6 text-center h-full hover:bg-muted/50">
              <p className="text-3xl font-bold text-foreground mb-2">{shoppingListsCount}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Lists</p>
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
      </section>

    </div>
  );
};
