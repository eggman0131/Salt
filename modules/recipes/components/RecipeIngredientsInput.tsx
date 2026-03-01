import React, { useState } from 'react';
import { RecipeIngredient, CanonicalItem } from '../../../types/contract';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Combobox } from '../../../components/ui/combobox';
import { X, Check, ChevronsUpDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../components/ui/command';
import { cn } from '@/lib/utils';

interface RecipeIngredientsInputProps {
  ingredients: RecipeIngredient[];
  ingredientSearchQueries: { [key: number]: string | undefined }; // Keep for consistency but use locally
  availableIngredients: CanonicalItem[];
  units: any[];
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onChangeQuantity: (index: number, quantity: string | null) => void;
  onChangeUnit: (index: number, unit: string | null) => void;
  onChangeIngredientName: (index: number, name: string) => void;
  onChangeQualifiers: (index: number, qualifiers: string[]) => void;
  onChangePreparation: (index: number, prep: string) => void;
  onChangeSearchQuery: (index: number, query: string | undefined) => void;
}

export const RecipeIngredientsInput: React.FC<RecipeIngredientsInputProps> = ({
  ingredients,
  availableIngredients,
  units,
  onAddIngredient,
  onRemoveIngredient,
  onChangeQuantity,
  onChangeUnit,
  onChangeIngredientName,
  onChangeQualifiers,
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
                <Combobox
                  options={units.map(u => ({ value: u.name, label: u.name }))}
                  value={ingredient.unit || ''}
                  onValueChange={(value) => onChangeUnit(index, value || null)}
                  placeholder="Unit"
                  searchPlaceholder="Search units..."
                  emptyMessage="No unit found."
                  allowClear={true}
                  className="shrink-0 w-18 md:w-24"
                />

                <div className="flex-1 min-w-0 relative">
                  <Input
                    placeholder="Ingredient name"
                    value={ingredient.ingredientName || ''}
                    onChange={(e) => {
                      onChangeIngredientName(index, e.target.value);
                      setOpen(index, true); // Open suggestions as they type
                    }}
                    onFocus={() => setOpen(index, true)}
                    className="text-sm h-9 pr-8"
                  />
                  <Popover 
                    open={openStates[index]} 
                    onOpenChange={(open) => setOpen(index, open)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-9 w-8 hover:bg-transparent"
                        aria-label="Toggle ingredient suggestions"
                      >
                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandList className="max-h-60 overflow-y-auto">
                          <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                            No matching items found.
                          </CommandEmpty>
                          <CommandGroup>
                            {availableIngredients
                              .filter(item => {
                                const search = ingredient.ingredientName?.toLowerCase() || '';
                                return !search || item.name.toLowerCase().includes(search);
                              })
                              .map((item) => (
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
                </div>

                <Input
                  placeholder="Qualifiers"
                  value={ingredient.qualifiers?.join(', ') || ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    const qualifiers = value ? value.split(',').map(q => q.trim()).filter(q => q) : [];
                    onChangeQualifiers(index, qualifiers);
                  }}
                  className="shrink-0 w-24 md:w-32 text-sm h-9"
                  title="e.g., fresh, organic, red (comma-separated)"
                />

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
