import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { Progress } from '../../../components/ui/progress';
import { Wrench } from 'lucide-react';

interface RepairRecipeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRepair: (options: { categorize: boolean; relinkIngredients: boolean }) => void;
  isRepairing?: boolean;
  progress?: { stage: string; percentage: number };
}

export const RepairRecipeModal: React.FC<RepairRecipeModalProps> = ({
  open,
  onOpenChange,
  onRepair,
  isRepairing = false,
  progress,
}) => {
  const [categorize, setCategorize] = React.useState(false);
  const [relinkIngredients, setRelinkIngredients] = React.useState(false);

  const handleRepair = () => {
    onRepair({ categorize, relinkIngredients });
  };

  const nothingSelected = !categorize && !relinkIngredients;

  // Reset selections when dialog opens
  React.useEffect(() => {
    if (open) {
      setCategorize(false);
      setRelinkIngredients(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Repair Recipe
          </DialogTitle>
          <DialogDescription>
            Select the repair operations to run on this recipe
          </DialogDescription>
        </DialogHeader>

        {progress && progress.percentage > 0 && progress.percentage < 100 && (
          <div className="space-y-2 py-4 border-t">
            <p className="text-sm text-muted-foreground">{progress.stage}</p>
            <Progress value={progress.percentage} className="w-full" />
            <p className="text-xs text-muted-foreground text-right">{progress.percentage}%</p>
          </div>
        )}

        <div className="space-y-4 py-4">
          <div
            className={`flex items-start gap-3 rounded-lg border-2 p-4 transition-colors ${
              categorize
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/30'
            }`}
          >
            <Checkbox
              id="categorize"
              checked={categorize}
              onCheckedChange={(checked: boolean) => setCategorize(checked as boolean)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="categorize"
                className="cursor-pointer font-semibold leading-none"
              >
                Re-categorise Recipe
              </Label>
              <p className="text-xs text-muted-foreground">
                Use AI to refresh the category assignments based on current recipe content
              </p>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 rounded-lg border-2 p-4 transition-colors ${
              relinkIngredients
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/30'
            }`}
          >
            <Checkbox
              id="relinkIngredients"
              checked={relinkIngredients}
              onCheckedChange={(checked: boolean) => setRelinkIngredients(checked as boolean)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="relinkIngredients"
                className="cursor-pointer font-semibold leading-none"
              >
                Relink Ingredients
              </Label>
              <p className="text-xs text-muted-foreground">
                Match ingredients to canonical items and create missing entries
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRepairing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRepair}
            disabled={nothingSelected || isRepairing}
            className="flex-1"
          >
            {isRepairing ? 'Repairing...' : 'Run Repair'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
