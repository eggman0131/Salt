import React from 'react';
import { RecipeHistoryEntry } from '../../../types/contract';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Badge } from '../../../components/ui/badge';
import { Clock, User } from 'lucide-react';
import { Separator } from '../../../components/ui/separator';

interface RecipeHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history?: RecipeHistoryEntry[];
  onRestore: (entry: RecipeHistoryEntry) => void;
}

export const RecipeHistoryDialog: React.FC<RecipeHistoryDialogProps> = ({
  open,
  onOpenChange,
  history,
  onRestore,
}) => {
  const entries = [...(history || [])].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Recipe history
          </DialogTitle>
        </DialogHeader>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
            <Clock className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No history yet.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {entries.map((entry, idx) => (
                <div key={idx} className="group relative rounded-lg border bg-card p-4 transition-all hover:shadow-md">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold leading-none">{entry.changeDescription}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.userName || 'Chef'}
                        </span>
                        <span>•</span>
                        <span>{new Date(entry.timestamp).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                      Snapshot
                    </Badge>
                  </div>
                  
                  <Separator className="my-3 opacity-50" />
                  
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onRestore(entry)}
                      className="text-xs h-8"
                    >
                      Restore to this point
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
