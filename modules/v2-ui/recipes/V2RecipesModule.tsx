import React, { useEffect, useState } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import {
  createRecipe,
  deleteRecipe,
  generateRecipeImage,
  getRecipe,
  getRecipes,
  repairRecipe,
  updateRecipe,
} from '../../recipes/api';
import type { RecipeSaveProgress } from '../../recipes/types';
import { getCategories as getCategoriesApi } from '../../categories/api';
import { softToast } from '@/lib/soft-toast';
import { getAllCookGuides } from '../../assist-mode/api';

import { V2RecipesList } from './V2RecipesList';

/* V2 Detail Views */
import { V2RecipeDetailView } from './V2RecipeDetailView';

/* Legacy Components used as temporary bridge */
import { RepairRecipeModal } from '../../recipes/ui/RepairRecipeModal';

interface V2RecipesModuleProps {
  onNavigateToChef?: () => void;
}

export const V2RecipesModule: React.FC<V2RecipesModuleProps> = ({ onNavigateToChef }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assistGuideRecipeIds, setAssistGuideRecipeIds] = useState<Set<string>>(new Set());
  
  // Image Generation State
  const [recipeIdToUploadImageFor, setRecipeIdToUploadImageFor] = useState<string | null>(null);
  
  // Repair State
  const [recipeToRepair, setRecipeToRepair] = useState<Recipe | null>(null);
  const [repairProgress, setRepairProgress] = useState<{ stage: string; percentage: number } | undefined>();
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [recipesData, categoriesData, guidesData] = await Promise.all([
        getRecipes(),
        getCategoriesApi(),
        getAllCookGuides(),
      ]);
      setRecipes(recipesData);
      setCategories(categoriesData.filter(c => c.isApproved));
      setAssistGuideRecipeIds(new Set(guidesData.map(guide => guide.recipeId)));
    } catch (error) {
      console.error('Failed to load recipes:', error);
      softToast.error('Failed to load recipes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRecipe = async (
    recipeData: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => {
    try {
      await createRecipe(recipeData, undefined, onProgress);
      softToast.success('Recipe created');
      await loadData();
    } catch (error) {
      console.error('Failed to create recipe:', error);
      softToast.error('Failed to create recipe');
      throw error;
    }
  };

  const handleUpdateRecipe = async (
    id: string,
    updates: Partial<Recipe>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => {
    try {
      await updateRecipe(id, updates, undefined, onProgress);
      softToast.success('Recipe updated');
      await loadData();

      if (selectedRecipe?.id === id) {
        const updated = await getRecipe(id);
        if (updated) setSelectedRecipe(updated);
      }
    } catch (error) {
      console.error('Failed to update recipe:', error);
      softToast.error('Failed to update recipe');
      throw error;
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    try {
      
      await deleteRecipe(id);
      softToast.success('Recipe deleted');

      if (selectedRecipe?.id === id) {
        setSelectedRecipe(null);
      }

      await loadData();
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      softToast.error('Failed to delete recipe');
      throw error;
    }
  };

  const handleOpenRepairModal = (recipe: Recipe) => {
    setRecipeToRepair(recipe);
  };

  const handleRepairRecipe = async (options: { categorize: boolean; relinkIngredients: boolean }) => {
    if (!recipeToRepair) return;

    setIsRepairing(true);
    setRepairProgress(undefined);
    try {
      await repairRecipe(
        recipeToRepair.id,
        options,
        (progressData) => {
          setRepairProgress({
            stage: progressData.stage,
            percentage: progressData.percentage,
          });
        }
      );

      const actions: string[] = [];
      if (options.categorize) actions.push('re-categorized');
      if (options.relinkIngredients) actions.push('relinked ingredients');

      softToast.success(`Recipe ${actions.join(' and ')}`);
      await loadData();

      if (selectedRecipe?.id === recipeToRepair.id) {
        const updated = await getRecipe(recipeToRepair.id);
        if (updated) setSelectedRecipe(updated);
      }

      setRecipeToRepair(null);
      setRepairProgress(undefined);
    } catch (error) {
      console.error('Failed to repair recipe:', error);
      softToast.error('Failed to repair recipe');
    } finally {
      setIsRepairing(false);
      setRepairProgress(undefined);
    }
  };

  if (selectedRecipe) {
    return (
      <div className="h-full w-full bg-[var(--color-v2-background)] relative z-50">
        <V2RecipeDetailView
          recipe={selectedRecipe}
          categories={categories}
          onClose={() => {
            setSelectedRecipe(null);
            setRecipeIdToUploadImageFor(null);
          }}
          onUpdate={handleUpdateRecipe}
          onDelete={handleDeleteRecipe}
          onRepair={handleOpenRepairModal}
        />
        <RepairRecipeModal
          open={!!recipeToRepair}
          onOpenChange={(open) => !open && setRecipeToRepair(null)}
          onRepair={handleRepairRecipe}
          isRepairing={isRepairing}
          progress={repairProgress}
        />
      </div>
    );
  }

  return (
    <>
      <V2RecipesList
        recipes={recipes}
        categories={categories}
        assistGuideRecipeIds={assistGuideRecipeIds}
        isLoading={isLoading}
        onSelectRecipe={setSelectedRecipe}
        onCreateRecipe={handleCreateRecipe}
        onRepairRecipe={handleOpenRepairModal}
        onNavigateToChef={onNavigateToChef}
      />
      <RepairRecipeModal
        open={!!recipeToRepair}
        onOpenChange={(open) => !open && setRecipeToRepair(null)}
        onRepair={handleRepairRecipe}
        isRepairing={isRepairing}
        progress={repairProgress}
      />
    </>
  );
};
