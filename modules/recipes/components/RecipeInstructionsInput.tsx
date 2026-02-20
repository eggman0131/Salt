import React from 'react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { Plus, X } from 'lucide-react';

interface RecipeInstructionsInputProps {
  instructions: string[];
  onAddInstruction: () => void;
  onRemoveInstruction: (index: number) => void;
  onChangeInstruction: (index: number, value: string) => void;
}

export const RecipeInstructionsInput: React.FC<RecipeInstructionsInputProps> = ({
  instructions,
  onAddInstruction,
  onRemoveInstruction,
  onChangeInstruction,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Instructions *</Label>
        <Button type="button" onClick={onAddInstruction}>
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {instructions.map((instruction, index) => (
          <div key={index} className="flex gap-1 items-start w-full">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-1">Step {index + 1}</div>
              <Textarea
                value={instruction}
                onChange={(e) => onChangeInstruction(index, e.target.value)}
                placeholder="Describe this step..."
                className="w-full text-sm"
              />
            </div>
            {instructions.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveInstruction(index)}
                className="shrink-0 mt-6"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
