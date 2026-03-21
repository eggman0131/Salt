/**
 * FdcLinkSection
 *
 * Self-contained FDC link management for a canon item.
 * Handles suggest / search / link / unlink and displays FDC food data.
 *
 * Imports only from api.ts.
 */

import React, { useEffect, useState } from 'react';
import {
  suggestFdcMatch,
  searchFdcByText,
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
  const [fdcCandidates, setFdcCandidates] = useState<any[]>([]);
  const [fdcBestMatchId, setFdcBestMatchId] = useState<number | null>(null);
  const [isLoadingFdc, setIsLoadingFdc] = useState(false);
  const [isReSearching, setIsReSearching] = useState(false);
  const [selectedFdcMatch, setSelectedFdcMatch] = useState<any>(null);
  const [fdcSearchQuery, setFdcSearchQuery] = useState('');
  const [localFdcSource, setLocalFdcSource] = useState(
    item.externalSources?.find(s => s.source === 'fdc') ?? null
  );

  // Reset state when item changes
  useEffect(() => {
    setShowFdcSearch(false);
    setFdcCandidates([]);
    setFdcBestMatchId(null);
    setSelectedFdcMatch(null);
    setFdcSearchQuery('');
    setLocalFdcSource(item.externalSources?.find(s => s.source === 'fdc') ?? null);
  }, [item]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSuggestFdc = async () => {
    setShowFdcSearch(true);
    setIsLoadingFdc(true);
    setFdcCandidates([]);
    setFdcBestMatchId(null);
    setSelectedFdcMatch(null);
    setFdcSearchQuery(item.name);
    try {
      const suggestions = await suggestFdcMatch(item.id);
      setFdcCandidates(suggestions.candidates);
      setFdcBestMatchId(suggestions.bestMatch?.fdcId ?? null);
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

  const handleReSearch = async () => {
    const q = fdcSearchQuery.trim();
    if (!q) return;
    setIsReSearching(true);
    setSelectedFdcMatch(null);
    setFdcBestMatchId(null);
    try {
      const results = await searchFdcByText(q);
      setFdcCandidates(results);
      if (results[0]) setSelectedFdcMatch(results[0]);
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'FDC search failed');
    } finally {
      setIsReSearching(false);
    }
  };

  const handleLinkFdc = async (match: any) => {
    setIsLoadingFdc(true);
    try {
      await linkFdcMatch(item.id, match);
      softToast.success(`Enriched from FDC: ${match.description}`);
      setShowFdcSearch(false);
      setFdcCandidates([]);
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
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search FDC food database..."
                    value={fdcSearchQuery}
                    onChange={e => setFdcSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleReSearch(); }}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReSearch}
                  disabled={isReSearching || !fdcSearchQuery.trim()}
                >
                  {isReSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              <div className="max-h-75 overflow-y-auto space-y-2">
                {fdcCandidates.length > 0 && (
                  <div className="space-y-1">
                    {fdcCandidates.map((match, idx) => (
                      <button
                        key={match.fdcId}
                        onClick={() => setSelectedFdcMatch(match)}
                        className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                          selectedFdcMatch?.fdcId === match.fdcId ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm truncate">{match.description}</span>
                          {idx === 0 && fdcBestMatchId === match.fdcId && (
                            <Badge variant="default" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />Best match</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">{Math.round(match.score * 100)}% similarity</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{match.dataType} • {match.portions?.length ?? 0} portions</p>
                      </button>
                    ))}
                  </div>
                )}

                {fdcCandidates.length === 0 && !isReSearching && (
                  <div className="flex flex-col items-center justify-center py-4 text-center border border-dashed rounded-lg">
                    <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No FDC matches found.</p>
                    <p className="text-xs text-muted-foreground mt-1">Edit the search query and press Enter to try different terms.</p>
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
