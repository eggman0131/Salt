/**
 * FdcLinkSection
 *
 * Self-contained FDC link management for a canon item.
 * Handles suggest / search / link / unlink and displays FDC food data.
 *
 * Imports only from api.ts.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  suggestFdcMatch,
  linkFdcMatch,
  unlinkFdcMatch,
  type CanonItem,
} from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Sparkles, Unlink, AlertCircle } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FdcLinkSectionProps {
  item: CanonItem;
  onLinked: () => Promise<void>;
  onUnlinked: () => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FdcLinkSection: React.FC<FdcLinkSectionProps> = ({ item, onLinked, onUnlinked }) => {
  const [showFdcSearch, setShowFdcSearch] = useState(false);
  const [fdcSuggestions, setFdcSuggestions] = useState<{
    bestMatch: any | null;
    candidates: any[];
  } | null>(null);
  const [isLoadingFdc, setIsLoadingFdc] = useState(false);
  const [selectedFdcMatch, setSelectedFdcMatch] = useState<any>(null);
  const [fdcSearchFilter, setFdcSearchFilter] = useState('');
  const [localFdcSource, setLocalFdcSource] = useState(
    item.externalSources?.find(s => s.source === 'fdc') ?? null
  );

  // Reset state when item changes
  useEffect(() => {
    setShowFdcSearch(false);
    setFdcSuggestions(null);
    setSelectedFdcMatch(null);
    setFdcSearchFilter('');
    setLocalFdcSource(item.externalSources?.find(s => s.source === 'fdc') ?? null);
  }, [item]);

  // ── Search filtering ─────────────────────────────────────────────────────

  const filteredFdcCandidates = useMemo(() => {
    if (!fdcSuggestions?.candidates) return [];
    if (!fdcSearchFilter.trim()) return fdcSuggestions.candidates;
    const lower = fdcSearchFilter.toLowerCase();
    return fdcSuggestions.candidates.filter(c => c.description.toLowerCase().includes(lower));
  }, [fdcSuggestions?.candidates, fdcSearchFilter]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSuggestFdc = async () => {
    setShowFdcSearch(true);
    setIsLoadingFdc(true);
    setFdcSuggestions(null);
    setSelectedFdcMatch(null);
    setFdcSearchFilter('');
    try {
      const suggestions = await suggestFdcMatch(item.id);
      setFdcSuggestions(suggestions);
      if (suggestions.bestMatch) {
        setSelectedFdcMatch(suggestions.bestMatch);
      }
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to suggest FDC matches');
      setShowFdcSearch(false);
    } finally {
      setIsLoadingFdc(false);
    }
  };

  const handleLinkFdc = async (match: any) => {
    setIsLoadingFdc(true);
    try {
      await linkFdcMatch(item.id, match);
      softToast.success(`Enriched from FDC: ${match.description}`);
      setShowFdcSearch(false);
      setFdcSuggestions(null);
      setSelectedFdcMatch(null);
      setLocalFdcSource({
        source: 'fdc',
        externalId: match.fdcId,
        confidence: match.score,
      });
      await onLinked();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to link FDC match');
    } finally {
      setIsLoadingFdc(false);
    }
  };

  const handleUnlinkFdc = async () => {
    try {
      await unlinkFdcMatch(item.id);
      softToast.success('FDC link removed');
      setLocalFdcSource(null);
      await onUnlinked();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to unlink FDC');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">FDC</h3>
      {localFdcSource ? (
        <div className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">FDC ID</span>
              <span className="font-mono text-xs">{localFdcSource.externalId}</span>
            </div>
            {(localFdcSource.properties as any)?.description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">FDC name</span>
                <span className="font-medium text-right max-w-[60%]">{(localFdcSource.properties as any).description}</span>
              </div>
            )}
            {localFdcSource.confidence != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Match confidence</span>
                <span>{Math.round(localFdcSource.confidence * 100)}%</span>
              </div>
            )}
            {(localFdcSource.properties as any)?.dataType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data type</span>
                <span className="text-xs text-muted-foreground">{(localFdcSource.properties as any).dataType}</span>
              </div>
            )}
            {localFdcSource.syncedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Synced</span>
                <span className="text-xs">
                  {new Date(localFdcSource.syncedAt).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSuggestFdc}>
              <Sparkles className="h-3 w-3 mr-1" />
              Change Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleUnlinkFdc}>
              <Unlink className="h-3 w-3 mr-1" />
              Unlink
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">No FDC data linked. Link to auto-populate unit conversion data.</p>
          {!showFdcSearch && (
            <Button variant="outline" size="sm" onClick={handleSuggestFdc}>
              <Sparkles className="h-3 w-3 mr-1" />
              Find FDC Match
            </Button>
          )}
        </div>
      )}

      {/* Inline FDC search */}
      {showFdcSearch && (
        <div className="space-y-3 rounded-md border p-3">
          {isLoadingFdc ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Finding FDC matches...</span>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search FDC food database..."
                  value={fdcSearchFilter}
                  onChange={e => setFdcSearchFilter(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {filteredFdcCandidates.length > 0 && (
                  <div className="space-y-1">
                    {fdcSearchFilter && <p className="text-xs font-medium text-muted-foreground">Matches</p>}
                    {filteredFdcCandidates.map((match, idx) => (
                      <button
                        key={match.fdcId}
                        onClick={() => setSelectedFdcMatch(match)}
                        className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                          selectedFdcMatch?.fdcId === match.fdcId ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm truncate">{match.description}</span>
                          {idx === 0 && !fdcSearchFilter && fdcSuggestions?.bestMatch?.fdcId === match.fdcId && (
                            <Badge variant="default" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />Best match</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">{Math.round(match.score * 100)}% similarity</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{match.dataType} • {match.portions?.length ?? 0} portions</p>
                      </button>
                    ))}
                  </div>
                )}

                {filteredFdcCandidates.length === 0 && (fdcSuggestions?.candidates?.length ?? 0) > 0 && fdcSearchFilter && (
                  <p className="text-xs text-muted-foreground">No matches for this search.</p>
                )}

                {(fdcSuggestions?.candidates?.length ?? 0) === 0 && !fdcSearchFilter && (
                  <div className="flex flex-col items-center justify-center py-4 text-center border border-dashed rounded-lg">
                    <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No FDC matches found.</p>
                    <p className="text-xs text-muted-foreground mt-1">Search to find portion data for unit conversion.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setShowFdcSearch(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => selectedFdcMatch && handleLinkFdc(selectedFdcMatch)}
                  disabled={!selectedFdcMatch || isLoadingFdc}
                >
                  {isLoadingFdc ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link Selected'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
