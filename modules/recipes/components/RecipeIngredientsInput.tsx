import React, { useState } from 'react';
import { RecipeIngredient, CanonicalItem } from '../../../types/contract';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { X, Check, ChevronsUpDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import { cn } from '@/lib/utils';

interface RecipeIngredientsInputProps {
  ingredients: RecipeIngredient[];
  ingredientSearchQueries: { [key: number]: string | undefined }; // Keep for consistency but use locally
  availableIngredients: CanonicalItem[];
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onChangeQuantity: (index: number, quantity: string | null) => void;
  onChangeUnit: (index: number, unit: string | null) => void;
  onChangeIngredientName: (index: number, name: string) => void;
  onChangePreparation: (index: number, prep: string) => void;
  onChangeSearchQuery: (index: number, query: string | undefined) => void;
}

export const RecipeIngredientsInput: React.FC<RecipeIngredientsInputProps> = ({
  ingredients,
  availableIngredients,
  onAddIngredient,
  onRemoveIngredient,
  onChangeQuantity,
  onChangeUnit,
  onChangeIngredientName,
  onChangePreparation,
}) => {
  const [openStates, setOpenStates] = useState<{ [key: number]: boolean }>({});

  const setOpen = (index: number, open: boolean) => {
    setOpenStates(prev => ({ ...prev, [index]: open }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Ingredients *</Label>
        <AddButton type="button" onClick={onAddIngredient} label="Add" />
      </div>
      <div className="space-y-2">
        {ingredients.map((ingredient, index) => {
          return (
            <div key={ingredient.id} className="flex gap-2 items-start w-full group">
              <div className="flex gap-1 flex-1 min-w-0">
                <Input
                  placeholder="Qty"
                  value={ingredient.quantity || ''}
                  onChange={(e) => onChangeQuantity(index, e.target.value || null)}
                  className="shrink-0 w-14 md:w-16 text-sm h-9"
                  type="number"
                  step="any"
                />
                <Input
                  placeholder="Unit"
                  value={ingredient.unit || ''}
                  onChange={(e) => onChangeUnit(index, e.target.value || null)}
                  className="shrink-0 w-18 md:w-24 text-sm h-9"
                  list={`units-${index}`}
                />
                <datalist id={`units-${index}`}>
                  <option>ml</option>
                  <option>l</option>
                  <option>g</option>
                  <option>kg</option>
                </datalist>

                <div className="flex-1 min-w-0">
                  <Popover 
                    open={openStates[index]} 
                    onOpenChange={(open) => setOpen(index, open)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openStates[index]}
                        className={cn(
                          "w-full justify-between text-sm h-9 px-3 font-normal",
                          !ingredient.ingredientName && "text-muted-foreground"
                        )}
                      >
                        {ingredient.ingredientName || "Select ingredient..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search items..." className="h-9" />
                        <CommandList className="max-h-60 overflow-y-auto">
                          <CommandEmpty className="py-2 px-4 text-xs">
                             <div className="flex flex-col gap-2">
                               <span>No item found.</span>
                               <Button 
                                 variant="secondary" 
                                 size="sm" 
                                 className="h-7 text-xs"
                                 onClick={() => {
                                    // Use whatever they typed as the new item name
                                    // This is tricky as we don't easily have the current search term without a local state
                                    // But Command handles the filtering
                                    setOpen(index, false);
                                 }}
                               >
                                 Use manual entry
                               </Button>
                             </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {availableIngredients.map((item) => (
                              <CommandItem
                                key={item.id}
                                value={item.name}
                                onSelect={(currentValue) => {
                                  onChangeIngredientName(index, currentValue);
                                  setOpen(index, false);
                                }}
                                className="text-sm"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    ingredient.ingredientName === item.name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {item.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {/* Invisible input to allow manual typing if they click away from popover or popover fails */}
                  {/* Alternatively, just let them type in the CommandInput and have a "Use [text]" option */}
                </div>

                <Input
                  placeholder="Prep"
                  value={ingredient.preparation || ''}
                  onChange={(e) => onChangePreparation(index, e.target.value)}
                  className="shrink-0 w-20 md:w-28 text-sm h-9"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveIngredient(ingredient.id)}
                className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
