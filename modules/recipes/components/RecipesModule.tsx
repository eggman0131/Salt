import React, { useState } from 'react';
import { ErrorBoundary } from './UI';
import { RecipesList } from './RecipesList';
import { RecipeDetail } from './RecipeDetail';
import { Recipe, Equipment, User } from '../types/contract';

interface RecipesModuleProps {
  recipes: Recipe[];
  inventory: Equipment[];
  onRefresh: () => void;
  currentUser: User;
  onNewRecipe: () => void;
}

export const RecipesModule: React.FC<RecipesModuleProps> = ({ recipes, inventory, onRefresh, currentUser, onNewRecipe }) => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  if (selectedRecipe) {
    return (
      <ErrorBoundary>
        <RecipeDetail
          recipe={selectedRecipe}
          inventory={inventory}
          onClose={() => setSelectedRecipe(null)}
          onRefresh={onRefresh}
          currentUser={currentUser}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <RecipesList
        recipes={recipes}
        onSelectRecipe={setSelectedRecipe}
        onNewRecipe={onNewRecipe}
      />
    </ErrorBoundary>
  );
};
