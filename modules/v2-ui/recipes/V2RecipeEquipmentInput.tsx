import React from 'react';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../design-system/components/Button';
import { Label } from '../design-system/components/Label';
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
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Equipment } from '../../../types/contract';

interface V2RecipeEquipmentInputProps {
  equipmentNeeded: string[];
  equipmentSearchQueries: Record<number, string>;
  availableEquipment: Equipment[];
  onAddEquipment: () => void;
  onRemoveEquipment: (index: number) => void;
  onChangeEquipment: (index: number, value: string) => void;
  onChangeSearchQuery: (index: number, query: string | undefined) => void;
}

export function V2RecipeEquipmentInput({
  equipmentNeeded,
  equipmentSearchQueries,
  availableEquipment,
  onAddEquipment,
  onRemoveEquipment,
  onChangeEquipment,
  onChangeSearchQuery,
}: V2RecipeEquipmentInputProps) {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xl font-black tracking-tight text-[var(--color-v2-foreground)]">Equipment</Label>
        <AddButton
          type="button"
          onClick={onAddEquipment}
          label="Add Equipment"
          className="bg-[var(--color-v2-primary)] text-white hover:bg-[var(--color-v2-primary)]/90 border-0"
        />
      </div>
      
      <div className="space-y-3">
        {equipmentNeeded.length === 0 && (
          <p className="text-sm text-[var(--color-v2-muted-foreground)] italic p-4 text-center border overflow-hidden border-dashed border-[var(--color-v2-border)] rounded-2xl">
            No equipment added
          </p>
        )}
        
        {equipmentNeeded.map((equipment, index) => {
          const filteredEquipment = getFilteredEquipment(index);
          const hasValue = equipment.trim().length > 0;

          return (
            <div key={index} className="flex items-center gap-3">
              <Popover
                open={openPopovers[index] || false}
                onOpenChange={(open) => setPopoverOpen(index, open)}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'flex-1 justify-between h-12 px-4 shadow-sm rounded-xl border border-[var(--color-v2-border)] bg-[var(--color-v2-card)]/50 hover:bg-[var(--color-v2-card)] hover:border-[var(--color-v2-primary)]/40 transition-all font-medium',
                      !hasValue && 'text-[var(--color-v2-muted-foreground)] font-normal'
                    )}
                  >
                    {equipment || 'Select required equipment...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1 rounded-xl shadow-xl bg-[var(--color-v2-card)] border-[var(--color-v2-border)]">
                  <Command shouldFilter={false} className="bg-transparent">
                    <CommandInput
                      placeholder="Search equipment..."
                      value={equipmentSearchQueries[index] || equipment}
                      onValueChange={(value) => {
                        onChangeSearchQuery(index, value);
                        onChangeEquipment(index, value);
                      }}
                      className="border-none focus:ring-0 rounded-lg px-3 py-2 bg-[var(--color-v2-background)]/50 mx-1 mt-1 mb-2"
                    />
                    <CommandList className="max-h-[200px] overflow-y-auto px-1 pb-1">
                      {filteredEquipment.length === 0 ? (
                        <CommandEmpty className="text-sm text-center py-4 text-[var(--color-v2-muted-foreground)]">
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
                              className="rounded-lg mb-1 aria-selected:bg-[var(--color-v2-primary)]/10 aria-selected:text-[var(--color-v2-primary)] cursor-pointer py-2.5"
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  equipment === item.name ? 'opacity-100 text-[var(--color-v2-primary)]' : 'opacity-0'
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
                size="icon"
                className="flex-shrink-0 h-10 w-10 text-[var(--color-v2-muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                onClick={() => onRemoveEquipment(index)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
