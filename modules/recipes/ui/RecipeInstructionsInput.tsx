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
          <div key={index} className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-1">
              <div className="rounded-full bg-primary/10 text-primary w-8 h-8 flex items-center justify-center font-bold text-sm shrink-0">
                {index + 1}
              </div>
            </div>
            <div className="flex-1">
              <Textarea
                value={instruction}
                onChange={(e) => onChangeInstruction(index, e.target.value)}
                placeholder="Describe this step..."
                className="min-h-[80px] w-full"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive shrink-0 mt-1"
              onClick={() => onRemoveInstruction(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
