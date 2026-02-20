import React from 'react';
import { Equipment } from '../../../types/contract';
import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { X } from 'lucide-react';

interface RecipeEquipmentInputProps {
  equipmentNeeded: string[];
  equipmentSearchQueries: { [key: number]: string | undefined };
  availableEquipment: Equipment[];
  onAddEquipment: () => void;
  onRemoveEquipment: (index: number) => void;
  onChangeEquipment: (index: number, value: string) => void;
  onChangeSearchQuery: (index: number, query: string | undefined) => void;
}

export const RecipeEquipmentInput: React.FC<RecipeEquipmentInputProps> = ({
  equipmentNeeded,
  equipmentSearchQueries,
  availableEquipment,
  onAddEquipment,
  onRemoveEquipment,
  onChangeEquipment,
  onChangeSearchQuery,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Equipment</Label>
        <AddButton type="button" onClick={onAddEquipment} label="Add" />
      </div>
      <div className="space-y-2">
        {equipmentNeeded.map((equipment, index) => {
          const query = equipmentSearchQueries[index];
          const showSuggestions = query && query.length > 0 && !availableEquipment.find(e => e.name === query);
          const filtered = showSuggestions
            ? availableEquipment
                .filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
                .map(e => e.name)
                .sort()
            : [];

          return (
            <div key={index} className="flex gap-1 items-start relative w-full">
              <div className="flex-1 relative min-w-0 md:flex-1">
                <Input
                  placeholder="Equipment name"
                  value={equipment}
                  onChange={(e) => onChangeEquipment(index, e.target.value)}
                  onFocus={() => onChangeSearchQuery(index, equipment || '')}
                  onBlur={() => onChangeSearchQuery(index, undefined)}
                  className="w-full text-sm"
                />
                {filtered.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-gray-950 border rounded-md shadow-lg mt-1">
                    {filtered.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          onChangeEquipment(index, name);
                          onChangeSearchQuery(index, undefined);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveEquipment(index)}
                className="shrink-0"
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
