import React, { useState, useEffect, useRef } from 'react';
import { Recipe, RecipeCategory, RecipeHistoryEntry, RecipeInstruction } from '../../../types/contract';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, Trash2, Clock, Users, ChefHat, Upload, RefreshCw, X, Book, Flame, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { recipesBackend } from '../backend';
import { RecipeFormDialog } from './RecipeFormDialog';
import { DeleteRecipeDialog } from './DeleteRecipeDialog';
import { CategoryPicker } from './CategoryPicker';
import { RecipeChefChat } from './RecipeChefChat';
import { RecipeHistoryDialog } from './RecipeHistoryDialog';
import { CookTab } from './CookTab';
import { ImageEditor } from '../../../shared/components/ImageEditor';
import { softToast } from '@/lib/soft-toast';
import { systemBackend } from '../../../shared/backend/system-backend';
import { buildManualEditSummary, createHistoryEntry } from '../backend/recipe-updates';
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
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id} className="flex items-start gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span>
                {ingredient.quantity && ingredient.unit && (
                  <span className="font-medium">
                    {ingredient.quantity} {ingredient.unit}{' '}
                  </span>
                )}
                {ingredient.ingredientName}
                {ingredient.preparation && (
                  <span className="text-muted-foreground">
                    {' '}({ingredient.preparation})
                  </span>
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
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-relaxed pt-0.5">{instr.text}</p>
                  
                  {/* Step Technical Warnings Popover */}
                  {instr.technicalWarnings && instr.technicalWarnings.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="shrink-0 text-warning hover:text-warning/80 transition-colors p-1 -m-1">
                          <AlertTriangle className="w-5 h-5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        side="top" 
                        align="end" 
                        className="w-72 p-0 overflow-hidden border-orange-200/50 shadow-lg shadow-orange-500/10"
                      >
                        <div className="p-3 bg-[color-mix(in_oklab,var(--warning)_10%,var(--background))]">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5 text-warning" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-warning-foreground">Technical Warning</span>
                          </div>
                          <ul className="space-y-2">
                            {instr.technicalWarnings.map((warning, idx) => (
                              <li key={idx} className="text-xs text-warning-foreground font-medium leading-normal">
                                {warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Step-specific ingredients */}
                {instr.ingredients && instr.ingredients.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {instr.ingredients.map((ingredient) => (
                      <span
                        key={ingredient.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs"
                      >
                        {ingredient.quantity && ingredient.unit && (
                          <span className="font-medium">
                            {ingredient.quantity} {ingredient.unit}
                          </span>
                        )}
                        <span>{ingredient.ingredientName}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
          })}
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

interface RecipeDetailViewProps {
  recipe: Recipe;
  categories: RecipeCategory[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Recipe>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe,
  categories,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [isRefreshingImage, setIsRefreshingImage] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const [chatTop, setChatTop] = useState<number | null>(null);
  const [currentUserName, setCurrentUserName] = useState('Chef');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pendingRestoreEntry, setPendingRestoreEntry] = useState<RecipeHistoryEntry | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [activeTab, setActiveTab] = useState<'recipe' | 'chef' | 'cook'>('recipe');

  // Load image if exists
  useEffect(() => {
    if (recipe.imagePath) {
      setIsLoadingImage(true);
      recipesBackend.resolveImagePath(recipe.imagePath)
        .then(setImageSrc)
        .catch(() => setImageSrc(''))
        .finally(() => setIsLoadingImage(false));
    }
  }, [recipe.imagePath]);

  useEffect(() => {
    systemBackend.getCurrentUser()
      .then(user => {
        if (user?.displayName) {
          setCurrentUserName(user.displayName);
        }
      })
      .catch(() => null);
  }, []);

  // Get category names for this recipe
  const recipeCategories = categories.filter(cat => 
    recipe.categoryIds?.includes(cat.id)
  );

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

  const handleEditUpdate = async (updates: Partial<Recipe>) => {
    const merged = { ...recipe, ...updates } as Recipe;
    const editSummary = buildManualEditSummary(recipe, merged);
    const historyEntry = createHistoryEntry(recipe, editSummary, currentUserName);
    await onUpdate(recipe.id, {
      ...updates,
      history: [...(recipe.history || []), historyEntry],
    });
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
      const updatedRecipe = await recipesBackend.updateRecipe(recipe.id, {}, imageData);
      softToast.success('Image uploaded successfully');
      setIsImageEditorOpen(false);
      // Refresh the image
      if (updatedRecipe.imagePath) {
        const newImageSrc = await recipesBackend.resolveImagePath(updatedRecipe.imagePath);
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
      const imagePath = await recipesBackend.generateRecipeImage(recipe.title, recipe.description);
      const updatedRecipe = await recipesBackend.updateRecipe(recipe.id, { imagePath });
      softToast.success('AI image generated');
      // Refresh the image
      const newImageSrc = await recipesBackend.resolveImagePath(imagePath);
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
        ) : (
          <div className="space-y-6 p-4">
            {/* Mobile Recipe/Chef Tabs */}
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'recipe' | 'chef' | 'cook')} className="w-full">
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
              </TabsList>

              <TabsContent value="recipe" className="mt-6">
                {/* Header with actions */}
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" onClick={onClose}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Recipes
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsHistoryOpen(true)}
                      className="h-9 w-9"
                      title="History"
                    >
                      <Clock className="w-5 h-5" />
                    </Button>
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
          </div>
        )}
      </div>

      {/* Desktop/Tablet: Tabbed Interface */}
      <div className="hidden md:block space-y-6">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'recipe' | 'chef' | 'cook')} className="w-full">
          {/* Tab Triggers */}
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
          </TabsList>

          {/* Recipe Tab - Desktop: Two columns */}
          <TabsContent value="recipe" className="mt-6 space-y-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={onClose}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Recipes
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsHistoryOpen(true)}
                  className="h-9 w-9 md:w-auto md:h-10 md:px-4"
                  title="History"
                >
                  <Clock className="w-5 h-5 md:mr-2" />
                  <span className="hidden md:inline">History</span>
                </Button>
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
              <div className="space-y-6 w-full md:w-[65%]">
                {/* Image */}
                <div ref={imageRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted group">
                  {isLoadingImage ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : imageSrc ? (
                  <>
                    <img 
                      src={imageSrc} 
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                        onLoad={updateChatTop}
                    />
                    {/* Image Actions - Always visible, overlaid on image */}
                    <div className="absolute top-3 right-3 flex gap-2 z-10">
                      <Button
                        size="icon"
                        className="bg-black/70 hover:bg-black/90 text-white shadow-lg backdrop-blur-sm"
                        onClick={() => setIsImageEditorOpen(true)}
                        title="Upload new image"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="bg-black/70 hover:bg-black/90 text-white shadow-lg backdrop-blur-sm"
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
                    <div className="absolute top-3 right-3 flex gap-2 z-10">
                      <Button
                        size="icon"
                        className="bg-black/70 hover:bg-black/90 text-white shadow-lg backdrop-blur-sm"
                        onClick={() => setIsImageEditorOpen(true)}
                        title="Upload image"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="bg-black/70 hover:bg-black/90 text-white shadow-lg backdrop-blur-sm"
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
            </div>

            {/* Chef Chat - Fixed (Desktop only) */}
            <div
              className="hidden lg:block fixed right-6 w-[35vw] max-w-105 min-w-[320px] h-[70vh] max-h-180 z-20"
              style={{ top: chatTop ?? 96 }}
            >
              <RecipeChefChat
                recipe={recipe}
                onRecipeUpdate={onUpdate}
                currentUserName={currentUserName}
              />
            </div>
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
        </Tabs>
      </div>

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
        history={recipe.history}
        onRestore={(entry) => {
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
