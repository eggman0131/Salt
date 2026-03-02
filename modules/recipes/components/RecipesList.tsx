import React, { useState, useMemo } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import type { RecipeSaveProgress } from '../backend/recipes-backend.interface';
import { Card } from '../../../components/ui/card';
import { AddButton } from '../../../components/ui/add-button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../components/ui/accordion';
import { Search } from 'lucide-react';
import { RecipeFormDialog } from './RecipeFormDialog';
import { RecipeCard } from './RecipeCard';
import { Stack } from '../../../shared/components/primitives';

interface RecipesListProps {
  recipes: Recipe[];
  categories: RecipeCategory[];
  assistGuideRecipeIds: Set<string>;
  isLoading: boolean;
  onSelectRecipe: (recipe: Recipe) => void;
  onCreateRecipe: (
    recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => Promise<void>;
  onUploadRecipeImage?: (recipe: Recipe) => void;
  onRegenerateRecipeImage?: (recipe: Recipe) => void;
  onRepairRecipe?: (recipe: Recipe) => void;
}

export const RecipesList: React.FC<RecipesListProps> = ({
  recipes,
  categories,
  assistGuideRecipeIds,
  isLoading,
  onSelectRecipe,
  onCreateRecipe,
  onUploadRecipeImage,
  onRegenerateRecipeImage,
  onRepairRecipe,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [assistOnly, setAssistOnly] = useState(false);

  // Filter recipes by search and category
  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        recipe.title.toLowerCase().includes(searchLower) ||
        recipe.description.toLowerCase().includes(searchLower);

      // Category filter - recipe must have ALL selected categories
      const matchesCategory = selectedCategoryIds.length === 0 ||
        selectedCategoryIds.every(catId => recipe.categoryIds?.includes(catId));

      const matchesAssist = !assistOnly || assistGuideRecipeIds.has(recipe.id);

      return matchesSearch && matchesCategory && matchesAssist;
    });
  }, [recipes, searchQuery, selectedCategoryIds, assistOnly, assistGuideRecipeIds]);

  // Get categories that appear in filtered recipes (or all categories if none selected)
  const availableCategories = useMemo(() => {
    // Get all category IDs from filtered recipes
    const categoryIdsInRecipes = new Set<string>();
    filteredRecipes.forEach(recipe => {
      recipe.categoryIds?.forEach(catId => categoryIdsInRecipes.add(catId));
    });

    // Return categories that appear in filtered recipes
    return categories.filter(cat => categoryIdsInRecipes.has(cat.id));
  }, [filteredRecipes, categories]);

  const handleCreateRecipe = async (
    recipeData: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => {
    await onCreateRecipe(recipeData, onProgress);
    setIsCreateDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Stack spacing="gap-6">
      {/* Search and Filters */}
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-lg font-semibold">Find Recipes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
            </p>
          </div>
          <AddButton onClick={() => setIsCreateDialogOpen(true)} label="Add" />
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Filter Accordion */}
        {availableCategories.length > 0 && (
            <Accordion 
              type="single" 
              collapsible
              value={filterOpen ? "filter" : ""}
              onValueChange={(val) => setFilterOpen(val === "filter")}
              defaultValue={typeof window !== 'undefined' && window.innerWidth >= 768 ? "filter" : ""}
              className="px-0"
            >
              <AccordionItem value="filter" className="border-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="font-medium">
                    Filter by Category {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={selectedCategoryIds.length === 0 ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedCategoryIds([])}
                    >
                      All
                    </Badge>
                    {assistGuideRecipeIds.size > 0 && (
                      <Badge
                        variant={assistOnly ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setAssistOnly(prev => !prev)}
                      >
                        Assist mode
                      </Badge>
                    )}
                    {availableCategories.map(category => (
                      <Badge
                        key={category.id}
                        variant={selectedCategoryIds.includes(category.id) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedCategoryIds(prev =>
                            prev.includes(category.id)
                              ? prev.filter(id => id !== category.id)
                              : [...prev, category.id]
                          );
                        }}
                      >
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
        )}
      </Card>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <Card className="p-12 border-dashed text-center">
          <div className="text-muted-foreground">
            {searchQuery || selectedCategoryIds.length > 0 ? (
              <>
                <p className="text-lg font-medium">No recipes found</p>
                <p className="mt-1">Try adjusting your filters</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No recipes yet</p>
                <p className="mt-1">Create your first recipe to get started</p>
                <AddButton
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="mt-4"
                  variant="outline"
                  label="Add"
                />
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              categories={categories}
              onClick={() => onSelectRecipe(recipe)}
              onUploadImage={() => onUploadRecipeImage?.(recipe)}
              onRegenerateImage={() => onRegenerateRecipeImage?.(recipe)}
              onRepair={() => onRepairRecipe?.(recipe)}
            />
          ))}
        </div>
      )}

      {/* Create Recipe Dialog */}
      <RecipeFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        categories={categories}
        onSubmit={handleCreateRecipe}
      />
    </Stack>
  );
};
