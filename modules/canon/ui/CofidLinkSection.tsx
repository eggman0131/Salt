/**
 * CofidLinkSection
 *
 * Self-contained CoFID link management for a canon item.
 * Handles suggest / search / link / unlink and renders nutritional data
 * sourced from CoFID.
 *
 * Imports only from api.ts.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  suggestCofidMatch,
  linkCofidMatch,
  unlinkCofidMatch,
  buildCofidMatch,
  getCofidItemById,
  getCanonCofidItems,
  type CanonItem,
  type SuggestedMatch,
} from '../api';
import type { CofIDItem } from '../types';
import CofidMatchButton from './CofidMatchButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Sparkles, Unlink, AlertCircle } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

// ── Nutrient label map ────────────────────────────────────────────────────────

const NUTRIENT_LABELS: Record<string, string> = {
  energyKcal: 'Energy (kcal)',
  energyKj: 'Energy (kJ)',
  protein: 'Protein (g)',
  fat: 'Total fat (g)',
  satFatPer100gFood: 'Saturated fat (g)',
  carbs: 'Carbohydrate (g)',
  sugars: 'Sugars (g)',
  fibre: 'Fibre (g)',
  salt: 'Salt (mg)',
  cholesterol: 'Cholesterol (mg)',
  water: 'Water (g)',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface CofidLinkSectionProps {
  item: CanonItem;
  onLinked: () => Promise<void>;
  onUnlinked: () => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CofidLinkSection: React.FC<CofidLinkSectionProps> = ({ item, onLinked, onUnlinked }) => {
  const [cofidDetail, setCofidDetail] = useState<any>(null);
  const [isLoadingCofidDetail, setIsLoadingCofidDetail] = useState(false);
  const [showCofidSearch, setShowCofidSearch] = useState(false);
  const [cofidSuggestions, setCofidSuggestions] = useState<{
    bestMatch: SuggestedMatch | null;
    candidates: SuggestedMatch[];
  } | null>(null);
  const [isLoadingCofid, setIsLoadingCofid] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<SuggestedMatch | null>(null);
  const [cofidSearchFilter, setCofidSearchFilter] = useState('');
  const [allCofidItems, setAllCofidItems] = useState<CofIDItem[]>([]);
  const [isLoadingAllCofid, setIsLoadingAllCofid] = useState(false);
  const [localCofidSource, setLocalCofidSource] = useState(
    item.externalSources?.find(s => s.source === 'cofid') ?? null
  );

  // Reset state when item changes
  useEffect(() => {
    setCofidDetail(null);
    setShowCofidSearch(false);
    setCofidSuggestions(null);
    setSelectedMatch(null);
    setCofidSearchFilter('');
    const source = item.externalSources?.find(s => s.source === 'cofid') ?? null;
    setLocalCofidSource(source);

    if (source?.externalId) {
      setIsLoadingCofidDetail(true);
      getCofidItemById(source.externalId)
        .then(detail => setCofidDetail(detail))
        .catch(() => { /* non-critical */ })
        .finally(() => setIsLoadingCofidDetail(false));
    }
  }, [item]);

  // ── Search filtering ────────────────────────────────────────────────────

  const filteredCandidates = useMemo(() => {
    if (!cofidSuggestions?.candidates) return [];
    if (!cofidSearchFilter.trim()) return cofidSuggestions.candidates;
    const lower = cofidSearchFilter.toLowerCase();
    return cofidSuggestions.candidates.filter(c => c.name.toLowerCase().includes(lower));
  }, [cofidSuggestions?.candidates, cofidSearchFilter]);

  const dbSearchResults = useMemo(() => {
    if (!cofidSearchFilter.trim() || cofidSearchFilter.trim().length < 2) return [];
    const lower = cofidSearchFilter.toLowerCase();
    const suggestionIds = new Set(cofidSuggestions?.candidates?.map(c => c.cofidId) ?? []);
    return allCofidItems
      .filter(c => c.name.toLowerCase().includes(lower) && !suggestionIds.has(c.id))
      .slice(0, 30);
  }, [allCofidItems, cofidSearchFilter, cofidSuggestions?.candidates]);

  const cofidItemToMatch = (ci: CofIDItem): SuggestedMatch => ({
    cofidId: ci.id,
    name: ci.name,
    score: 1.0,
    method: 'exact',
    reason: 'Manual selection from CoFID database',
  });

  // ── Nutrition data ──────────────────────────────────────────────────────

  const nutrition =
    (cofidDetail?.nutrients && typeof cofidDetail.nutrients === 'object' ? cofidDetail.nutrients : null)
    ?? (localCofidSource?.properties && typeof localCofidSource.properties === 'object'
        ? (localCofidSource.properties as any).nutrition
        : null);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSuggestCofid = async () => {
    setShowCofidSearch(true);
    setIsLoadingCofid(true);
    setCofidSuggestions(null);
    setSelectedMatch(null);
    setCofidSearchFilter('');
    try {
      const [suggestions] = await Promise.all([
        suggestCofidMatch(item.id),
        (async () => {
          if (allCofidItems.length === 0) {
            setIsLoadingAllCofid(true);
            try {
              const items = await getCanonCofidItems();
              setAllCofidItems(items as CofIDItem[]);
            } catch { /* non-critical */ }
            finally { setIsLoadingAllCofid(false); }
          }
        })(),
      ]);
      setCofidSuggestions(suggestions);
      if (suggestions.bestMatch) {
        setSelectedMatch(suggestions.bestMatch);
      }
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to suggest CofID matches');
      setShowCofidSearch(false);
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleLinkCofid = async (match: SuggestedMatch) => {
    setIsLoadingCofid(true);
    try {
      const matchMetadata = buildCofidMatch(match, 'manual');
      await linkCofidMatch(item.id, match.cofidId, matchMetadata);
      softToast.success(`Linked to ${match.name}`);
      setShowCofidSearch(false);
      setCofidSuggestions(null);
      setSelectedMatch(null);
      setLocalCofidSource({ source: 'cofid', externalId: match.cofidId });
      try {
        const detail = await getCofidItemById(match.cofidId);
        setCofidDetail(detail);
      } catch { /* non-critical */ }
      await onLinked();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to link CofID match');
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleUnlinkCofid = async () => {
    try {
      await unlinkCofidMatch(item.id);
      softToast.success('CofID link removed');
      setLocalCofidSource(null);
      setCofidDetail(null);
      await onUnlinked();
    } catch (err) {
      softToast.error(err instanceof Error ? err.message : 'Failed to unlink CofID');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">CoFID</h3>
        {localCofidSource ? (
          <div className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">CoFID ID</span>
                <span className="font-mono text-xs">{localCofidSource.externalId}</span>
              </div>
              {isLoadingCofidDetail && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Loading CoFID details...</span>
                </div>
              )}
              {cofidDetail && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CoFID name</span>
                  <span className="font-medium text-right max-w-[60%]">{cofidDetail.name ?? '—'}</span>
                </div>
              )}
              {localCofidSource.confidence != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Match confidence</span>
                  <span>{Math.round(localCofidSource.confidence * 100)}%</span>
                </div>
              )}
              {localCofidSource.syncedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Synced</span>
                  <span className="text-xs">
                    {new Date(localCofidSource.syncedAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSuggestCofid}>
                <Sparkles className="h-3 w-3 mr-1" />
                Change Link
              </Button>
              <Button variant="outline" size="sm" onClick={handleUnlinkCofid}>
                <Unlink className="h-3 w-3 mr-1" />
                Unlink
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No CoFID link.</p>
            {!showCofidSearch && (
              <Button variant="outline" size="sm" onClick={handleSuggestCofid}>
                <Sparkles className="h-3 w-3 mr-1" />
                Find CofID Match
              </Button>
            )}
          </div>
        )}

        {/* Inline CofID search */}
        {showCofidSearch && (
          <div className="space-y-3 rounded-md border p-3">
            {isLoadingCofid ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Finding matches...</span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search CoFID database..."
                    value={cofidSearchFilter}
                    onChange={e => setCofidSearchFilter(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                  {isLoadingAllCofid && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {filteredCandidates.length > 0 && (
                    <div className="space-y-1">
                      {cofidSearchFilter && <p className="text-xs font-medium text-muted-foreground">Suggestions</p>}
                      {filteredCandidates.map((match, idx) => (
                        <CofidMatchButton
                          key={match.cofidId}
                          name={match.name}
                          cofidId={match.cofidId}
                          badge={idx === 0 && !cofidSearchFilter && cofidSuggestions?.bestMatch?.cofidId === match.cofidId
                            ? <Badge variant="default" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />Best match</Badge>
                            : <Badge variant={match.method === 'exact' ? 'default' : 'secondary'} className="text-xs">{match.method}</Badge>
                          }
                          sub={`${Math.round(match.score * 100)}% similarity`}
                          isSelected={selectedMatch?.cofidId === match.cofidId}
                          onSelect={() => setSelectedMatch(match)}
                        />
                      ))}
                    </div>
                  )}

                  {filteredCandidates.length === 0 && (cofidSuggestions?.candidates?.length ?? 0) > 0 && cofidSearchFilter && (
                    <p className="text-xs text-muted-foreground">No suggestions match — see database results below.</p>
                  )}

                  {(cofidSuggestions?.candidates?.length ?? 0) === 0 && !cofidSearchFilter && (
                    <div className="flex flex-col items-center justify-center py-4 text-center border border-dashed rounded-lg">
                      <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No automatic matches found.</p>
                      <p className="text-xs text-muted-foreground mt-1">Type above to search the full CoFID database.</p>
                    </div>
                  )}

                  {dbSearchResults.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        CoFID database ({dbSearchResults.length}{dbSearchResults.length === 30 ? '+' : ''})
                      </p>
                      {dbSearchResults.map(ci => (
                        <CofidMatchButton
                          key={ci.id}
                          name={ci.name}
                          cofidId={ci.id}
                          badge={<Badge variant="outline" className="text-xs text-muted-foreground">Group {ci.group}</Badge>}
                          sub={ci.id}
                          isSelected={selectedMatch?.cofidId === ci.id}
                          onSelect={() => setSelectedMatch(cofidItemToMatch(ci))}
                        />
                      ))}
                    </div>
                  )}

                  {cofidSearchFilter.trim().length > 0 && cofidSearchFilter.trim().length < 2 && (
                    <p className="text-xs text-muted-foreground">Type at least 2 characters to search the database.</p>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setShowCofidSearch(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => selectedMatch && handleLinkCofid(selectedMatch)}
                    disabled={!selectedMatch || isLoadingCofid}
                  >
                    {isLoadingCofid ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link Selected'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Nutritional Data — sourced from CoFID */}
      {nutrition && typeof nutrition === 'object' && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Nutritional Data <span className="font-normal text-muted-foreground">(per 100g, from CoFID)</span></h3>
          <div className="rounded-md border divide-y text-sm">
            {Object.entries(NUTRIENT_LABELS).map(([key, label]) => {
              const val = (nutrition as any)[key];
              if (val == null) return null;
              return (
                <div key={key} className="flex justify-between px-3 py-1.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{typeof val === 'number' ? val.toFixed(1) : val}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
};
