/**
 * Canon Items Admin — Full CRUD interface
 *
 * Administrative tools for managing canonical items:
 * - List all items with filtering
 * - Create new items
 * - Edit existing items
 * - Approve items from review queue
 *
 * All data flows through api.ts only — no direct imports from logic or data.
 */

import React, { useEffect, useState } from 'react';
import {
  getCanonItems,
  getCanonAisles,
  getCanonUnits,
  addCanonItem,
  editCanonItem,
  approveItem,
  sortItems,
  filterItemsNeedingReview,
  normalizeItemName,
  suggestCofidMatch,
  linkCofidMatch,
  unlinkCofidMatch,
  buildCofidMatch,
  getCofidItemById,
  type CanonItem,
  type SuggestedMatch,
} from '../../api';
import type { Aisle, Unit } from '../../../../types/contract';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Check, Pencil, AlertCircle, Link, Unlink, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAdminRefresh } from '@/shared/providers';

// ── Main Component ────────────────────────────────────────────────────────────

export const CanonItemsAdmin: React.FC = () => {
  const { refreshTrigger } = useAdminRefresh();
  const [items, setItems] = useState<CanonItem[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState<CanonItem | null>(null);
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  
  // PR5: CofID integration state
  const [showCofidDialog, setShowCofidDialog] = useState(false);
  const [cofidSuggestions, setCofidSuggestions] = useState<{
    bestMatch: SuggestedMatch | null;
    candidates: SuggestedMatch[];
  } | null>(null);
  const [isLoadingCofid, setIsLoadingCofid] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsData, aislesData, unitsData] = await Promise.all([
        getCanonItems(),
        getCanonAisles(),
        getCanonUnits(),
      ]);
      setItems(itemsData);
      setAisles(aislesData);
      setUnits(unitsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]); // Re-fetch when refresh is triggered from dashboard

  const handleCreate = async (input: {
    name: string;
    aisleId: string;
    preferredUnitId: string;
  }) => {
    try {
      await addCanonItem({ ...input, needsReview: true });
      toast.success('Item created successfully');
      await loadData();
      setShowCreateDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item');
    }
  };

  const handleEdit = async (
    id: string,
    updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId'>>
  ) => {
    try {
      await editCanonItem(id, updates);
      toast.success('Item updated successfully');
      await loadData();
      setShowEditDialog(false);
      setCurrentItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveItem(id);
      toast.success('Item approved');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve item');
    }
  };

  // PR5: CofID Integration handlers
  const handleSuggestCofid = async (item: CanonItem) => {
    setCurrentItem(item);
    setIsLoadingCofid(true);
    setShowCofidDialog(true);
    try {
      const suggestions = await suggestCofidMatch(item.id);
      setCofidSuggestions(suggestions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to suggest CofID matches');
      setShowCofidDialog(false);
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleLinkCofid = async (match: SuggestedMatch) => {
    if (!currentItem) return;
    setIsLoadingCofid(true);
    try {
      const matchMetadata = buildCofidMatch(match, 'manual', cofidSuggestions?.candidates);
      await linkCofidMatch(currentItem.id, match.cofidId, matchMetadata);
      toast.success(`Linked to ${match.name}`);
      await loadData();
      setShowCofidDialog(false);
      setCofidSuggestions(null);
      setCurrentItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link CofID match');
    } finally {
      setIsLoadingCofid(false);
    }
  };

  const handleUnlinkCofid = async (item: CanonItem) => {
    try {
      await unlinkCofidMatch(item.id);
      toast.success('CofID link removed');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink CofID');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Canon Items</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Canon Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const displayItems = filterNeedsReview
    ? filterItemsNeedingReview(items)
    : items;
  const sortedItems = sortItems(displayItems);
  const needsReviewCount = filterItemsNeedingReview(items).length;

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Canon Items</CardTitle>
              <Badge variant="secondary">{items.length}</Badge>
              {needsReviewCount > 0 && (
                <Badge variant="destructive">{needsReviewCount} need review</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterNeedsReview ? 'default' : 'outline'}
                onClick={() => setFilterNeedsReview(!filterNeedsReview)}
                disabled={needsReviewCount === 0}
              >
                <AlertCircle className="h-4 w-4 mr-1" />
                Review Queue
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
              <p className="text-muted-foreground">
                {filterNeedsReview
                  ? 'No items need review'
                  : 'No items yet. Create one to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedItems.map(item => {
                const aisle = aisles.find(a => a.id === item.aisleId);
                const unit = units.find(u => u.id === item.preferredUnitId);
                const isLinked = !!item.cofidId;
                const hasNutrients = !!item.nutrients;
                
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3 rounded-md border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {item.needsReview && (
                          <Badge variant="outline" className="text-xs">
                            Needs Review
                          </Badge>
                        )}
                        {isLinked && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Link className="h-3 w-3" />
                            CofID Linked
                          </Badge>
                        )}
                        {hasNutrients && (
                          <Badge variant="default" className="text-xs">
                            Nutrients
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {aisle?.name || 'Unknown aisle'} • {unit?.name || 'Unknown unit'}
                        {item.cofidMatch && item.cofidMatch.status !== 'unlinked' && (
                          <>
                            {' '} • Match: {item.cofidMatch.method} ({Math.round((item.cofidMatch.score || 0) * 100)}%)
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!isLinked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuggestCofid(item)}
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          Link CofID
                        </Button>
                      )}
                      {isLinked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnlinkCofid(item)}
                        >
                          <Unlink className="h-4 w-4 mr-1" />
                          Unlink
                        </Button>
                      )}
                      {item.needsReview && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(item.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCurrentItem(item);
                          setShowEditDialog(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateItemDialog
          aisles={aisles}
          units={units}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && currentItem && (
        <EditItemDialog
          item={currentItem}
          aisles={aisles}
          units={units}
          onSubmit={(updates) => handleEdit(currentItem.id, updates)}
          onCancel={() => {
            setShowEditDialog(false);
            setCurrentItem(null);
          }}
        />
      )}

      {/* CofID Suggestions Dialog */}
      {showCofidDialog && currentItem && (
        <CofidSuggestionsDialog
          item={currentItem}
          suggestions={cofidSuggestions}
          isLoading={isLoadingCofid}
          onLink={handleLinkCofid}
          onCancel={() => {
            setShowCofidDialog(false);
            setCofidSuggestions(null);
            setCurrentItem(null);
          }}
        />
      )}
    </div>
  );
};

// ── Create Item Dialog ────────────────────────────────────────────────────────

interface CreateItemDialogProps {
  aisles: Aisle[];
  units: Unit[];
  onSubmit: (input: { name: string; aisleId: string; preferredUnitId: string }) => Promise<void>;
  onCancel: () => void;
}

const CreateItemDialog: React.FC<CreateItemDialogProps> = ({
  aisles,
  units,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [aisleId, setAisleId] = useState('');
  const [preferredUnitId, setPreferredUnitId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = normalizeItemName(name);
    if (!normalizedName || !aisleId || !preferredUnitId) {
      toast.error('All fields are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name: normalizedName, aisleId, preferredUnitId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Canon Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tomatoes"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aisle">Aisle</Label>
              <Select value={aisleId} onValueChange={setAisleId} disabled={isSubmitting}>
                <SelectTrigger id="aisle">
                  <SelectValue placeholder="Select aisle" />
                </SelectTrigger>
                <SelectContent>
                  {aisles.map(aisle => (
                    <SelectItem key={aisle.id} value={aisle.id}>
                      {aisle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Preferred Unit</Label>
              <Select
                value={preferredUnitId}
                onValueChange={setPreferredUnitId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Edit Item Dialog ──────────────────────────────────────────────────────────

interface EditItemDialogProps {
  item: CanonItem;
  aisles: Aisle[];
  units: Unit[];
  onSubmit: (
    updates: Partial<Pick<CanonItem, 'name' | 'aisleId' | 'preferredUnitId'>>
  ) => Promise<void>;
  onCancel: () => void;
}

const EditItemDialog: React.FC<EditItemDialogProps> = ({
  item,
  aisles,
  units,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState(item.name);
  const [aisleId, setAisleId] = useState(item.aisleId);
  const [preferredUnitId, setPreferredUnitId] = useState(item.preferredUnitId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = normalizeItemName(name);
    if (!normalizedName || !aisleId || !preferredUnitId) {
      toast.error('All fields are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ name: normalizedName, aisleId, preferredUnitId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Canon Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Item Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-aisle">Aisle</Label>
              <Select value={aisleId} onValueChange={setAisleId} disabled={isSubmitting}>
                <SelectTrigger id="edit-aisle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aisles.map(aisle => (
                    <SelectItem key={aisle.id} value={aisle.id}>
                      {aisle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Preferred Unit</Label>
              <Select
                value={preferredUnitId}
                onValueChange={setPreferredUnitId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="edit-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── CofID Suggestions Dialog (PR5) ────────────────────────────────────────────

interface CofidSuggestionsDialogProps {
  item: CanonItem;
  suggestions: {
    bestMatch: SuggestedMatch | null;
    candidates: SuggestedMatch[];
  } | null;
  isLoading: boolean;
  onLink: (match: SuggestedMatch) => Promise<void>;
  onCancel: () => void;
}

const CofidSuggestionsDialog: React.FC<CofidSuggestionsDialogProps> = ({
  item,
  suggestions,
  isLoading,
  onLink,
  onCancel,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<SuggestedMatch | null>(null);

  // Auto-select best match on load
  useEffect(() => {
    if (suggestions?.bestMatch && !selectedMatch) {
      setSelectedMatch(suggestions.bestMatch);
    }
  }, [suggestions, selectedMatch]);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link CofID Item: {item.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-muted-foreground">Finding matches...</span>
            </div>
          ) : suggestions && suggestions.candidates.length > 0 ? (
            <div className="space-y-4">
              <div>
                <Label>Select a CofID item to link:</Label>
                <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
                  {suggestions.candidates.map((match, idx) => (
                    <button
                      key={match.cofidId}
                      onClick={() => setSelectedMatch(match)}
                      className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                        selectedMatch?.cofidId === match.cofidId
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{match.name}</span>
                            {idx === 0 && suggestions.bestMatch?.cofidId === match.cofidId && (
                              <Badge variant="default" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Best Match
                              </Badge>
                            )}
                            <Badge
                              variant={match.method === 'exact' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {match.method}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Score: {Math.round(match.score * 100)}% • {match.reason}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                No CofID matches found for "{item.name}"
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting the aisle or item name
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedMatch && onLink(selectedMatch)}
            disabled={!selectedMatch || isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link Selected Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

