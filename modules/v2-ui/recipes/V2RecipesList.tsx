import React, { useState, useMemo } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import type { RecipeSaveProgress } from '../../recipes/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { Badge } from '../design-system/components/Badge';
import { ScrollArea } from '../design-system/components/ScrollArea';
import { ViewToolbar, SortOption, FilterOption } from '../design-system/components/ViewToolbar';
import { Plus, Wand2, Link, PenTool, Loader2, UtensilsCrossed, Clock } from 'lucide-react';

/* Legacy Dialogs to be restyled later */
import { RecipeFormDialog } from '../../recipes/ui/RecipeFormDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { importRecipeFromUrl, generateRecipeImage, resolveImagePath } from '../../recipes/api';
import { softToast } from '@/lib/soft-toast';

interface V2RecipesListProps {
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

const formatTime = (timeStr: string) => {
  if (!timeStr) return 'N/A';
  return timeStr.replace(/\bhours?\b/gi, 'hrs').replace(/\bminutes?\b/gi, 'mins');
};

export const V2RecipesList: React.FC<V2RecipesListProps> = ({
  recipes,
  categories,
  assistGuideRecipeIds,
  isLoading,
  onSelectRecipe,
  onCreateRecipe,
  onNavigateToChef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('name-asc');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  
  // Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Configure Toolbar
  const sortOptions: SortOption[] = [
    { id: 'name-asc', label: 'Name (A-Z)' },
    { id: 'name-desc', label: 'Name (Z-A)' },
    { id: 'time-asc', label: 'Prep Time (Low to High)' },
    { id: 'time-desc', label: 'Prep Time (High to Low)' },
  ];

  // Map categories into filter options
  const categoryFilters: FilterOption[] = categories.map(cat => ({
    id: `cat-${cat.id}`,
    label: cat.name
  }));

  const flatFilterOptions: FilterOption[] = [
    { id: 'assist-only', label: 'Assist Mode Ready' },
    ...categoryFilters
  ];

  // Derive final filtered/sorted recipes
  const processedRecipes = useMemo(() => {
    let result = [...recipes];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q)
      );
    }

    // 2. Filters
    if (activeFilters.length > 0) {
      result = result.filter(item => {
        return activeFilters.every((filterId: string) => {
          if (filterId === 'assist-only') return assistGuideRecipeIds.has(item.id);
          if (filterId.startsWith('cat-')) {
            const catId = filterId.replace('cat-', '');
            return item.categoryIds?.includes(catId);
          }
          return true;
        });
      });
    }

    // 3. Sorting
    result.sort((a, b) => {
      switch (activeSort) {
        case 'name-asc':
          return a.title.localeCompare(b.title);
        case 'name-desc':
          return b.title.localeCompare(a.title);
        case 'time-asc':
          // Extremely basic sort. Production needs number parser.
          return (a.totalTime || '').localeCompare(b.totalTime || '');
        case 'time-desc':
          return (b.totalTime || '').localeCompare(a.totalTime || '');
        default:
          return 0;
      }
    });

    return result;
  }, [recipes, searchQuery, activeSort, activeFilters, assistGuideRecipeIds]);

  // Resolve image paths to actual URLs
  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const resolveImages = async () => {
      const newResolved: Record<string, string> = {};
      await Promise.all(
        recipes.map(async (r) => {
          if (r.imagePath) {
            try {
              newResolved[r.id] = await resolveImagePath(r.imagePath);
            } catch (err) {
              console.error(`Failed to resolve image for recipe ${r.id}`, err);
            }
          }
        })
      );
      setResolvedImages(newResolved);
    };

    void resolveImages();
  }, [recipes]);

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

  const AddActions = (
    <div className="flex bg-[var(--color-v2-popover)] p-1 rounded-md shadow-lg border border-[var(--color-v2-border)] flex-col min-w-[200px] z-50">
       <Button variant="ghost" className="justify-start px-3 py-2 text-sm" onClick={() => onNavigateToChef?.()}>
        <Wand2 className="h-4 w-4 mr-2 text-[var(--color-v2-primary)]" /> Ask the AI Chef
      </Button>
      <Button variant="ghost" className="justify-start px-3 py-2 text-sm" onClick={() => setIsImportDialogOpen(true)}>
        <Link className="h-4 w-4 mr-2" /> Import from URL
      </Button>
      <div className="h-px bg-[var(--color-v2-border)] my-1 mx-2" />
      <Button variant="ghost" className="justify-start px-3 py-2 text-sm" onClick={() => setIsCreateDialogOpen(true)}>
        <PenTool className="h-4 w-4 mr-2" /> Manual Entry
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-8 flex flex-col h-full max-w-[1600px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2 xl:mb-0">
        <div className="mb-2 xl:mb-6 shrink-0">
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-br from-[var(--color-v2-foreground)] to-[var(--color-v2-muted-foreground)] bg-clip-text text-transparent">
            Recipes
          </h1>
          <p className="text-[var(--color-v2-muted-foreground)] mt-1 font-medium">
            {processedRecipes.length} dishes found
          </p>
        </div>

        <div className="w-full xl:w-auto flex-1 max-w-full xl:max-w-none">
          <ViewToolbar 
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search recipes..."
        sortOptions={sortOptions}
        activeSortOption={activeSort}
        onSortChange={setActiveSort}
        filterOptions={flatFilterOptions}
        activeFilterOptions={activeFilters}
        onFilterToggle={(id: string) => {
          setActiveFilters(prev => 
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
          );
        }}
        onClearFilters={() => setActiveFilters([])}
        primaryAction={{
          icon: <Plus className="h-4 w-4" />,
          label: "Add Recipe",
          // The Dropdown menu is attached manually for now since ViewToolbar only supports simple onClick
          onClick: () => setIsCreateDialogOpen(true) // Fallback behavior
        }}
      />
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-[var(--color-v2-primary)]" />
          </div>
        ) : processedRecipes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-v2-border)] rounded-[var(--radius-v2-2xl)] bg-[var(--color-v2-card)]/30 backdrop-blur-sm p-8 text-center">
            <div className="p-5 rounded-full bg-[var(--color-v2-secondary)] mb-4 text-[var(--color-v2-muted-foreground)] shadow-inner">
              <UtensilsCrossed className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold mb-2">No recipes found</h3>
            <p className="text-[var(--color-v2-muted-foreground)] mb-6 max-w-sm">
              We couldn't find any recipes matching your current search or filters.
            </p>
            {(searchQuery || activeFilters.length > 0) && (
              <Button 
                onClick={() => { setSearchQuery(''); setActiveFilters([]); }} 
                variant="outline"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full pr-4 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 pb-8">
              {processedRecipes.map((recipe) => (
                <Card 
                  key={recipe.id} 
                  glass 
                  onClick={() => onSelectRecipe(recipe)}
                  className="group relative overflow-hidden flex flex-col hover:-translate-y-2 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[var(--color-v2-primary)]/20 transition-all duration-500 cursor-pointer min-h-[220px]"
                >
                  {recipe.imagePath && resolvedImages[recipe.id] && (
                    <div className="absolute inset-0 z-0 overflow-hidden">
                       <img src={resolvedImages[recipe.id]} alt={recipe.title} className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-700" />
                       <div className="absolute inset-0 bg-[var(--color-v2-card)]/30 group-hover:bg-transparent transition-colors duration-700" />
                       <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-v2-card)] via-[var(--color-v2-card)]/40 to-transparent" />
                    </div>
                  )}

                  <CardHeader className="pb-3 border-b border-[var(--color-v2-border)]/50 bg-[var(--color-v2-secondary)]/40 backdrop-blur-md z-10 relative h-[88px] shrink-0">
                    <div className="flex items-center justify-center gap-3 w-full h-full">
                      <div className="space-y-1 w-full flex items-center justify-center">
                        <CardTitle className="text-xl font-bold line-clamp-2 leading-tight drop-shadow-sm text-center text-balance w-full">{recipe.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-4 pb-4 flex-1 space-y-4 text-sm relative z-10 flex flex-col justify-between">
                    <div className="space-y-3">
                      {recipe.description && (
                        <p className="text-[var(--color-v2-foreground)]/80 text-sm leading-relaxed line-clamp-3">
                          {recipe.description}
                        </p>
                      )}
                      {assistGuideRecipeIds.has(recipe.id) && (
                         <div className="flex flex-wrap gap-2 pt-1">
                           <Badge variant="default" className="bg-[#b528d2] hover:bg-[#a022b9] text-white shadow-sm shrink-0">
                             Assist Ready
                           </Badge>
                         </div>
                       )}
                    </div>
                    
                    <div className="flex items-center justify-between gap-2 pt-3 mt-auto">
                       <Badge variant="secondary" className="bg-[var(--color-v2-background)]/60 backdrop-blur border-0 shadow-sm gap-1.5 shrink-0 rounded-full px-3">
                         <Clock className="w-3.5 h-3.5 text-[var(--color-v2-primary)]" /> 
                         <span className="font-semibold">{formatTime(recipe.totalTime || 'N/A')}</span>
                       </Badge>
                       {recipe.complexity && (
                         <span className="text-[13px] font-semibold text-[var(--color-v2-foreground)]/80 capitalize px-2">
                           {recipe.complexity}
                         </span>
                       )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <RecipeFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        categories={categories}
        onSubmit={handleCreateRecipe}
      />

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="border-[var(--color-v2-border)] bg-[var(--color-v2-card)] text-[var(--color-v2-foreground)]">
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
              className="bg-[var(--color-v2-primary)] text-white hover:bg-[var(--color-v2-primary)]/90 border-0"
            >
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isImporting ? 'Importing...' : 'Import Recipe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
