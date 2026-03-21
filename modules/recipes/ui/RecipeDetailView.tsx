import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Recipe, RecipeCategory, RecipeHistoryEntry, RecipeInstruction } from '../../../types/contract';
import { Stack } from '../../../shared/components/primitives';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { ArrowLeft, Edit, Trash2, Clock, Users, ChefHat, Upload, RefreshCw, X, Book, HandHelping, Flame, AlertTriangle, Wrench, Check, GripHorizontal, Minimize2, ShoppingBag, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import {
  generateRecipeImage,
  resolveImagePath,
  type RecipeSaveProgress,
  updateRecipe,
} from '../api';
import { RecipeFormDialog } from './RecipeFormDialog';
import { DeleteRecipeDialog } from './DeleteRecipeDialog';
import { CategoryPicker } from './CategoryPicker';
import { RecipeChefChat } from './RecipeChefChat';
import { RecipeHistoryDialog } from './RecipeHistoryDialog';
import { CookTab } from './CookTab';
import { CookModeModule } from '../../../modules/assist-mode/api';
import { ImageEditor } from '../../../shared/components/ImageEditor';
import { softToast } from '../../../lib/soft-toast';
import { systemBackend } from '../../../shared/backend/system-backend';
import { buildManualEditSummary, createHistoryEntry } from '../api';
import { addRecipeToList, getDefaultShoppingList, getShoppingLists } from '../../shopping-list';
import type { ShoppingList } from '../../../types/contract';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';

interface RecipeDetailContentProps {
  recipe: Recipe;
  categories: RecipeCategory[];
  recipeCategories: RecipeCategory[];
  complexityVariant: 'secondary' | 'outline' | 'destructive';
  toggleCategory: (categoryId: string) => void;
  setIsCategoryPickerOpen: (open: boolean) => void;
  getSourceDisplay: (source: string) => string;
  isValidUrl: (source: string) => boolean;
}

const RecipeDetailContent: React.FC<RecipeDetailContentProps> = ({
  recipe,
  recipeCategories,
  complexityVariant,
  toggleCategory,
  setIsCategoryPickerOpen,
  getSourceDisplay,
  isValidUrl,
}) => (
  <Card className="w-full">
    <CardHeader className="p-4 md:p-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold flex-1">{recipe.title}</h1>
          <Badge variant={complexityVariant}>
            {recipe.complexity}
          </Badge>
        </div>
        <p className="text-muted-foreground">{recipe.description}</p>
        
        {/* Categories */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Categories</h3>
            <AddButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsCategoryPickerOpen(true)}
              label="Add"
            />
          </div>
          {recipeCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipeCategories.map(cat => (
                <Badge
                  key={cat.id}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => toggleCategory(cat.id)}
                >
                  {cat.name}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </CardHeader>

    <CardContent className="space-y-6 p-4 md:p-6">
      {/* At a glance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="font-medium">Prep</div>
            <div className="text-muted-foreground">{recipe.prepTime}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="font-medium">Cook</div>
            <div className="text-muted-foreground">{recipe.cookTime}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="font-medium">Total</div>
            <div className="text-muted-foreground">{recipe.totalTime}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="font-medium">Servings</div>
            <div className="text-muted-foreground">{recipe.servings}</div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Ingredients */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Ingredients</h2>
        <ul className="space-y-2">
          {recipe.ingredients.map((ingredient, idx) => (
            <li key={ingredient.id} className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span className="flex items-start gap-2">
                <span>
                  {ingredient.raw}
                </span>
                {ingredient.canonicalItemId ? (
                  <div className="shrink-0 text-green-600 dark:text-green-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded">
                    <Check className="h-4 w-4 mt-0.5" />
                  </div>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="shrink-0 text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 text-sm">
                      <div className="space-y-2">
                        <p className="font-semibold text-amber-600 dark:text-amber-500">Not linked to kitchen database</p>
                        <p className="text-muted-foreground">This ingredient isn't linked to a canonical item. Consider running the Recipe Repair function to relink ingredients.</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {ingredient.matchingAudit && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="shrink-0 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                        aria-label="Show ingredient match trace"
                      >
                        <Book className="h-4 w-4 mt-0.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 text-sm">
                      <div className="space-y-2">
                        <p className="font-semibold">Match Trace</p>
                        <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Original</span>
                          <span className="text-xs font-mono truncate" title={ingredient.raw}>{ingredient.raw}</span>
                          <span className="text-muted-foreground">Stage</span>
                          <span>{ingredient.matchingAudit.stage || '-'}</span>
                          <span className="text-muted-foreground">Action</span>
                          <span>{ingredient.matchingAudit.decisionAction || '-'}</span>
                          <span className="text-muted-foreground">Source</span>
                          <span>{ingredient.matchingAudit.decisionSource || '-'}</span>
                          <span className="text-muted-foreground">Matched</span>
                          <span>{ingredient.matchingAudit.matchedSource || '-'}</span>
                          <span className="text-muted-foreground">Candidate</span>
                          <span className="truncate" title={ingredient.matchingAudit.candidateId || ''}>
                            {ingredient.matchingAudit.candidateId || '-'}
                          </span>
                          <span className="text-muted-foreground">Top score</span>
                          <span>
                            {typeof ingredient.matchingAudit.topScore === 'number'
                              ? `${(ingredient.matchingAudit.topScore * 100).toFixed(1)}%`
                              : '-'}
                          </span>
                          <span className="text-muted-foreground">Score gap</span>
                          <span>
                            {typeof ingredient.matchingAudit.scoreGap === 'number'
                              ? `${(ingredient.matchingAudit.scoreGap * 100).toFixed(1)}%`
                              : '-'}
                          </span>
                          <span className="text-muted-foreground">Reason</span>
                          <span className="wrap-break-word">{ingredient.matchingAudit.reason || '-'}</span>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      {/* Instructions */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Instructions</h2>
        <ol className="space-y-4">
          {recipe.instructions.map((instr: RecipeInstruction, index: number) => (
            <li key={instr.id} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold mt-0.5">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm leading-relaxed pt-0.5">{instr.text}</p>
                {instr.technicalWarnings && instr.technicalWarnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {instr.technicalWarnings.map((warning, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-xs text-warning-foreground font-medium leading-normal">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Equipment */}
      {recipe.equipmentNeeded && recipe.equipmentNeeded.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-xl font-semibold mb-3">Equipment Required</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {recipe.equipmentNeeded.map((equipment, index) => (
                <li key={index} className="flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-muted-foreground" />
                  <span>{equipment}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Source */}
      {recipe.source && (
        <>
          <Separator />
          <div className="text-sm">
            <span className="text-muted-foreground">Source: </span>
            {isValidUrl(recipe.source) ? (
              <a
                href={recipe.source.startsWith('http') ? recipe.source : `https://${recipe.source}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {getSourceDisplay(recipe.source)}
              </a>
            ) : (
              <span className="text-muted-foreground">{recipe.source}</span>
            )}
          </div>
        </>
      )}
    </CardContent>
  </Card>
);

// ── Matching status banner ─────────────────────────────────────────────────

const MatchingStatusBanner: React.FC<{ recipe: Recipe; onRepair?: (recipe: Recipe) => void }> = ({ recipe, onRepair }) => {
  if (!recipe.matchingStatus || recipe.matchingStatus === 'matched') return null;

  if (recipe.matchingStatus === 'matching' || recipe.matchingStatus === 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>Matching ingredients to kitchen database…</span>
      </div>
    );
  }

  if (recipe.matchingStatus === 'failed') {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{recipe.matchingError ?? 'Ingredient matching failed.'}</span>
        </div>
        {onRepair && (
          <Button variant="outline" size="sm" onClick={() => onRepair(recipe)} className="h-7 text-xs shrink-0">
            <Wrench className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return null;
};

// ── RecipeDetailView ───────────────────────────────────────────────────────

interface RecipeDetailViewProps {
  recipe: Recipe;
  categories: RecipeCategory[];
  onClose: () => void;
  onUpdate: (
    id: string,
    updates: Partial<Recipe>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRepair?: (recipe: Recipe) => void;
  autoOpenImageEditor?: boolean;
  onImageEditorOpened?: () => void;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe,
  categories,
  onClose,
  onUpdate,
  onDelete,
  onRepair,
  autoOpenImageEditor = false,
  onImageEditorOpened,
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const [chatTop, setChatTop] = useState<number | null>(null);
  const [isChatMinimized, setIsChatMinimized] = useState(true);
  const [chatPos, setChatPos] = useState<{ x: number; y: number } | null>(null);
  const [currentUserName, setCurrentUserName] = useState('Chef');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pendingRestoreEntry, setPendingRestoreEntry] = useState<RecipeHistoryEntry | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [activeTab, setActiveTab] = useState<'recipe' | 'chef' | 'cook' | 'assist'>('recipe');
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);

  useEffect(() => {
    getShoppingLists().then(setShoppingLists).catch(() => {});
  }, []);

  // Scroll to top when recipe opens or changes (before paint)
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [recipe.id]);

  // Scroll to top when switching tabs
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Load image if exists
  useEffect(() => {
    if (recipe.imagePath) {
      setIsLoadingImage(true);
      setHasImageError(false);
      
      resolveImagePath(recipe.imagePath)
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
        .finally(() => setIsLoadingImage(false));
    }
  }, [recipe.imagePath]);

  // Reset error state when image src changes
  useEffect(() => {
    setHasImageError(false);
  }, [imageSrc]);

  useEffect(() => {
    systemBackend.getCurrentUser()
      .then(user => {
        if (user?.displayName) {
          setCurrentUserName(user.displayName);
        }
      })
      .catch(() => null);
  }, []);

  // Auto-open image editor when navigating from list view upload button
  useEffect(() => {
    if (autoOpenImageEditor) {
      setIsImageEditorOpen(true);
      onImageEditorOpened?.();
    }
  }, [autoOpenImageEditor, onImageEditorOpened]);

  // Get category names for this recipe (including missing ones)
  const categoryMap = new Map(categories.map(cat => [cat.id, cat]));
  const recipeCategories = (recipe.categoryIds || []).map(catId =>
    categoryMap.get(catId) || { id: catId, name: 'Category Not Found', createdAt: new Date() }
  ) as RecipeCategory[];

  const toggleCategory = async (categoryId: string) => {
    const currentCategoryIds = recipe.categoryIds || [];
    const newCategoryIds = currentCategoryIds.includes(categoryId)
      ? currentCategoryIds.filter(id => id !== categoryId)
      : [...currentCategoryIds, categoryId];
    
    try {
      await onUpdate(recipe.id, { categoryIds: newCategoryIds });
    } catch (error) {
      console.error('Failed to update categories:', error);
      softToast.error('Failed to update categories');
    }
  };

  // Complexity badge color
  const complexityVariant = {
    Simple: 'secondary',
    Intermediate: 'outline',
    Advanced: 'destructive',
  }[recipe.complexity] as 'secondary' | 'outline' | 'destructive';

  // Parse source to display domain name
  const getSourceDisplay = (source: string) => {
    try {
      const url = new URL(source.startsWith('http') ? source : `https://${source}`);
      return url.hostname.replace('www.', '');
    } catch {
      // If not a valid URL, return as-is
      return source;
    }
  };

  const isValidUrl = (source: string) => {
    try {
      new URL(source.startsWith('http') ? source : `https://${source}`);
      return true;
    } catch {
      return false;
    }
  };

  const handleEditUpdate = async (
    updates: Partial<Recipe>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => {
    const merged = { ...recipe, ...updates } as Recipe;
    const editSummary = buildManualEditSummary(recipe, merged);
    const historyEntry = createHistoryEntry(recipe, editSummary, currentUserName);
    await onUpdate(recipe.id, {
      ...updates,
      history: [...(recipe.history || []), historyEntry],
    }, onProgress);
    setIsEditDialogOpen(false);
  };

  const handleDelete = async () => {
    await onDelete(recipe.id);
    setIsDeleteDialogOpen(false);
  };

  const handleRestoreHistory = async () => {
    if (!pendingRestoreEntry) return;
    setIsRestoring(true);
    try {
      const safetyEntry = createHistoryEntry(
        recipe,
        'Restore point saved before reverting.',
        currentUserName
      );
      await onUpdate(recipe.id, {
        ...pendingRestoreEntry.snapshot,
        history: [...(recipe.history || []), safetyEntry],
      });
      setIsHistoryOpen(false);
      setPendingRestoreEntry(null);
    } catch (error) {
      console.error('Failed to restore version:', error);
      softToast.error('Could not restore version');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSaveImage = async (imageData: string) => {
    try {
      const updatedRecipe = await updateRecipe(recipe.id, {}, imageData);
      softToast.success('Image uploaded successfully');
      setIsImageEditorOpen(false);
      // Refresh the image
      if (updatedRecipe.imagePath) {
        const newImageSrc = await resolveImagePath(updatedRecipe.imagePath);
        setImageSrc(newImageSrc);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      softToast.error('Failed to upload image');
    }
  };

  const handleRefreshImage = async () => {
    try {
      setIsRefreshingImage(true);
      const imageData = await generateRecipeImage(recipe.title, recipe.description);
      const updatedRecipe = await updateRecipe(recipe.id, {}, imageData);
      softToast.success('AI image generated');
      // Refresh the image
      const newImageSrc = await resolveImagePath(updatedRecipe.imagePath || '');
      setImageSrc(newImageSrc);
    } catch (error) {
      console.error('Failed to generate image:', error);
      softToast.error('Failed to generate image');
    } finally {
      setIsRefreshingImage(false);
    }
  };

  const updateChatTop = () => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    setChatTop(rect.top);
  };

  const handleAddToShoppingList = async (listId?: string) => {
    try {
      const id = listId ?? (await getDefaultShoppingList()).id;
      await addRecipeToList(recipe.id, id);
      softToast.success('Added to shopping list');
    } catch (e) {
      console.error(e);
      softToast.error('Failed to add to shopping list');
    }
  };

  const handleImageError = (e: React.SyntheticEvent) => {
    (e.currentTarget as HTMLElement).style.display = 'none';
    setHasImageError(true);
  };

  const handleChatDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const panel = chatPanelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    isDragging.current = true;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const panelW = panel.offsetWidth;
      const panelH = panel.offsetHeight;
      setChatPos({
        x: Math.max(0, Math.min(window.innerWidth - panelW, e.clientX - offsetX)),
        y: Math.max(0, Math.min(window.innerHeight - panelH, e.clientY - offsetY)),
      });
    };

    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    updateChatTop();
    const handleResize = () => requestAnimationFrame(updateChatTop);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imageSrc]);

  return (
    <>
      {/* Mobile: Conditional View */}
      <div className="md:hidden">
        {activeTab === 'cook' ? (
          <CookTab recipe={recipe} onClose={() => setActiveTab('recipe')} />
        ) : activeTab === 'assist' ? (
          <CookModeModule recipe={recipe} onClose={() => setActiveTab('recipe')} />
        ) : (
          <Stack spacing="gap-6">
            {/* Mobile Recipe/Chef Tabs */}
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'recipe' | 'chef' | 'cook' | 'assist')} className="w-full">
              <TabsList className="w-full flex md:w-auto md:inline-flex h-11 bg-muted/50 p-1 border shadow-sm transition-all">
                <TabsTrigger 
                  value="recipe" 
                  className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  <Book className="w-4 h-4" />
                  <span className="hidden md:inline">Recipe</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="chef" 
                  className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  <ChefHat className="w-4 h-4" />
                  <span className="hidden md:inline">Chef</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="cook" 
                  className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  <Flame className="w-4 h-4" />
                  <span className="hidden md:inline">Cook</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="assist" 
                  className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  <HandHelping className="w-4 h-4" />
                  <span className="hidden md:inline">Assist</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="recipe" className="mt-6">
                {/* Header with actions */}
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" onClick={onClose}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Recipes
                  </Button>
                  <div className="flex gap-2">
                    {shoppingLists.length > 1 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="h-9 w-9" title="Add to Shopping List">
                            <ShoppingBag className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {shoppingLists.map(list => (
                            <DropdownMenuItem key={list.id} onClick={() => handleAddToShoppingList(list.id)}>
                              {list.name}{list.isDefault ? ' (default)' : ''}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleAddToShoppingList()}
                        className="h-9 w-9"
                        title="Add to Shopping List"
                      >
                        <ShoppingBag className="w-5 h-5" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={() => setIsHistoryOpen(true)}
                      className="h-9 w-9"
                      title="History"
                    >
                      <Clock className="w-5 h-5" />
                    </Button>
                    {onRepair && (
                      <Button 
                        variant="outline" 
                        onClick={() => onRepair(recipe)}
                        className="h-9 w-9"
                        title="Repair recipe"
                      >
                        <Wrench className="w-5 h-5" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditDialogOpen(true)}
                      className="h-9 w-9"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                <MatchingStatusBanner recipe={recipe} onRepair={onRepair} />
                <RecipeDetailContent
                  recipe={recipe}
                  categories={categories}
                  recipeCategories={recipeCategories}
                  complexityVariant={complexityVariant}
                  toggleCategory={toggleCategory}
                  setIsCategoryPickerOpen={setIsCategoryPickerOpen}
                  getSourceDisplay={getSourceDisplay}
                  isValidUrl={isValidUrl}
                />
              </TabsContent>

              <TabsContent value="chef" className="mt-6 h-[75vh]">
                <RecipeChefChat
                  recipe={recipe}
                  onRecipeUpdate={onUpdate}
                  currentUserName={currentUserName}
                />
              </TabsContent>
            </Tabs>
          </Stack>
        )}
      </div>

      {/* Desktop/Tablet: Tabbed Interface */}
      <Stack spacing="gap-6" className="hidden md:block">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'recipe' | 'chef' | 'cook' | 'assist')} className="w-full">
          {/* Tab Triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <TabsList className="w-full flex md:w-auto md:inline-flex h-11 bg-muted/50 p-1 border shadow-sm transition-all">
              <TabsTrigger 
                value="recipe" 
                className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
              >
                <Book className="w-4 h-4" />
                <span className="hidden md:inline">Recipe</span>
              </TabsTrigger>
              <TabsTrigger 
                value="chef" 
                className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all lg:hidden"
              >
                <ChefHat className="w-4 h-4" />
                <span className="hidden md:inline">Chef</span>
              </TabsTrigger>
              <TabsTrigger 
                value="cook" 
                className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
              >
                <Flame className="w-4 h-4" />
                <span className="hidden md:inline">Cook</span>
              </TabsTrigger>
              <TabsTrigger 
                value="assist" 
                className="h-full flex-1 md:px-8 flex items-center justify-center gap-1.5 font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
              >
                <HandHelping className="w-4 h-4" />
                <span className="hidden md:inline">Assist</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Recipe Tab - Desktop: Two columns */}
          <TabsContent value="recipe" className="mt-6 space-y-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={onClose}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Recipes
              </Button>
              <div className="flex gap-2">
                {shoppingLists.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9 w-9 md:w-auto md:h-10 md:px-4" title="Add to Shopping List">
                        <ShoppingBag className="w-5 h-5 md:mr-2" />
                        <span className="hidden md:inline">Add to List</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {shoppingLists.map(list => (
                        <DropdownMenuItem key={list.id} onClick={() => handleAddToShoppingList(list.id)}>
                          {list.name}{list.isDefault ? ' (default)' : ''}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleAddToShoppingList()}
                    className="h-9 w-9 md:w-auto md:h-10 md:px-4"
                    title="Add to Shopping List"
                  >
                    <ShoppingBag className="w-5 h-5 md:mr-2" />
                    <span className="hidden md:inline">Add to List</span>
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => setIsHistoryOpen(true)}
                  className="h-9 w-9 md:w-auto md:h-10 md:px-4"
                  title="History"
                >
                  <Clock className="w-5 h-5 md:mr-2" />
                  <span className="hidden md:inline">History</span>
                </Button>
                {onRepair && (
                  <Button 
                    variant="outline" 
                    onClick={() => onRepair(recipe)}
                    className="h-9 w-9 md:w-auto md:h-10 md:px-4"
                    title="Repair recipe"
                  >
                    <Wrench className="w-5 h-5 md:mr-2" />
                    <span className="hidden md:inline">Repair</span>
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(true)}
                  className="h-9 w-9 md:w-auto md:h-10 md:px-4"
                  title="Edit"
                >
                  <Edit className="w-5 h-5 md:mr-2" />
                  <span className="hidden md:inline">Edit</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="h-9 w-9 md:w-auto md:h-10 md:px-4 text-destructive hover:bg-destructive/10"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5 md:mr-2" />
                  <span className="hidden md:inline">Delete</span>
                </Button>
              </div>
            </div>

              {/* Recipe Content */}
              <Stack spacing="gap-6" className="w-full md:w-[65%]">
                {/* Image */}
                <div ref={imageRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted group">
                  {isLoadingImage ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : imageSrc && !hasImageError ? (
                  <>
                    <img 
                      src={imageSrc} 
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                      onLoad={updateChatTop}
                      onError={handleImageError}
                    />
                    {/* Image Actions - Always visible, overlaid on image */}
                    <div className="absolute top-3 right-3 flex gap-2 z-10 pointer-events-auto">
                      <Button
                        size="icon"
                        className="bg-white/50 hover:bg-white/70 text-black min-w-10 min-h-10"
                        onClick={() => setIsImageEditorOpen(true)}
                        title="Upload new image"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="bg-white/50 hover:bg-white/70 text-black min-w-10 min-h-10"
                        onClick={handleRefreshImage}
                        disabled={isRefreshingImage}
                        title="Generate AI image"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshingImage ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ChefHat className="w-16 h-16 text-muted-foreground/20" />
                    </div>
                    {/* Upload button for recipes without images */}
                    <div className="absolute top-3 right-3 flex gap-2 z-10 pointer-events-auto">
                      <Button
                        size="icon"
                        className="bg-white/50 hover:bg-white/70 text-black min-w-10 min-h-10"
                        onClick={() => setIsImageEditorOpen(true)}
                        title="Upload image"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="bg-white/50 hover:bg-white/70 text-black min-w-10 min-h-10"
                        onClick={handleRefreshImage}
                        disabled={isRefreshingImage}
                        title="Generate AI image"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshingImage ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Recipe Detail - Column 1 */}
              <MatchingStatusBanner recipe={recipe} onRepair={onRepair} />
              <RecipeDetailContent
                recipe={recipe}
                categories={categories}
                recipeCategories={recipeCategories}
                complexityVariant={complexityVariant}
                toggleCategory={toggleCategory}
                setIsCategoryPickerOpen={setIsCategoryPickerOpen}
                getSourceDisplay={getSourceDisplay}
                isValidUrl={isValidUrl}
              />
            </Stack>

            {/* Chef Chat - Fixed/Draggable (Desktop only) */}
            {isChatMinimized ? (
              <button
                className="hidden lg:flex fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg items-center justify-center hover:bg-primary/90 transition-colors"
                onClick={() => setIsChatMinimized(false)}
                title="Open Chef Chat"
              >
                <ChefHat className="w-5 h-5" />
              </button>
            ) : (
              <div
                ref={chatPanelRef}
                className="hidden lg:flex lg:flex-col fixed z-20 w-[35vw] max-w-105 min-w-[320px] h-[70vh] max-h-180"
                style={chatPos
                  ? { left: chatPos.x, top: chatPos.y }
                  : { right: 24, top: chatTop ?? 96 }
                }
              >
                {/* Drag handle bar */}
                <div
                  className="flex items-center justify-between px-3 py-1.5 bg-muted border border-b-0 rounded-t-lg cursor-grab active:cursor-grabbing select-none shrink-0"
                  onMouseDown={handleChatDragStart}
                >
                  <GripHorizontal className="w-4 h-4 text-muted-foreground" />
                  <button
                    className="p-0.5 rounded hover:bg-muted-foreground/20 transition-colors"
                    onClick={() => setIsChatMinimized(true)}
                    title="Minimise"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Minimize2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 *:rounded-t-none *:border-t-0">
                  <RecipeChefChat
                    recipe={recipe}
                    onRecipeUpdate={onUpdate}
                    currentUserName={currentUserName}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Chef Tab */}
          <TabsContent value="chef" className="mt-6 md:hidden h-[75vh]">
            <RecipeChefChat
              recipe={recipe}
              onRecipeUpdate={onUpdate}
              currentUserName={currentUserName}
            />
          </TabsContent>

          {/* Cook Tab */}
          <TabsContent value="cook" className="mt-6">
            <CookTab recipe={recipe} />
          </TabsContent>

          {/* Assist Tab */}
          <TabsContent value="assist" className="mt-6">
            <CookModeModule recipe={recipe} onClose={() => setActiveTab('recipe')} />
          </TabsContent>
        </Tabs>
      </Stack>

      {/* Edit Dialog */}
      <RecipeFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        categories={categories}
        onSubmit={handleEditUpdate}
        recipe={recipe}
      />

      {/* Delete Dialog */}
      <DeleteRecipeDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        recipeName={recipe.title}
        onConfirm={handleDelete}
      />

      {/* Image Editor Dialog */}
      <Dialog open={isImageEditorOpen} onOpenChange={setIsImageEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
          <DialogHeader>
            <DialogTitle>Upload Recipe Image</DialogTitle>
          </DialogHeader>
          <ImageEditor
            width={600}
            height={450}
            onSave={handleSaveImage}
            onCancel={() => setIsImageEditorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Category Picker */}
      <CategoryPicker
        open={isCategoryPickerOpen}
        onOpenChange={setIsCategoryPickerOpen}
        categories={categories}
        selectedCategoryIds={recipe.categoryIds || []}
        onToggle={toggleCategory}
      />

      <RecipeHistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        recipe={recipe}
        onRestore={(versionId) => {
          const entry = recipe.history?.find(h => h.timestamp === versionId) ?? null;
          setPendingRestoreEntry(entry);
          setIsHistoryOpen(false);
        }}
      />

      <AlertDialog open={!!pendingRestoreEntry} onOpenChange={(open) => !open && setPendingRestoreEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current version will be saved before restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreHistory} disabled={isRestoring}>
              {isRestoring ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
