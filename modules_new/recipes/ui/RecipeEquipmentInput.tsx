import React from 'react';
import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KitchenItem } from '@/types/contract';

interface RecipeEquipmentInputProps {
  equipmentNeeded: string[];
  equipmentSearchQueries: Record<number, string>;
  availableEquipment: KitchenItem[];
  onAddEquipment: () => void;
  onRemoveEquipment: (index: number) => void;
  onChangeEquipment: (index: number, value: string) => void;
  onChangeSearchQuery: (index: number, query: string | undefined) => void;
}

export function RecipeEquipmentInput({
  equipmentNeeded,
  equipmentSearchQueries,
  availableEquipment,
  onAddEquipment,
  onRemoveEquipment,
  onChangeEquipment,
  onChangeSearchQuery,
}: RecipeEquipmentInputProps) {
  const [openPopovers, setOpenPopovers] = React.useState<Record<number, boolean>>({});

  const setPopoverOpen = (index: number, open: boolean) => {
    setOpenPopovers(prev => ({ ...prev, [index]: open }));
  };

  const getFilteredEquipment = (index: number) => {
    const query = equipmentSearchQueries[index];
    if (!query || query.length === 0) return [];
    const exactMatch = availableEquipment.find(eq => eq.name.toLowerCase() === query.toLowerCase());
    if (exactMatch) return [];
    return availableEquipment.filter(eq =>
      eq.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Equipment Needed</Label>
        <AddButton
          type="button"
          onClick={onAddEquipment}
          label="Add Equipment"
        />
      </div>
      <div className="space-y-2">
        {equipmentNeeded.length === 0 && (
          <p className="text-sm text-muted-foreground">No equipment added</p>
        )}
        {equipmentNeeded.map((equipment, index) => {
          const filteredEquipment = getFilteredEquipment(index);
          const hasValue = equipment.trim().length > 0;

          return (
            <div key={index} className="flex items-center gap-2">
              <Popover
                open={openPopovers[index] || false}
                onOpenChange={(open) => setPopoverOpen(index, open)}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'flex-1 justify-between',
                      !hasValue && 'text-muted-foreground'
                    )}
                  >
                    {equipment || 'Select equipment...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search equipment..."
                      value={equipmentSearchQueries[index] || equipment}
                      onValueChange={(value) => {
                        onChangeSearchQuery(index, value);
                        onChangeEquipment(index, value);
                      }}
                    />
                    <CommandList>
                      {filteredEquipment.length === 0 ? (
                        <CommandEmpty>
                          {hasValue ? 'No matching equipment found' : 'Start typing to search...'}
                        </CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {filteredEquipment.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={item.name}
                              onSelect={() => {
                                onChangeEquipment(index, item.name);
                                onChangeSearchQuery(index, undefined);
                                setPopoverOpen(index, false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  equipment === item.name ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {item.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveEquipment(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
