import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface RecipeInstructionsInputProps {
  instructions: string[];
  onAddInstruction: () => void;
  onRemoveInstruction: (index: number) => void;
  onChangeInstruction: (index: number, value: string) => void;
}

export function RecipeInstructionsInput({
  instructions,
  onAddInstruction,
  onRemoveInstruction,
  onChangeInstruction,
}: RecipeInstructionsInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Instructions *</Label>
        <AddButton
          type="button"
          onClick={onAddInstruction}
          label="Add Instruction"
        />
      </div>
      <div className="space-y-3">
        {instructions.length === 0 && (
          <p className="text-sm text-muted-foreground">No instructions added</p>
        )}
        {instructions.map((instruction, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="w-16">Step {index + 1}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveInstruction(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={instruction}
              onChange={(e) => onChangeInstruction(index, e.target.value)}
              placeholder="Describe this step..."
              className="min-h-[80px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
