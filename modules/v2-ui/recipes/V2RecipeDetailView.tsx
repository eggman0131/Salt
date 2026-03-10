import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import { Button } from '../design-system/components/Button';
import { Badge } from '../design-system/components/Badge';
import { ScrollArea } from '../design-system/components/ScrollArea';
import { ArrowLeft, Edit, Trash2, Clock, Users, ChefHat, Book, ShoppingBag, Loader2, UtensilsCrossed, AlertTriangle, Check, Link as LinkIcon } from 'lucide-react';

/* Legacy integrations */
import { resolveImagePath, type RecipeSaveProgress } from '../../recipes/api';
import { addRecipeToShoppingList } from '../../shopping-list/api';
import { softToast } from '@/lib/soft-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { V2RecipeEditDialog } from './V2RecipeEditDialog';
import { V2RecipeChefChat } from './V2RecipeChefChat';
import { V2RecipeCookingView } from './V2RecipeCookingView';

interface V2RecipeDetailViewProps {
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
}

const formatTime = (timeStr: string) => {
  if (!timeStr) return 'N/A';
  return timeStr.replace(/\bhours?\b/gi, 'hrs').replace(/\bminutes?\b/gi, 'mins');
};

export const V2RecipeDetailView: React.FC<V2RecipeDetailViewProps> = ({
  recipe,
  categories,
  onClose,
  onUpdate,
  onDelete,
  onRepair,
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isChefChatOpen, setIsChefChatOpen] = useState(false);
  const [isCookingViewOpen, setIsCookingViewOpen] = useState(false);

  // Scroll to top
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [recipe.id]);

  useEffect(() => {
    if (recipe.imagePath) {
      resolveImagePath(recipe.imagePath)
        .then(async (url) => {
          if (!url) return setImageSrc('');
          try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) setImageSrc(url);
          } catch {
            // ignore
          }
        })
        .catch(() => setImageSrc(''));
    }
  }, [recipe.imagePath]);

  const recipeCategories = categories.filter(cat => 
    recipe.categoryIds?.includes(cat.id)
  );

  const getSourceDisplay = (source: string) => {
    try {
      const url = new URL(source.startsWith('http') ? source : `https://${source}`);
      return url.hostname.replace('www.', '');
    } catch {
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

  const handleDelete = async () => {
    await onDelete(recipe.id);
    setIsDeleteDialogOpen(false);
  };

  const handleUpdate = async (
    updates: Partial<Recipe>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => {
    await onUpdate(recipe.id, updates, onProgress);
    setIsEditDialogOpen(false);
  };

  const handleAddToShoppingList = async () => {
    try {
      await addRecipeToShoppingList(recipe.id);
      softToast.success('Added to shopping list');
    } catch (e) {
      console.error(e);
      softToast.error('Failed to add to shopping list');
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--color-v2-background)] md:flex overflow-hidden z-50">
      
      {/* 
        ==============================
        HERO BACKGROUND (Full Bleed)
        ==============================
      */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {imageSrc ? (
          <div className="absolute inset-0">
            <img src={imageSrc} alt="" className="w-full h-full object-cover opacity-30 md:opacity-20 blur-[80px] scale-110 saturate-150 mix-blend-screen" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[var(--color-v2-background)] via-[var(--color-v2-background)]/80 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[var(--color-v2-background)] via-[var(--color-v2-background)]/80 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-v2-card)] to-[var(--color-v2-background)]" />
        )}
      </div>

      {/* 
        ==============================
        MAIN SCROLLABLE CONTENT
        ==============================
      */}
      <div className={`flex-1 overflow-auto transition-all duration-500 z-10 ${isChefChatOpen ? 'md:pr-[400px]' : ''}`}>
        
        {/* Floating Action Bar (Top) */}
        <div className="sticky top-0 p-4 md:p-8 flex items-center justify-between z-30 pointer-events-none gap-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="pointer-events-auto rounded-full h-11 md:h-12 px-4 md:px-5 bg-[var(--color-v2-card)]/80 md:bg-[var(--color-v2-card)]/60 backdrop-blur-xl border border-[var(--color-v2-border)]/50 shadow-lg hover:bg-[var(--color-v2-secondary)] group shrink-0"
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-sm md:text-base">Back</span>
          </Button>

          {/* Unified Action Toolbar */}
          <div className="flex items-center gap-1 md:gap-2 pointer-events-auto bg-[var(--color-v2-card)]/90 md:bg-[var(--color-v2-card)]/60 backdrop-blur-xl border border-[var(--color-v2-border)]/50 p-1 md:p-1.5 rounded-full shadow-lg shrink-0">
            {recipe.instructions && recipe.instructions.length > 0 && (
              <>
                <Button 
                  variant="default" 
                  className="rounded-full h-10 px-4 md:px-6 gap-2 bg-[var(--color-v2-primary)] text-white hover:bg-[var(--color-v2-primary)]/90 border-0 shadow-md shadow-[var(--color-v2-primary)]/20 animate-pulse-subtle" 
                  onClick={() => setIsCookingViewOpen(true)}
                  title="Start Cooking"
                >
                  <UtensilsCrossed className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-bold text-sm md:text-base">Cook</span>
                </Button>
                <div className="w-px h-6 bg-[var(--color-v2-border)] mx-1" />
              </>
            )}
            <Button variant="ghost" className="rounded-full h-10 w-10 md:h-10 md:w-10 p-0" onClick={handleAddToShoppingList} title="Add to List">
              <ShoppingBag className="w-4 h-4 md:w-4 md:h-4" />
            </Button>
            <Button variant="ghost" className="rounded-full h-10 w-10 md:h-10 md:w-10 p-0" onClick={() => setIsEditDialogOpen(true)} title="Edit">
              <Edit className="w-4 h-4 md:w-4 md:h-4" />
            </Button>
            <Button variant="ghost" className="hidden md:inline-flex rounded-full h-10 w-10 p-0 hover:bg-red-500/10 hover:text-red-500" onClick={() => setIsDeleteDialogOpen(true)} title="Delete">
              <Trash2 className="w-4 h-4 md:w-4 md:h-4" />
            </Button>
            <div className="w-px h-6 bg-[var(--color-v2-border)] mx-1 hidden md:block" />
            <Button 
              variant="outline" 
              className="rounded-full h-10 px-4 gap-2 border-[var(--color-v2-primary)]/30 text-[var(--color-v2-primary)] hover:bg-[var(--color-v2-primary)]/10 bg-transparent shadow-sm" 
              onClick={() => setIsChefChatOpen(!isChefChatOpen)}
            >
              <ChefHat className="w-4 h-4 md:w-4 md:h-4" />
              <span className="font-semibold text-sm md:text-base">{isChefChatOpen ? 'Hide' : 'Chef'}</span>
            </Button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-8 pb-32">
          
          {/* Cover Hero Block */}
          <div className="relative rounded-[var(--radius-v2-3xl)] overflow-hidden bg-[var(--color-v2-card)]/30 backdrop-blur-2xl border border-[var(--color-v2-border)]/50 shadow-2xl mb-8 md:mb-12 min-h-[40vh] md:min-h-[50vh] flex flex-col justify-end p-6 md:p-12 mt-4 md:mt-0 group">
             {imageSrc && (
               <div className="absolute inset-0 z-0">
                 <img src={imageSrc} alt="" className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-1000 origin-bottom" />
                 <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-v2-background)] via-[var(--color-v2-background)]/60 to-transparent" />
               </div>
             )}
             
             <div className="relative z-10 w-full md:w-3/4 space-y-4 md:space-y-6">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant={recipe.complexity === 'Hard' || recipe.complexity === 'Technical' ? 'destructive' : 'default'} className="bg-[var(--color-v2-primary)] text-white shadow-lg uppercase tracking-wider text-xs">
                    {recipe.complexity}
                  </Badge>
                  {recipeCategories.map(cat => (
                     <Badge key={cat.id} variant="secondary" className="bg-[var(--color-v2-card)]/80 backdrop-blur shadow-sm">
                       {cat.name}
                     </Badge>
                  ))}
                </div>
                
                <h1 className="text-4xl md:text-6xl font-black text-[var(--color-v2-foreground)] tracking-tight leading-[1.1] drop-shadow-xl">{recipe.title}</h1>
                
                {recipe.description && (
                  <p className="text-lg md:text-xl text-[var(--color-v2-foreground)]/90 font-medium leading-relaxed drop-shadow-md max-w-3xl">
                    {recipe.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="flex items-center gap-2 bg-[var(--color-v2-card)]/50 backdrop-blur-md border border-[var(--color-v2-border)]/50 px-4 py-2 rounded-2xl">
                    <Clock className="w-5 h-5 text-[var(--color-v2-primary)]" />
                    <div>
                      <div className="text-xs uppercase font-bold text-[var(--color-v2-muted-foreground)] tracking-widest">Total Time</div>
                      <div className="font-bold text-lg">{formatTime(recipe.totalTime || '---')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-[var(--color-v2-card)]/50 backdrop-blur-md border border-[var(--color-v2-border)]/50 px-4 py-2 rounded-2xl">
                    <Users className="w-5 h-5 text-[var(--color-v2-primary)]" />
                    <div>
                      <div className="text-xs uppercase font-bold text-[var(--color-v2-muted-foreground)] tracking-widest">Yields</div>
                      <div className="font-bold text-lg">{recipe.servings || '---'}</div>
                    </div>
                  </div>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
            
            {/* INGREDIENTS COLUMN */}
            <div className="md:col-span-4 space-y-6">
               <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 mb-6 text-[var(--color-v2-primary)]">
                 <UtensilsCrossed className="w-6 h-6" /> Ingredients
               </h2>

               <div className="space-y-3">
                 {recipe.ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="v2-glass rounded-2xl p-4 flex gap-3 relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-v2-primary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="shrink-0 mt-0.5">
                        {ingredient.canonicalItemId ? (
                          <div className="w-5 h-5 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center ring-1 ring-green-500/20">
                            <Check className="w-3 h-3" />
                          </div>
                        ) : (
                           <div className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center ring-1 ring-orange-500/20">
                             <AlertTriangle className="w-3 h-3" />
                           </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[var(--color-v2-foreground)] leading-tight">
                          {ingredient.raw || (
                            <>
                              {ingredient.quantity && ingredient.unit && (
                                <span className="font-bold text-[var(--color-v2-primary)] mr-1.5">{ingredient.quantity} {ingredient.unit}</span>
                              )}
                              {ingredient.ingredientName}
                            </>
                          )}
                        </span>
                        {!ingredient.raw && ingredient.preparation && (
                          <span className="text-sm text-[var(--color-v2-muted-foreground)]">
                            {ingredient.preparation}
                          </span>
                        )}
                      </div>
                    </div>
                 ))}
               </div>

               {recipe.equipmentNeeded && recipe.equipmentNeeded.length > 0 && (
                 <div className="pt-6">
                    <h2 className="text-xl font-black tracking-tight flex items-center gap-2 mb-4 text-[var(--color-v2-foreground)]">
                      <ChefHat className="w-5 h-5 opacity-70" /> Equipment
                    </h2>
                    <ul className="flex flex-wrap gap-2">
                       {recipe.equipmentNeeded.map((eq, i) => (
                         <li key={i} className="px-3 py-1.5 rounded-lg bg-[var(--color-v2-secondary)] border border-[var(--color-v2-border)] text-sm font-medium">
                           {eq}
                         </li>
                       ))}
                    </ul>
                 </div>
               )}

               {recipe.source && (
                 <div className="pt-6">
                    <div className="v2-glass p-4 rounded-2xl border-l-[3px] border-[var(--color-v2-primary)]">
                       <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-v2-muted-foreground)] mb-1 block">Source</span>
                       {isValidUrl(recipe.source) ? (
                          <a href={recipe.source.startsWith('http') ? recipe.source : `https://${recipe.source}`} target="_blank" rel="noopener noreferrer" className="text-[var(--color-v2-foreground)] font-semibold hover:text-[var(--color-v2-primary)] hover:underline flex items-center gap-2 transition-colors">
                            <LinkIcon className="w-4 h-4" /> {getSourceDisplay(recipe.source)}
                          </a>
                       ) : (
                         <span className="font-medium">{recipe.source}</span>
                       )}
                    </div>
                 </div>
               )}
            </div>


            {/* INSTRUCTIONS COLUMN */}
            <div className="md:col-span-8">
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 mb-6 text-[var(--color-v2-primary)]">
                 <Book className="w-6 h-6" /> Instructions
               </h2>

               <ol className="relative border-l-2 border-[var(--color-v2-border)] ml-3 space-y-8 pb-8">
                 {recipe.instructions.map((instr, idx) => (
                    <li key={instr.id} className="pl-8 relative group">
                       <span className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-[var(--color-v2-card)] border-2 border-[var(--color-v2-primary)] flex items-center justify-center font-black text-[var(--color-v2-primary)] shadow-md group-hover:scale-110 transition-transform">
                          {idx + 1}
                       </span>
                       
                       <div className="v2-glass p-6 rounded-2xl hover:bg-[var(--color-v2-secondary)] transition-colors duration-300">
                          <p className="text-lg leading-relaxed text-[var(--color-v2-foreground)] font-medium mb-4">
                            {instr.text}
                          </p>

                          {/* Tech Warnings */}
                          {instr.technicalWarnings && instr.technicalWarnings.length > 0 && (
                            <div className="mb-4 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                               <div className="flex items-center gap-2 mb-1.5">
                                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                                  <span className="text-xs uppercase font-bold tracking-wider text-orange-500">Chef Warnings</span>
                               </div>
                               <ul className="space-y-1">
                                  {instr.technicalWarnings.map((warn, i) => (
                                    <li key={i} className="text-sm font-medium text-orange-600 dark:text-orange-400 leading-snug">• {warn}</li>
                                  ))}
                               </ul>
                            </div>
                          )}

                          {/* Used Ingredients in this step */}
                          {instr.ingredients && instr.ingredients.length > 0 && (
                             <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-v2-border)]/50">
                                {instr.ingredients.map(ing => (
                                   <span key={ing.id} className="inline-flex items-center text-xs font-semibold bg-[var(--color-v2-background)] border border-[var(--color-v2-border)] rounded-md px-2 py-1 gap-1">
                                     {ing.quantity && <span className="text-[var(--color-v2-primary)]">{ing.quantity} {ing.unit}</span>}
                                     {ing.ingredientName}
                                   </span>
                                ))}
                             </div>
                          )}
                       </div>
                    </li>
                 ))}
               </ol>
            </div>
            
          </div>
        </div>
      </div>

      {/* 
        ==============================
        AI CHEF CHAT PANEL (Desktop Right Side)
        ==============================
      */}
      <div className={`fixed top-0 bottom-0 right-0 w-[400px] bg-[var(--color-v2-card)]/90 backdrop-blur-3xl border-l border-[var(--color-v2-border)] z-40 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] flex flex-col ${isChefChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-v2-border)] sticky top-0 bg-[var(--color-v2-card)]/50 backdrop-blur-md z-10">
           <h3 className="text-xl font-black flex items-center gap-2 -tracking-widest capitalize">
             <ChefHat className="w-5 h-5 text-[var(--color-v2-primary)]" />
             AI Chef
           </h3>
           <Button variant="ghost" className="rounded-full w-10 h-10 p-0 hover:bg-[var(--color-v2-secondary)]" onClick={() => setIsChefChatOpen(false)}>
             <ArrowLeft className="w-5 h-5" />
           </Button>
        </div>
        <div className="flex-1 overflow-hidden">
           <V2RecipeChefChat recipe={recipe} onRecipeUpdate={onUpdate} />
        </div>
      </div>

      {/* Mobile action bar has been unified into the Top Action Header */}

      {isCookingViewOpen && (
        <V2RecipeCookingView 
          recipe={recipe} 
          onClose={() => setIsCookingViewOpen(false)} 
        />
      )}

      {/* V2 Edit Dialog */}
      <V2RecipeEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        recipe={recipe}
        categories={categories}
        onSubmit={handleUpdate}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[var(--color-v2-card)] border-[var(--color-v2-border)] text-[var(--color-v2-foreground)]">
          <DialogHeader>
            <DialogTitle>Delete Recipe</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold text-[var(--color-v2-foreground)]">{recipe.title}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl border-[var(--color-v2-border)]">Cancel</Button>
            <Button variant="default" onClick={handleDelete} className="rounded-xl bg-red-600 hover:bg-red-700 text-white border-0">Delete Recipe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
