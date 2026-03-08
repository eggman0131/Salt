import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Recipe } from '@/types/contract';

interface RecipeHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null;
  onRestore: (versionId: string) => void;
}

export function RecipeHistoryDialog({
  open,
  onOpenChange,
  recipe,
  onRestore,
}: RecipeHistoryDialogProps) {
  if (!recipe) return null;

  const history = recipe.history || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recipe History</DialogTitle>
          <DialogDescription>
            View and restore previous versions of this recipe
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history available</p>
            ) : (
              history.map((entry, index) => (
                <div key={entry.timestamp} className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      {entry.changeDescription && (
                        <p className="text-sm text-muted-foreground">
                          {entry.changeDescription}
                        </p>
                      )}
                    </div>
                    {index !== 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onRestore(entry.timestamp);
                          onOpenChange(false);
                        }}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                  {index < history.length - 1 && <Separator />}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
