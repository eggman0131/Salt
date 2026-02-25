import React, { useState, useEffect } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import { recipesBackend } from '../backend';
import { kitchenDataBackend } from '../../kitchen-data';
import { Toaster } from '@/components/ui/sonner';
import { softToast } from '@/lib/soft-toast';
import { RecipesList } from './RecipesList';
import { RecipeDetailView } from './RecipeDetailView';
import { assistModeBackend } from '../../assist-mode';

export const RecipesModule: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assistGuideRecipeIds, setAssistGuideRecipeIds] = useState<Set<string>>(new Set());
  const [recipeIdToUploadImageFor, setRecipeIdToUploadImageFor] = useState<string | null>(null);

  // Load recipes and categories
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [recipesData, categoriesData, guidesData] = await Promise.all([
        recipesBackend.getRecipes(),
        kitchenDataBackend.getCategories(),
        assistModeBackend.getAllCookGuides(),
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

  const handleCreateRecipe = async (recipeData: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>) => {
    try {
      await recipesBackend.createRecipe(recipeData);
      softToast.success('Recipe created');
      await loadData();
    } catch (error) {
      console.error('Failed to create recipe:', error);
      softToast.error('Failed to create recipe');
      throw error;
    }
  };

  const handleUpdateRecipe = async (id: string, updates: Partial<Recipe>) => {
    try {
      await recipesBackend.updateRecipe(id, updates);
      softToast.success('Recipe updated');
      await loadData();
      
      // Update selected recipe if it's the one being edited
      if (selectedRecipe?.id === id) {
        const updated = await recipesBackend.getRecipe(id);
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
      await recipesBackend.deleteRecipe(id);
      softToast.success('Recipe deleted');
      
      // Close detail view if we deleted the selected recipe
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
    // Navigate to detail view and signal to open image editor
    setSelectedRecipe(recipe);
    setRecipeIdToUploadImageFor(recipe.id);
  };

  const handleRegenerateRecipeImage = async (recipe: Recipe) => {
    try {
      const imageData = await recipesBackend.generateRecipeImage(recipe.title, recipe.description);
      await recipesBackend.updateRecipe(recipe.id, {}, imageData);
      softToast.success('AI image generated');
      await loadData();
      
      // Update selected recipe if viewing details
      if (selectedRecipe?.id === recipe.id) {
        const updated = await recipesBackend.getRecipe(recipe.id);
        if (updated) setSelectedRecipe(updated);
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      softToast.error('Failed to generate image');
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
          autoOpenImageEditor={recipeIdToUploadImageFor === selectedRecipe.id}
          onImageEditorOpened={() => setRecipeIdToUploadImageFor(null)}
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
      />
      <Toaster position="top-right" />
    </>
  );
};
