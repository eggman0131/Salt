import React, { useState, useEffect } from 'react';
import type { Recipe, RecipeCategory, RecipeIngredient, Equipment } from '../../../types/contract';
import type { RecipeSaveProgress } from '../../../modules/recipes/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../design-system/components/Dialog';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../design-system/components/Button';
import { Input } from '../design-system/components/Input';
import { Label } from '../design-system/components/Label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { Badge } from '../design-system/components/Badge';
import { X, Clock8, ChefHat, Loader2 } from 'lucide-react';
import { CategoryPicker } from '../../../modules/recipes/ui/CategoryPicker';
import { V2RecipeIngredientsInput } from './V2RecipeIngredientsInput';
import { V2RecipeEquipmentInput } from './V2RecipeEquipmentInput';
import { V2RecipeInstructionsInput } from './V2RecipeInstructionsInput';
import { v4 as uuidv4 } from 'uuid';
import { getInventory } from '../../../modules/inventory/api';
import { getCanonUnits, getCanonItems } from '../../../modules/canon/api';
import type { CanonItem } from '../../../modules/canon/api';

interface V2RecipeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RecipeCategory[];
  onSubmit: (
    recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => Promise<void>;
  recipe?: Recipe;
}

export function V2RecipeEditDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
  recipe,
}: V2RecipeEditDialogProps) {
  const isEditMode = !!recipe;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [totalTime, setTotalTime] = useState('');
  const [servings, setServings] = useState('');
  const [complexity, setComplexity] = useState<'Beginner' | 'Simple' | 'Intermediate' | 'Hard' | 'Technical'>('Simple');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveProgress, setSaveProgress] = useState<RecipeSaveProgress | null>(null);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [equipmentSearchQueries, setEquipmentSearchQueries] = useState<{ [key: number]: string | undefined }>({});
  const [units, setUnits] = useState<any[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [canonItems, setCanonItems] = useState<CanonItem[]>([]);

  // Time format helpers
  const durationToTimeFormat = (duration: string | undefined): string => {
    if (!duration) return '00:00';
    const hourMatch = duration.match(/(\d+)\s*hour/i);
    const minMatch = duration.match(/(\d+)\s*min/i);
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const mins = minMatch ? parseInt(minMatch[1]) : 0;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const timeFormatToDuration = (timeStr: string): string => {
    if (!timeStr) return '0 mins';
    const [hours, mins] = timeStr.split(':').map(Number);
    if (hours === 0 && mins === 0) return '0 mins';
    if (hours === 0) return `${mins} min${mins !== 1 ? 's' : ''}`;
    if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  };

  const addTimeStrings = (time1: string, time2: string): string => {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    let totalHours = h1 + h2;
    let totalMins = m1 + m2;
    if (totalMins >= 60) {
      totalHours += Math.floor(totalMins / 60);
      totalMins = totalMins % 60;
    }
    return `${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')}`;
  };

  // Initialize
  useEffect(() => {
    if (recipe && open) {
      setTitle(recipe.title || '');
      setDescription(recipe.description || '');
      setPrepTime(durationToTimeFormat(recipe.prepTime));
      setCookTime(durationToTimeFormat(recipe.cookTime));
      setTotalTime(durationToTimeFormat(recipe.totalTime));
      setServings(recipe.servings || '');
      setComplexity(recipe.complexity || 'Simple');
      setSelectedCategoryIds(recipe.categoryIds || []);
      
      const ingredientsWithoutEditFlag = (recipe.ingredients || []).map(ing => {
        const { edited, ...rest } = ing as any;
        return rest;
      });
      setIngredients(ingredientsWithoutEditFlag.length > 0 ? ingredientsWithoutEditFlag : [createEmptyIngredient()]);
      
      const instructionTexts = (recipe.instructions || []).map((instr: any) => instr.text || instr);
      setInstructions(instructionTexts.length > 0 ? instructionTexts : ['']);
      setEquipmentNeeded(recipe.equipmentNeeded && recipe.equipmentNeeded.length > 0 ? recipe.equipmentNeeded : ['']);
    } else if (open) {
      resetForm();
    }
  }, [recipe, open]);

  // Calc total time
  useEffect(() => {
    if (prepTime && cookTime) {
      setTotalTime(addTimeStrings(prepTime, cookTime));
    }
  }, [prepTime, cookTime]);

  // Load backend constraints
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        try {
          const [equipment, unitsData, canonItemsData] = await Promise.all([
            getInventory(),
            getCanonUnits(),
            getCanonItems()
          ]);
          setAvailableEquipment(equipment);
          setUnits(unitsData);
          setCanonItems(canonItemsData);
        } catch (error) {
          console.error('Failed to load data:', error);
        }
      };
      loadData();
    }
  }, [open]);

  const createEmptyIngredient = (): RecipeIngredient => ({
    id: uuidv4(),
    raw: '',
    quantity: null,
    unit: null,
    ingredientName: '',
    preparation: '',
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrepTime('');
    setCookTime('');
    setTotalTime('');
    setServings('');
    setComplexity('Simple');
    setSelectedCategoryIds([]);
    setIngredients([createEmptyIngredient()]);
    setInstructions(['']);
    setEquipmentNeeded(['']);
    setSaveProgress(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const validIngredients = ingredients.filter(ing => 
      (ing.raw && ing.raw.trim() !== '') || ing.ingredientName.trim() !== ''
    ).map(ing => {
      if (ing.raw && ing.raw.trim() !== '') {
        return ing;
      }
      
      const rawParts: string[] = [];
      if (ing.quantity != null) rawParts.push(String(ing.quantity));
      if (ing.unit != null && ing.unit !== '') rawParts.push(ing.unit);
      if (ing.ingredientName) rawParts.push(ing.ingredientName);
      if (ing.preparation != null && ing.preparation !== '') rawParts.push(ing.preparation);
      
      return {
        ...ing,
        raw: rawParts.join(' ').trim(),
      };
    });

    const validInstructions = instructions.filter(inst => inst.trim() !== '');
    const validEquipment = equipmentNeeded.filter(eq => eq.trim() !== '');

    if (validIngredients.length === 0 || validInstructions.length === 0) return;

    const ingredientsForBackend = validIngredients.map(ing => {
      const isMinimallyStructured = !ing.quantity && !ing.unit;
      return isMinimallyStructured ? ing.raw : ing;
    });

    setIsSubmitting(true);
    setSaveProgress({ stage: 'Preparing recipe', percentage: 0 });
    
    try {
      const recipeData: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'> = {
        title: title.trim(),
        description: description.trim(),
        prepTime: timeFormatToDuration(prepTime) || '0 mins',
        cookTime: timeFormatToDuration(cookTime) || '0 mins',
        totalTime: timeFormatToDuration(totalTime) || '0 mins',
        servings: servings.trim() || '1',
        complexity,
        categoryIds: selectedCategoryIds,
        ingredients: ingredientsForBackend as any,
        instructions: validInstructions as any,
        equipmentNeeded: validEquipment,
      };

      await onSubmit(recipeData, (progress) => {
        setSaveProgress(progress);
      });
      if (!isEditMode) resetForm(); // Only reset on create
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
      setSaveProgress(null);
    }
  };

  // Ingredient handlers
  const addIngredient = () => setIngredients([...ingredients, createEmptyIngredient()]);
  const removeIngredient = (index: number) => setIngredients(ingredients.filter((_, i) => i !== index));
  const removeIngredientById = (id: string) => {
    const index = ingredients.findIndex(ing => ing.id === id);
    if (index !== -1) removeIngredient(index);
  };
  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value, edited: true };
    setIngredients(updated);
  };

  // Instruction handlers
  const addInstruction = () => setInstructions([...instructions, '']);
  const removeInstruction = (index: number) => setInstructions(instructions.filter((_, i) => i !== index));
  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  // Equipment handlers
  const addEquipment = () => setEquipmentNeeded([...equipmentNeeded, '']);
  const removeEquipment = (index: number) => setEquipmentNeeded(equipmentNeeded.filter((_, i) => i !== index));
  const updateEquipment = (index: number, value: string) => {
    const updated = [...equipmentNeeded];
    updated[index] = value;
    setEquipmentNeeded(updated);
  };
  const setEquipmentSearchQuery = (index: number, query: string | undefined) => {
    if (query === undefined) {
      setEquipmentSearchQueries(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    } else {
      setEquipmentSearchQueries(prev => ({ ...prev, [index]: query }));
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] h-[95vh] p-0 flex flex-col xl:rounded-[2rem] overflow-hidden bg-[var(--color-v2-background)] border-[var(--color-v2-border)] shadow-2xl">
        <DialogHeader className="pt-8 px-10 pb-6 shrink-0 border-b border-[var(--color-v2-border)] bg-[var(--color-v2-card)]/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-v2-primary)]/10 flex items-center justify-center">
              <ChefHat className="w-7 h-7 text-[var(--color-v2-primary)]" />
            </div>
            <div>
              <DialogTitle className="text-3xl font-black tracking-tight text-[var(--color-v2-foreground)]">
                {isEditMode ? 'Edit Recipe' : 'Design Recipe'}
              </DialogTitle>
              <DialogDescription className="text-[var(--color-v2-muted-foreground)] text-base mt-1">
                {isEditMode ? 'Refine the details of your culinary creation.' : 'Structure a new recipe for your collection.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 md:px-10 py-8">
          <div className="max-w-4xl mx-auto space-y-12">
            
            {/* Meta Data Section */}
            <section className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="title" className="text-xl font-black tracking-tight text-[var(--color-v2-foreground)]">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Thai Green Curry"
                  required
                  className="text-2xl font-bold h-16 px-6 focus:ring-[var(--color-v2-primary)]/30 rounded-2xl bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)]"
                />
              </div>

              <div className="space-y-4">
                <Label htmlFor="description" className="text-xl font-black tracking-tight text-[var(--color-v2-foreground)]">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short, enticing summary of this dish..."
                  required
                  className="min-h-32 text-lg p-6 focus:ring-[var(--color-v2-primary)]/30 rounded-2xl bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)] leading-relaxed"
                />
              </div>

              {/* Grid 1: Times & Servings */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="prepTime" className="text-sm font-bold uppercase tracking-wider text-[var(--color-v2-muted-foreground)]">Prep Time</Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Clock8 className="size-5 text-[var(--color-v2-primary)]/70" />
                    </div>
                    <Input
                      type="time"
                      id="prepTime"
                      value={prepTime}
                      onChange={(e) => setPrepTime(e.target.value)}
                      className="peer h-14 pl-12 text-lg font-medium rounded-xl bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="cookTime" className="text-sm font-bold uppercase tracking-wider text-[var(--color-v2-muted-foreground)]">Cook Time</Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Clock8 className="size-5 text-[var(--color-v2-primary)]/70" />
                    </div>
                    <Input
                      type="time"
                      id="cookTime"
                      value={cookTime}
                      onChange={(e) => setCookTime(e.target.value)}
                      className="peer h-14 pl-12 text-lg font-medium rounded-xl bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="totalTime" className="text-sm font-bold uppercase tracking-wider text-[var(--color-v2-muted-foreground)]">Total Time</Label>
                  <div className="relative opacity-70">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Clock8 className="size-5 text-[var(--color-v2-muted-foreground)]" />
                    </div>
                    <Input
                      type="time"
                      id="totalTime"
                      value={totalTime}
                      disabled
                      className="peer h-14 pl-12 text-lg font-medium rounded-xl border-[var(--color-v2-border)] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none bg-transparent"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="servings" className="text-sm font-bold uppercase tracking-wider text-[var(--color-v2-muted-foreground)]">Yield / Servings</Label>
                  <Input
                    id="servings"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    placeholder="e.g. 4 people"
                    className="h-14 text-lg font-medium rounded-xl bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)] px-4"
                  />
                </div>
              </div>

              {/* Grid 2: Complexity & Categorization */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                <div className="space-y-3">
                  <Label htmlFor="complexity" className="text-sm font-bold uppercase tracking-wider text-[var(--color-v2-muted-foreground)]">Complexity</Label>
                  <Select value={complexity} onValueChange={(value: any) => setComplexity(value)}>
                    <SelectTrigger id="complexity" className="h-14 text-lg font-medium rounded-xl bg-[var(--color-v2-card)]/50 border-[var(--color-v2-border)] px-4">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start" className="rounded-xl border-[var(--color-v2-border)] bg-[var(--color-v2-card)]">
                      <SelectItem value="Beginner" className="py-3 text-base lg:cursor-pointer pl-8">Beginner</SelectItem>
                      <SelectItem value="Simple" className="py-3 text-base lg:cursor-pointer pl-8">Simple</SelectItem>
                      <SelectItem value="Intermediate" className="py-3 text-base lg:cursor-pointer pl-8">Intermediate</SelectItem>
                      <SelectItem value="Hard" className="py-3 text-base lg:cursor-pointer pl-8">Hard</SelectItem>
                      <SelectItem value="Technical" className="py-3 text-base lg:cursor-pointer pl-8">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <Label className="text-sm font-bold uppercase tracking-wider text-[var(--color-v2-muted-foreground)]">Categories</Label>
                    <AddButton
                      type="button"
                      onClick={() => setShowCategoryPicker(true)}
                      label="Manage"
                      className="bg-[var(--color-v2-primary)] text-white hover:bg-[var(--color-v2-primary)]/90 border-0"
                    />
                  </div>
                  <div className="min-h-14 p-2 rounded-xl bg-[var(--color-v2-card)]/50 border border-[var(--color-v2-border)] flex flex-wrap gap-2 items-center">
                    {selectedCategoryIds.length === 0 && (
                      <span className="text-[var(--color-v2-muted-foreground)] italic text-sm pl-2">None selected</span>
                    )}
                    {selectedCategoryIds.map(categoryId => {
                      const category = categories.find(c => c.id === categoryId);
                      return category ? (
                        <Badge
                          key={categoryId}
                          variant="secondary"
                          className="pl-3 pr-2 py-1.5 text-sm bg-[var(--color-v2-primary)]/10 text-[var(--color-v2-primary)] hover:bg-[var(--color-v2-primary)]/20 cursor-pointer rounded-lg border-none"
                          onClick={() => toggleCategory(categoryId)}
                        >
                          {category.name}
                          <X className="ml-1.5 h-3.5 w-3.5 opacity-70" />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </section>

            <Separator className="border-[var(--color-v2-border)]/60" />

            <section className="space-y-6">
              <V2RecipeIngredientsInput
                ingredients={ingredients}
                units={units}
                canonItems={canonItems}
                onAddIngredient={addIngredient}
                onRemoveIngredient={removeIngredientById}
                onChangeQuantity={(index, quantity) => updateIngredient(index, 'quantity', quantity !== '' ? Number(quantity) : null)}
                onChangeUnit={(index, unit) => updateIngredient(index, 'unit', unit)}
                onChangeIngredientName={(index, name) => updateIngredient(index, 'ingredientName', name)}
                onChangeQualifiers={(index, qualifiers) => updateIngredient(index, 'qualifiers', qualifiers)}
                onChangePreparation={(index, prep) => updateIngredient(index, 'preparation', prep)}
                onChangeRaw={(index, raw) => updateIngredient(index, 'raw', raw)}
                onChangeCanonItem={(index, id) => updateIngredient(index, 'canonicalItemId', id)}
              />
            </section>

            <Separator className="border-[var(--color-v2-border)]/60" />

            <section className="space-y-6">
              <V2RecipeInstructionsInput
                instructions={instructions}
                onAddInstruction={addInstruction}
                onRemoveInstruction={removeInstruction}
                onChangeInstruction={updateInstruction}
              />
            </section>

            <Separator className="border-[var(--color-v2-border)]/60" />

            <section className="space-y-6 pb-12">
              <V2RecipeEquipmentInput
                equipmentNeeded={equipmentNeeded}
                equipmentSearchQueries={equipmentSearchQueries}
                availableEquipment={availableEquipment}
                onAddEquipment={addEquipment}
                onRemoveEquipment={removeEquipment}
                onChangeEquipment={updateEquipment}
                onChangeSearchQuery={setEquipmentSearchQuery}
              />
            </section>
          </div>
        </form>

        <div className="px-6 md:px-10 py-5 border-t border-[var(--color-v2-border)] shrink-0 flex items-center justify-between bg-[var(--color-v2-card)]/80 backdrop-blur-3xl z-10 rounded-b-[2rem]">
          <div className="flex-1">
            {isSubmitting && saveProgress && (
              <div className="flex items-center text-sm font-medium text-[var(--color-v2-primary)] animate-pulse">
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                {saveProgress.stage}
                {typeof saveProgress.percentage === 'number' ? ` (${saveProgress.percentage}%)` : ''}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={isSubmitting}
              className="px-6 h-12 rounded-xl text-base font-semibold border-[var(--color-v2-border)]"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="px-8 h-12 rounded-xl text-base font-bold text-white bg-[var(--color-v2-primary)] hover:bg-[var(--color-v2-primary)]/90 shadow-lg shadow-[var(--color-v2-primary)]/20 hover:shadow-[var(--color-v2-primary)]/40 transition-shadow border-0"
            >
              {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Recipe')}
            </Button>
          </div>
        </div>
      </DialogContent>

      <CategoryPicker
        open={showCategoryPicker}
        onOpenChange={setShowCategoryPicker}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onToggle={toggleCategory}
      />
    </Dialog>
  );
}
