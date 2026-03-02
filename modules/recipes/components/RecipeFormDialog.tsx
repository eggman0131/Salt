import React, { useState, useEffect } from 'react';
import { Recipe, RecipeCategory, RecipeIngredient, RecipeInstruction } from '../../../types/contract';
import type { RecipeSaveProgress } from '../backend/recipes-backend.interface';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { Badge } from '../../../components/ui/badge';
import { X, Clock8 } from 'lucide-react';
import { CategoryPicker } from './CategoryPicker';
import { RecipeIngredientsInput } from './RecipeIngredientsInput';
import { RecipeEquipmentInput } from './RecipeEquipmentInput';
import { RecipeInstructionsInput } from './RecipeInstructionsInput';
import { v4 as uuidv4 } from 'uuid';
import { inventoryBackend } from '../../inventory';
import { canonBackend } from '../../canon';
import type { Equipment, CanonicalItem } from '../../../types/contract';

interface RecipeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RecipeCategory[];
  onSubmit: (
    recipe: Omit<Recipe, 'id' | 'createdAt' | 'createdBy' | 'imagePath'>,
    onProgress?: (progress: RecipeSaveProgress) => void
  ) => Promise<void>;
  recipe?: Recipe; // For edit mode
}

export const RecipeFormDialog: React.FC<RecipeFormDialogProps> = ({
  open,
  onOpenChange,
  categories,
  onSubmit,
  recipe,
}) => {
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

  // Helper: Convert "20 mins", "1 hour 30 mins", etc to "HH:MM"
  const durationToTimeFormat = (duration: string): string => {
    if (!duration) return '00:00';
    const hourMatch = duration.match(/(\d+)\s*hour/i);
    const minMatch = duration.match(/(\d+)\s*min/i);
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const mins = minMatch ? parseInt(minMatch[1]) : 0;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Helper: Convert "HH:MM" to "20 mins", "1 hour 30 mins", etc
  const timeFormatToDuration = (timeStr: string): string => {
    if (!timeStr) return '0 mins';
    const [hours, mins] = timeStr.split(':').map(Number);
    if (hours === 0 && mins === 0) return '0 mins';
    if (hours === 0) return `${mins} min${mins !== 1 ? 's' : ''}`;
    if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  };

  // Helper: Add two time strings (HH:MM format)
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


  // Initialize form with recipe data in edit mode
  useEffect(() => {
    if (recipe) {
      setTitle(recipe.title);
      setDescription(recipe.description);
      setPrepTime(durationToTimeFormat(recipe.prepTime));
      setCookTime(durationToTimeFormat(recipe.cookTime));
      setTotalTime(durationToTimeFormat(recipe.totalTime));
      setServings(recipe.servings);
      setComplexity(recipe.complexity);
      setSelectedCategoryIds(recipe.categoryIds || []);
      // Clear the edited flag when loading existing ingredients
      const ingredientsWithoutEditFlag = recipe.ingredients.map(ing => {
        const { edited, ...rest } = ing;
        return rest;
      });
      setIngredients(ingredientsWithoutEditFlag.length > 0 ? ingredientsWithoutEditFlag : [createEmptyIngredient()]);
      // Issue #57: Extract instruction texts from RecipeInstruction objects
      const instructionTexts = recipe.instructions.map((instr: RecipeInstruction) => instr.text);
      setInstructions(instructionTexts.length > 0 ? instructionTexts : ['']);
      setEquipmentNeeded(recipe.equipmentNeeded && recipe.equipmentNeeded.length > 0 ? recipe.equipmentNeeded : ['']);
    } else {
      resetForm();
    }
  }, [recipe, open]);


  // Auto-calculate total time from prep + cook time
  useEffect(() => {
    if (prepTime && cookTime) {
      const calculated = addTimeStrings(prepTime, cookTime);
      setTotalTime(calculated);
    }
  }, [prepTime, cookTime]);

  // Load available equipment, ingredients, and units on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [equipment, unitsData] = await Promise.all([
          inventoryBackend.getInventory(),
          canonBackend.getUnits()
        ]);
        setAvailableEquipment(equipment);
        setUnits(unitsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

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
    
    // Validation
    if (!title.trim() || !description.trim()) {
      return;
    }

    // Filter out empty ingredients
    const validIngredients = ingredients.filter(ing => 
      ing.ingredientName.trim() !== ''
    ).map(ing => {
      // Build raw string carefully without null interpolation
      const rawParts: string[] = [];
      if (ing.quantity != null) rawParts.push(String(ing.quantity));
      if (ing.unit != null && ing.unit !== '') rawParts.push(ing.unit);
      rawParts.push(ing.ingredientName);
      if (ing.preparation != null && ing.preparation !== '') rawParts.push(ing.preparation);
      
      return {
        ...ing,
        raw: rawParts.join(' ').trim(),
      };
    });

    // Filter out empty instructions
    const validInstructions = instructions.filter(inst => inst.trim() !== '');

    // Filter out empty equipment
    const validEquipment = equipmentNeeded.filter(eq => eq.trim() !== '');

    if (validIngredients.length === 0 || validInstructions.length === 0) {
      return;
    }

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
        ingredients: validIngredients,
        instructions: validInstructions,
        equipmentNeeded: validEquipment,
      };

      await onSubmit(recipeData, (progress) => {
        setSaveProgress(progress);
      });
      resetForm();
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
      setSaveProgress(null);
    }
  };

  // Ingredient handlers
  const addIngredient = () => {
    setIngredients([...ingredients, createEmptyIngredient()]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value, edited: true };
    setIngredients(updated);
  };

  // Instruction handlers
  const addInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  // Equipment handlers
  const addEquipment = () => {
    setEquipmentNeeded([...equipmentNeeded, '']);
  };

  const removeEquipment = (index: number) => {
    setEquipmentNeeded(equipmentNeeded.filter((_, i) => i !== index));
  };

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
      setEquipmentSearchQueries(prev => ({
        ...prev,
        [index]: query
      }));
    }
  };

  const getFilteredEquipment = (index: number) => {
    const query = equipmentSearchQueries[index];
    // Only show suggestions if actively searching (query is defined and not empty)
    const showSuggestions = query && query.length > 0 && !availableEquipment.find(eq => eq.name === query);
    if (!showSuggestions) return [];
    
    return availableEquipment.filter(eq =>
      eq.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  const setIngredientSearchQuery = (index: number, query: string | undefined) => {
    if (query === undefined) {
      setIngredientSearchQueries(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    } else {
      setIngredientSearchQueries(prev => ({
        ...prev,
        [index]: query
      }));
    }
  };

  // Category toggle
  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Remove ingredient by ID (wrapper for extracted component)
  const removeIngredientById = (id: string) => {
    const index = ingredients.findIndex(ing => ing.id === id);
    if (index !== -1) {
      removeIngredient(index);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-0.5rem)] max-w-3xl max-h-[90vh] p-0 flex flex-col">
        <div className="pl-3 pr-1 md:px-6 pt-6 shrink-0">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Recipe' : 'Create Recipe'}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEditMode ? 'Edit the recipe details' : 'Create a new recipe with ingredients, instructions, and equipment'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto pl-3 pr-1 md:px-6 pb-6">
          {/* Metadata Section */}
          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Thai Green Curry"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the recipe"
                required
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="prepTime">Prep Time</Label>
                <div className="relative">
                  <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
                    <Clock8 className="size-4" />
                  </div>
                  <Input
                    type="time"
                    id="prepTime"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cookTime">Cook Time</Label>
                <div className="relative">
                  <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
                    <Clock8 className="size-4" />
                  </div>
                  <Input
                    type="time"
                    id="cookTime"
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value)}
                    className="peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="totalTime">Total Time</Label>
                <div className="relative">
                  <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
                    <Clock8 className="size-4" />
                  </div>
                  <Input
                    type="time"
                    id="totalTime"
                    value={totalTime}
                    disabled
                    className="peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="servings">Servings</Label>
                <Input
                  id="servings"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="4 people"
                />
              </div>
            </div>

            <div className="w-full">
              <div>
                <Label htmlFor="complexity">Complexity</Label>
                <Select value={complexity} onValueChange={(value: any) => setComplexity(value)}>
                  <SelectTrigger id="complexity" className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Simple">Simple</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Categories</Label>
                <AddButton
                  type="button"
                  onClick={() => setShowCategoryPicker(true)}
                  label="Add"
                />
              </div>
              {selectedCategoryIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedCategoryIds.map(categoryId => {
                    const category = categories.find(c => c.id === categoryId);
                    return category ? (
                      <Badge
                        key={categoryId}
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80"
                        onClick={() => toggleCategory(categoryId)}
                      >
                        {category.name}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          <RecipeIngredientsInput
            ingredients={ingredients}
            units={units}
            onAddIngredient={addIngredient}
            onRemoveIngredient={removeIngredientById}
            onChangeQuantity={(index, quantity) => updateIngredient(index, 'quantity', quantity !== '' ? Number(quantity) : null)}
            onChangeUnit={(index, unit) => updateIngredient(index, 'unit', unit)}
            onChangeIngredientName={(index, name) => updateIngredient(index, 'ingredientName', name)}
            onChangeQualifiers={(index, qualifiers) => updateIngredient(index, 'qualifiers', qualifiers)}
            onChangePreparation={(index, prep) => updateIngredient(index, 'preparation', prep)}
          />

          <Separator className="my-4" />

          <RecipeInstructionsInput
            instructions={instructions}
            onAddInstruction={addInstruction}
            onRemoveInstruction={removeInstruction}
            onChangeInstruction={updateInstruction}
          />

          <Separator className="my-4" />

          <RecipeEquipmentInput
            equipmentNeeded={equipmentNeeded}
            equipmentSearchQueries={equipmentSearchQueries}
            availableEquipment={availableEquipment}
            onAddEquipment={addEquipment}
            onRemoveEquipment={removeEquipment}
            onChangeEquipment={updateEquipment}
            onChangeSearchQuery={setEquipmentSearchQuery}
          />
          </form>

        <div className="pl-3 pr-1 md:px-6 pt-6 pb-6 border-t shrink-0 flex items-center justify-end">
          {isSubmitting && saveProgress && (
            <div className="mr-auto pr-3 text-sm text-muted-foreground">
              {saveProgress.stage}
              {typeof saveProgress.percentage === 'number' ? ` (${saveProgress.percentage}%)` : ''}
            </div>
          )}
          <DialogFooter className="flex flex-row items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving recipe...' : (isEditMode ? 'Update Recipe' : 'Create Recipe')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      {/* Category Picker Modal */}
      <CategoryPicker
        open={showCategoryPicker}
        onOpenChange={setShowCategoryPicker}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onToggle={toggleCategory}
      />
    </Dialog>
  );
};
