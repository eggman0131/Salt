import React, { useState } from 'react';
import { EquipmentCandidate, Equipment } from '../../../types/contract';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Loader2, Search, AlertCircle } from 'lucide-react';

interface SearchCandidatesDialogProps {
  open: boolean;
  isSearching: boolean;
  candidates: EquipmentCandidate[];
  onSearch: (query: string) => void;
  onSelectCandidate: (candidate: EquipmentCandidate) => void;
  onClose: () => void;
}

export const SearchCandidatesDialog: React.FC<SearchCandidatesDialogProps> = ({
  open,
  isSearching,
  candidates,
  onSearch,
  onSelectCandidate,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    onSearch(searchQuery);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Equipment</DialogTitle>
          <DialogDescription>
            Search for equipment to add to your inventory. AI will find matching products.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 py-4 px-6">
          {/* Search input */}
          <div className="space-y-2">
            <Label htmlFor="equipment-search">Equipment name or model</Label>
            <div className="flex gap-2">
              <Input
                id="equipment-search"
                placeholder="e.g. Kenwood Mixer, Le Creuset Pot"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isSearching}
                autoFocus
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                size="icon"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Candidates list */}
          {candidates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">
                {candidates.length} result{candidates.length !== 1 ? 's' : ''} found
              </Label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {candidates.map((candidate, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectCandidate(candidate);
                      onClose();
                    }}
                    className="w-full text-left rounded-lg border border-border bg-card p-4 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {candidate.brand} {candidate.modelName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate line-clamp-2">
                          {candidate.description}
                        </p>
                      </div>
                      {candidate.category && (
                        <Badge variant="outline" className="shrink-0">
                          {candidate.category}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isSearching && candidates.length === 0 && searchQuery.trim() && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No results found. Try a different search query.
              </p>
            </div>
          )}

          {!isSearching && searchQuery.trim() === '' && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Enter equipment name or model to search
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface DeleteConfirmDialogProps {
  open: boolean;
  equipment: Equipment | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  equipment,
  isDeleting,
  onConfirm,
  onClose,
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Delete Equipment?
          </DialogTitle>
        </DialogHeader>

        {equipment && (
          <div className="space-y-4 py-4">
            <p className="text-sm">
              Are you sure you want to delete{' '}
              <strong>{equipment.name}</strong>? This action cannot be undone.
            </p>
            {equipment.accessories && equipment.accessories.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-900">
                  This equipment has {equipment.accessories.length} accessory
                  {equipment.accessories.length !== 1 ? 'ies' : ''} associated with it.
                  These will also be deleted.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
