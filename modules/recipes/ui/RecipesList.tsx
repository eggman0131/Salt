import React, { useState, useMemo } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import type { RecipeSaveProgress } from '../types';
import { Card } from '../../../components/ui/card';
import { AddButton } from '../../../components/ui/add-button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../components/ui/accordion';
import { Search, Tags } from 'lucide-react';
import { RecipeFormDialog } from './RecipeFormDialog';
import { RecipeCard } from './RecipeCard';
import { Stack } from '../../../shared/components/primitives';
import { Button } from '../../../components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet';
import { CategoriesManagement } from '../../../modules/categories/ui/CategoriesManagement';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Plus, Wand2, Link, PenTool, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { importRecipeFromUrl, generateRecipeImage } from '../api';
import { softToast } from '../../../lib/soft-toast';

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
  onRepairRecipe?: (recipe: Recipe) => void;
  onNavigateToChef?: () => void;
}

export const RecipesList: React.FC<RecipesListProps> = ({
  recipes,
  categories,
  assistGuideRecipeIds,
  isLoading,
  onSelectRecipe,
  onCreateRecipe,
  onRepairRecipe,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
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

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url || isImporting) return;

    setIsImporting(true);
    try {
      const importedRecipe = await importRecipeFromUrl(url);
      const imageData = await generateRecipeImage(
        importedRecipe.title || 'Dish',
        importedRecipe.description
      );

      await onCreateRecipe({
        ...importedRecipe,
        ingredients: importedRecipe.ingredients || [],
        instructions: importedRecipe.instructions || [],
        equipmentNeeded: importedRecipe.equipmentNeeded || [],
        title: importedRecipe.title || 'Imported Recipe',
        description: importedRecipe.description || 'Imported from external source.',
        prepTime: importedRecipe.prepTime || '---',
        cookTime: importedRecipe.cookTime || '---',
        totalTime: importedRecipe.totalTime || '---',
        servings: importedRecipe.servings || '---',
        complexity: (importedRecipe.complexity as any) || 'Intermediate',
      } as any);

      softToast.success('Recipe imported', { description: importedRecipe.title });
      setIsImportDialogOpen(false);
      setImportUrl('');
    } catch (err) {
      console.error('Import error:', err);
      softToast.error('Import failed', { description: 'Check the URL and try again' });
    } finally {
      setIsImporting(false);
    }
  };

  const AddRecipeMenu = ({ className }: { className?: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={className}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onNavigateToChef?.()} className="cursor-pointer py-3">
          <Wand2 className="h-4 w-4 mr-3 text-primary" />
          <div className="flex flex-col">
            <span className="font-medium">Ask the Chef (AI)</span>
            <span className="text-[10px] text-muted-foreground">Describe what you want</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)} className="cursor-pointer py-3">
          <Link className="h-4 w-4 mr-3" />
          <div className="flex flex-col">
            <span className="font-medium">Import from URL</span>
             <span className="text-[10px] text-muted-foreground">Extract from any website</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)} className="cursor-pointer py-2">
          <PenTool className="h-4 w-4 mr-3" />
          <span>Manual Entry</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCategoriesOpen(true)}
              className="gap-1.5"
            >
              <Tags className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </Button>
            <AddRecipeMenu />
          </div>
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
                <div className="flex justify-center mt-4">
                  <AddRecipeMenu />
                </div>
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

      {/* Categories Management Sheet */}
      <Sheet open={isCategoriesOpen} onOpenChange={setIsCategoriesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Manage Categories</SheetTitle>
          </SheetHeader>
          <CategoriesManagement />
        </SheetContent>
      </Sheet>

      {/* Import URL Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Recipe from URL</DialogTitle>
            <DialogDescription>
              Enter the web address of a recipe to import it into Salt
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-url">Recipe URL</Label>
              <Input
                id="import-url"
                placeholder="https://example.com/recipe"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && importUrl.trim()) {
                    void handleImport();
                  }
                }}
                disabled={isImporting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleImport()}
              disabled={!importUrl.trim() || isImporting}
            >
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isImporting ? 'Importing...' : 'Import Recipe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stack>
  );
};
