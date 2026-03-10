import { AddButton } from '../../../components/ui/add-button';
import { Button } from '../design-system/components/Button';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../design-system/components/Label';
import { X } from 'lucide-react';

interface V2RecipeInstructionsInputProps {
  instructions: string[];
  onAddInstruction: () => void;
  onRemoveInstruction: (index: number) => void;
  onChangeInstruction: (index: number, value: string) => void;
}

export function V2RecipeInstructionsInput({
  instructions,
  onAddInstruction,
  onRemoveInstruction,
  onChangeInstruction,
}: V2RecipeInstructionsInputProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xl font-black tracking-tight text-[var(--color-v2-foreground)]">Instructions *</Label>
        <AddButton
          type="button"
          onClick={onAddInstruction}
          label="Add Step"
          className="bg-[var(--color-v2-primary)] text-white hover:bg-[var(--color-v2-primary)]/90 border-0"
        />
      </div>
      
      <div className="space-y-4">
        {instructions.length === 0 && (
          <p className="text-sm text-[var(--color-v2-muted-foreground)] italic p-4 text-center border overflow-hidden border-dashed border-[var(--color-v2-border)] rounded-2xl">
            No instructions added
          </p>
        )}
        
        {instructions.map((instruction, index) => (
          <div key={index} className="flex gap-4 items-start group">
            {/* Step Number Badge */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-v2-primary)]/10 text-[var(--color-v2-primary)] flex items-center justify-center font-bold text-sm mt-1 ring-1 ring-[var(--color-v2-primary)]/20 shadow-sm">
              {index + 1}
            </div>
            
            <div className="flex-1 relative">
              <Textarea
                value={instruction}
                onChange={(e) => onChangeInstruction(index, e.target.value)}
                placeholder="Describe this step in detail..."
                className="min-h-24 p-4 text-base bg-[var(--color-v2-card)]/50 focus:bg-[var(--color-v2-card)] transition-colors pr-12 rounded-2xl shadow-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 text-[var(--color-v2-muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemoveInstruction(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
