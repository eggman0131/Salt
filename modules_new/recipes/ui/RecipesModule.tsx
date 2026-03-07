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
} from '../api';
import type { RecipeSaveProgress } from '../types';
import { getCategories as getCategoriesApi } from '../../../modules_new/categories/api';
import { Toaster } from '../../../components/ui/sonner';
import { softToast } from '../../../lib/soft-toast';
import { RecipesList } from './RecipesList';
import { RecipeDetailView } from './RecipeDetailView';
import { RepairRecipeModal } from './RepairRecipeModal';
import { getAllCookGuides } from '../../../modules_new/assist-mode/api';

/**
 * Transitional Recipes tab implementation inside modules_new.
 *
 * Behaviour is intentionally unchanged. Child components are still sourced from
 * legacy module paths and will be moved in follow-up steps.
 */
export const RecipesModule: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assistGuideRecipeIds, setAssistGuideRecipeIds] = useState<Set<string>>(new Set());
  const [recipeIdToUploadImageFor, setRecipeIdToUploadImageFor] = useState<string | null>(null);
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

  const handleUploadRecipeImage = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setRecipeIdToUploadImageFor(recipe.id);
  };

  const handleRegenerateRecipeImage = async (recipe: Recipe) => {
    try {
      const imageData = await generateRecipeImage(recipe.title, recipe.description);
      await updateRecipe(recipe.id, {}, imageData);
      softToast.success('AI image generated');
      await loadData();

      if (selectedRecipe?.id === recipe.id) {
        const updated = await getRecipe(recipe.id);
        if (updated) setSelectedRecipe(updated);
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      softToast.error('Failed to generate image');
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
      <>
        <RecipeDetailView
          recipe={selectedRecipe}
          categories={categories}
          onClose={() => {
            setSelectedRecipe(null);
            setRecipeIdToUploadImageFor(null);
          }}
          onUpdate={handleUpdateRecipe}
          onDelete={handleDeleteRecipe}
          onRepair={handleOpenRepairModal}
          autoOpenImageEditor={recipeIdToUploadImageFor === selectedRecipe.id}
          onImageEditorOpened={() => setRecipeIdToUploadImageFor(null)}
        />
        <RepairRecipeModal
          open={!!recipeToRepair}
          onOpenChange={(open) => !open && setRecipeToRepair(null)}
          onRepair={handleRepairRecipe}
          isRepairing={isRepairing}
          progress={repairProgress}
        />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <>
      <RecipesList
        recipes={recipes}
        categories={categories}
        assistGuideRecipeIds={assistGuideRecipeIds}
        isLoading={isLoading}
        onSelectRecipe={setSelectedRecipe}
        onCreateRecipe={handleCreateRecipe}
        onUploadRecipeImage={handleUploadRecipeImage}
        onRegenerateRecipeImage={handleRegenerateRecipeImage}
        onRepairRecipe={handleOpenRepairModal}
      />
      <RepairRecipeModal
        open={!!recipeToRepair}
        onOpenChange={(open) => !open && setRecipeToRepair(null)}
        onRepair={handleRepairRecipe}
        isRepairing={isRepairing}
        progress={repairProgress}
      />
      <Toaster position="top-right" />
    </>
  );
};
