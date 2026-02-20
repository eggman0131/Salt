import React, { useState, useEffect } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, Trash2, Clock, Users, ChefHat, Upload, RefreshCw, X, Book, Flame } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { recipesBackend } from '../backend';
import { RecipeFormDialog } from './RecipeFormDialog';
import { DeleteRecipeDialog } from './DeleteRecipeDialog';
import { CategoryPicker } from './CategoryPicker';
import { RecipeChefChat } from './RecipeChefChat';
import { ImageEditor } from '../../../shared/components/ImageEditor';
import { softToast } from '@/lib/soft-toast';

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
  <Card className="max-w-2xl">
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
                    {ingredient.quantity}{ingredient.unit}{' '}
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
          {recipe.instructions.map((instruction, index) => (
            <li key={index} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              <span className="flex-1 pt-0.5">{instruction}</span>
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

  const handleUpdate = async (updates: Partial<Recipe>) => {
    await onUpdate(recipe.id, updates);
    setIsEditDialogOpen(false);
  };

  const handleDelete = async () => {
    await onDelete(recipe.id);
    setIsDeleteDialogOpen(false);
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

  return (
    <div className="space-y-6">
      {/* Tabbed Navigation */}
      <Tabs defaultValue="recipe" className="w-full">
        {/* Tab Triggers */}
        <TabsList className="w-full flex">
          <TabsTrigger value="recipe" className="flex-1 flex items-center justify-center gap-1.5">
            <Book className="w-4 h-4" />
            <span className="hidden md:inline">Recipe</span>
          </TabsTrigger>
          {/* Chef tab only visible on mobile */}
          <TabsTrigger value="chef" className="flex-1 flex items-center justify-center gap-1.5 md:hidden">
            <ChefHat className="w-4 h-4" />
            <span className="hidden md:inline">Chef</span>
          </TabsTrigger>
          <TabsTrigger value="cook" className="flex-1 flex items-center justify-center gap-1.5">
            <Flame className="w-4 h-4" />
            <span className="hidden md:inline">Cook</span>
          </TabsTrigger>
        </TabsList>

        {/* Recipe Tab - Desktop: Two columns, Mobile: Full width */}
        <TabsContent value="recipe" className="mt-6 space-y-6">
          {/* Header with actions */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onClose}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Recipes
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          {/* Image */}
          <div className="relative aspect-video w-full max-w-2xl mx-auto overflow-hidden rounded-lg bg-muted group">
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

          {/* Recipe Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] gap-6 items-start">
            {/* Recipe Detail - Left Column */}
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
            
            {/* Chef Chat - Right Column (Desktop only) */}
            <div className="hidden md:block sticky top-6 h-[calc(100vh-24rem)]">
              <RecipeChefChat recipe={recipe} onRecipeUpdate={onUpdate} />
            </div>
          </div>
        </TabsContent>

        {/* Chef Tab - Mobile only */}
        <TabsContent value="chef" className="mt-6 md:hidden">
          <RecipeChefChat recipe={recipe} onRecipeUpdate={onUpdate} />
        </TabsContent>

        {/* Cook Tab - Placeholder for cook mode */}
        <TabsContent value="cook" className="mt-6">
          <Card className="max-w-2xl mx-auto p-12 border-dashed text-center">
            <div className="text-muted-foreground">
              <Flame className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-lg font-medium">Cook Mode</p>
              <p className="mt-1">Coming soon</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <RecipeFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        categories={categories}
        onSubmit={handleUpdate}
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
    </div>
  );
};
