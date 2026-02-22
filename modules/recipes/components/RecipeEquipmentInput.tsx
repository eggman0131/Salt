import React, { useState } from 'react';
import { Equipment } from '../../../types/contract';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { X, Check, ChevronsUpDown } from 'lucide-react';
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

interface RecipeEquipmentInputProps {
  equipmentNeeded: string[];
  equipmentSearchQueries: { [key: number]: string | undefined }; // Keep prop for component stability
  availableEquipment: Equipment[];
  onAddEquipment: () => void;
  onRemoveEquipment: (index: number) => void;
  onChangeEquipment: (index: number, value: string) => void;
  onChangeSearchQuery: (index: number, query: string | undefined) => void;
}

export const RecipeEquipmentInput: React.FC<RecipeEquipmentInputProps> = ({
  equipmentNeeded,
  availableEquipment,
  onAddEquipment,
  onRemoveEquipment,
  onChangeEquipment,
}) => {
  const [openStates, setOpenStates] = useState<{ [key: number]: boolean }>({});

  const setOpen = (index: number, open: boolean) => {
    setOpenStates(prev => ({ ...prev, [index]: open }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Equipment Required</Label>
        <AddButton type="button" onClick={onAddEquipment} label="Add" />
      </div>
      <div className="space-y-2">
        {equipmentNeeded.map((equipment, index) => {
          return (
            <div key={index} className="flex gap-2 items-start relative w-full group">
              <div className="flex-1 relative min-w-0">
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
                        !equipment && "text-muted-foreground"
                      )}
                    >
                      {equipment || "Select equipment..."}
                      <Check className="hidden" /> {/* Added check for consistency if needed */}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search inventory..." className="h-9" />
                      <CommandList className="max-h-60 overflow-y-auto">
                        <CommandEmpty className="py-2 px-4 text-xs font-medium">No results found.</CommandEmpty>
                        <CommandGroup>
                          {availableEquipment.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={item.name}
                              onSelect={(currentValue) => {
                                onChangeEquipment(index, currentValue);
                                setOpen(index, false);
                              }}
                              className="text-sm"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  equipment === item.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{item.name}</span>
                                {item.brand && (
                                  <span className="text-[10px] text-muted-foreground uppercase">{item.brand} ({item.modelName})</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveEquipment(index)}
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
