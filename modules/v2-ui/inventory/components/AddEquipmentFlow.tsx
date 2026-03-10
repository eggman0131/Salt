import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../design-system/components/Dialog';
import { Button } from '../../design-system/components/Button';
import { Input } from '../../design-system/components/Input';
import { ScrollArea } from '../../design-system/components/ScrollArea';
import { Badge } from '../../design-system/components/Badge';
import { Search, Loader2, Zap } from 'lucide-react';
import { searchEquipmentCandidates, generateEquipmentDetails, createEquipment } from '../../../inventory/api';
import { softToast } from '@/lib/soft-toast';
import { EquipmentCandidate } from '../../../inventory/types';

interface AddEquipmentFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
}

export const AddEquipmentFlow: React.FC<AddEquipmentFlowProps> = ({ open, onOpenChange, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<EquipmentCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when opened/closed
  React.useEffect(() => {
    if (open) {
      setSearchQuery('');
      setCandidates([]);
      setHasSearched(false);
    }
  }, [open]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await searchEquipmentCandidates(searchQuery.trim());
      setCandidates(results);
    } catch (err) {
      console.error('Failed to search equipment', err);
      softToast.error('Search failed', { description: 'Please try again' });
      setCandidates([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidate = async (candidate: EquipmentCandidate) => {
    setIsGenerating(true);
    try {
      const details = await generateEquipmentDetails(candidate);

      const newEquipment = {
        name: `${candidate.brand} ${candidate.modelName}`,
        brand: candidate.brand || details.brand || '',
        modelName: candidate.modelName || details.modelName || '',
        type: details.type || '',
        class: details.class || '',
        description: details.description || candidate.description || '',
        status: 'Available' as const,
        accessories: (details.accessories || []).map((acc) => {
          if (typeof acc === 'string') {
            return { id: uuidv4(), name: acc, owned: false, type: 'standard' as const };
          }
          const accessory: any = {
            id: acc.id || uuidv4(),
            name: acc.name || '',
            owned: acc.owned ?? false,
            type: acc.type === 'standard' || acc.type === 'optional' ? acc.type : ('standard' as const),
          };
          if (acc.description) accessory.description = acc.description;
          return accessory;
        }),
      };

      await createEquipment(newEquipment);
      softToast.success('Equipment added', { description: newEquipment.name });
      await onRefresh();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to add equipment:', err);
      softToast.error('Failed to add equipment', { description: 'Please try again' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-[var(--color-v2-border)] p-0 overflow-hidden gap-0 bg-[var(--color-v2-card)] text-[var(--color-v2-foreground)]">
        <div className="p-6 pb-4 bg-gradient-to-b from-[var(--color-v2-secondary)]/50 to-transparent border-b border-[var(--color-v2-border)]">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Zap className="h-6 w-6 text-[var(--color-v2-ring)]" />
              Add Equipment
            </DialogTitle>
            <DialogDescription>
              Search our AI database for kitchen appliances to instantly auto-fill details and accessories.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-6 flex gap-3 relative group">
            <Search className="absolute left-3.5 top-3 h-5 w-5 text-[var(--color-v2-muted-foreground)]" />
            <Input
              className="pl-11 h-12 text-base bg-[var(--color-v2-background)] shadow-inner focus-visible:ring-1 focus-visible:ring-[var(--color-v2-ring)]"
              placeholder="e.g., KitchenAid Stand Mixer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              disabled={isSearching || isGenerating}
            />
            <Button size="lg" onClick={handleSearch} disabled={!searchQuery.trim() || isSearching || isGenerating} className="min-w-32 shadow-lg shadow-blue-500/20">
              {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </div>

        <div className="bg-black/20 pb-4 h-[400px] flex flex-col relative">
          {(isSearching || isGenerating) && (
            <div className="absolute inset-0 z-10 bg-[var(--color-v2-background)]/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-xl bg-blue-500/20 animate-pulse" />
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin relative z-10" />
              </div>
              <p className="mt-4 text-sm font-medium animate-pulse text-[var(--color-v2-foreground)]/80">
                {isGenerating ? 'AI is generating details & accessories...' : 'Searching database...'}
              </p>
            </div>
          )}

          {hasSearched && candidates.length === 0 && !isSearching ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--color-v2-muted-foreground)]">
              <Search className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-lg font-medium text-[var(--color-v2-foreground)]">No equipment found</p>
              <p className="text-sm mt-1">Try refining your search term to match a specific brand or model.</p>
            </div>
          ) : candidates.length > 0 ? (
            <ScrollArea className="flex-1 h-full px-4 pt-4">
              <div className="space-y-3 pb-4">
                {candidates.map((candidate, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectCandidate(candidate)}
                    className="w-full group text-left p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between w-full">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 group-hover:text-blue-300 transition-colors">{candidate.brand}</span>
                        <h4 className="text-lg font-medium leading-none mt-1 group-hover:text-white transition-colors">{candidate.modelName}</h4>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-black/40 border-white/10 group-hover:border-blue-500/30">
                        {candidate.category}
                      </Badge>
                    </div>
                    {candidate.description && (
                      <p className="text-sm text-[var(--color-v2-muted-foreground)] line-clamp-2 mt-1">
                        {candidate.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-[var(--color-v2-muted-foreground)]/60">
              <Zap className="h-16 w-16 opacity-10 mb-6" />
              <p className="text-sm">Search results will magically appear here.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
