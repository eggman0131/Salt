/**
 * Canon Aisles — Full CRUD interface with drag-and-drop reordering
 *
 * Manage canonical aisles:
 * - List all aisles with sortOrder display
 * - Create new aisles
 * - Edit existing aisles (inline or modal)
 * - Delete aisles (with reference check protection)
 * - Drag-and-drop reordering
 * - Protection for 'uncategorised' system aisle
 *
 * All data flows through api.ts only — no direct imports from logic or data.
 * Uses Salt design primitives for responsive, consistent layout.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  getCanonAisles,
  addCanonAisle,
  editCanonAisle,
  removeCanonAisle,
  reorderAisles,
  sortAisles,
  UNCATEGORISED_AISLE_ID,
} from '../api';
import type { Aisle } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, GripVertical, Shield, Merge, Scissors } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { softToast } from '@/lib/soft-toast';
import { useAdminRefresh } from '@/shared/providers';
import { MergeCanonAislesDialog } from './MergeCanonAislesDialog';
import { SplitCanonAisleDialog } from './SplitCanonAisleDialog';
import { Page, Section, Stack } from '@/shared/components/primitives';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Main Component ────────────────────────────────────────────────────────────

export const CanonAisles: React.FC = () => {
  const { refreshTrigger } = useAdminRefresh();
  const [searchTerm, setSearchTerm] = useState('');
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentAisle, setCurrentAisle] = useState<Aisle | null>(null);
  const [inlineEditing, setInlineEditing] = useState<string | null>(null);
  const [selectedAisles, setSelectedAisles] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitAisle, setSplitAisle] = useState<Aisle | null>(null);

  // ── Search / Filter ──────────────────────────────────────────────────────
  const filteredAisles = useMemo(() => {
    if (!searchTerm.trim()) return aisles;
    const lower = searchTerm.toLowerCase();
    return aisles.filter(aisle => aisle.name.toLowerCase().includes(lower));
  }, [aisles, searchTerm]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const aislesData = await getCanonAisles();
      setAisles(sortAisles(aislesData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load aisles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleCreate = async (input: { name: string }) => {
    try {
      const maxSortOrder = aisles.reduce((max, a) => Math.max(max, a.sortOrder), 0);
      await addCanonAisle({ name: input.name, sortOrder: maxSortOrder + 1 });
      toast.success('Aisle created successfully');
      await loadData();
      setShowCreateDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create aisle');
    }
  };

  const handleEdit = async (id: string, updates: Partial<Pick<Aisle, 'name'>>) => {
    try {
      await editCanonAisle(id, updates);
      toast.success('Aisle updated successfully');
      await loadData();
      setShowEditDialog(false);
      setCurrentAisle(null);
      setInlineEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update aisle');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === UNCATEGORISED_AISLE_ID) {
      toast.error('Cannot delete system aisle');
      return;
    }

    try {
      await removeCanonAisle(id);
      toast.success('Aisle deleted successfully');
      await loadData();
      setShowDeleteDialog(false);
      setCurrentAisle(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete aisle');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = aisles.findIndex(a => a.id === active.id);
    const newIndex = aisles.findIndex(a => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(aisles, oldIndex, newIndex);
    setAisles(reordered);

    // Update sortOrder in backend
    const updates = reordered.map((aisle, index) => ({
      id: aisle.id,
      sortOrder: index,
    }));

    try {
      await reorderAisles(updates);
      toast.success('Aisle order updated');
    } catch (err) {
      toast.error('Failed to update aisle order');
      // Reload to restore correct order
      await loadData();
    }
  };

  if (isLoading) {
    return (
      <Page>
        <Section>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Section>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Section>
          <h1 className="text-2xl font-bold text-foreground">Canon Aisles</h1>
          <div className="text-destructive">{error}</div>
        </Section>
      </Page>
    );
  }

  return (
    <>
      <Page>
        {/* Header Section */}
        <Section spacing="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Canon Aisles</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Manage canonical aisles for inventory organisation. Drag to reorder.
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Add Aisle
            </Button>
          </div>
        </Section>

        {/* Search Input */}
        <Section>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Search aisles by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            {searchTerm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm('')}
              >
                Clear
              </Button>
            )}
          </div>
          {searchTerm && (
            <p className="text-xs text-muted-foreground mt-2">
              Found {filteredAisles.length} of {aisles.length} aisles
            </p>
          )}
        </Section>

        {/* Bulk Action Bar */}
        {selectedAisles.size > 0 && (
          <Section className="rounded-md border border-primary/20 bg-primary/5 p-4" spacing="space-y-3">
            <p className="text-sm font-medium">
              {selectedAisles.size} aisle{selectedAisles.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              {selectedAisles.size === 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMergeDialog(true)}
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Merge 2 aisles
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedAisles(new Set())}>
                Clear
              </Button>
            </div>
          </Section>
        )}

        {/* Aisles List Section */}
        <Section spacing="space-y-4">
          <Stack spacing="gap-2">
            {filteredAisles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                <p>{searchTerm ? 'No aisles match your search' : 'No aisles found'}</p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (searchTerm) setSearchTerm('');
                    else setShowCreateDialog(true);
                  }}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {searchTerm ? 'Clear search' : 'Create your first aisle'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={filteredAisles.map(a => a.id)} strategy={verticalListSortingStrategy}>
                    {filteredAisles.map(aisle => (
                      <AisleRow
                        key={aisle.id}
                        aisle={aisle}
                        isSelected={selectedAisles.has(aisle.id)}
                        onToggleSelect={id => {
                          const next = new Set(selectedAisles);
                          if (next.has(id)) next.delete(id); else next.add(id);
                          setSelectedAisles(next);
                        }}
                        onEdit={(a) => {
                          setCurrentAisle(a);
                          setShowEditDialog(true);
                        }}
                        onDelete={(a) => {
                          setCurrentAisle(a);
                          setShowDeleteDialog(true);
                        }}
                        onSplit={(a) => {
                          setSplitAisle(a);
                          setShowSplitDialog(true);
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </Stack>
        </Section>
      </Page>

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateAisleDialog
          onSubmit={handleCreate}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && currentAisle && (
        <EditAisleDialog
          aisle={currentAisle}
          onSubmit={(updates) => handleEdit(currentAisle.id, updates)}
          onCancel={() => {
            setShowEditDialog(false);
            setCurrentAisle(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteDialog && currentAisle && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Aisle</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{currentAisle.name}"? This action cannot be undone.
                {currentAisle.id === UNCATEGORISED_AISLE_ID && (
                  <p className="mt-2 font-medium text-destructive">
                    This is a system aisle and cannot be deleted.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowDeleteDialog(false);
                setCurrentAisle(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(currentAisle.id)}
                disabled={currentAisle.id === UNCATEGORISED_AISLE_ID}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Split Dialog */}
      {showSplitDialog && splitAisle && (
        <SplitCanonAisleDialog
          aisle={splitAisle}
          onSuccess={() => {
            setShowSplitDialog(false);
            setSplitAisle(null);
            loadData();
          }}
          onCancel={() => {
            setShowSplitDialog(false);
            setSplitAisle(null);
          }}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && selectedAisles.size === 2 && (() => {
        const [idA, idB] = Array.from(selectedAisles);
        const aisleA = aisles.find(a => a.id === idA);
        const aisleB = aisles.find(a => a.id === idB);
        if (!aisleA || !aisleB) return null;
        return (
          <MergeCanonAislesDialog
            aisleA={aisleA}
            aisleB={aisleB}
            onSuccess={() => {
              setShowMergeDialog(false);
              setSelectedAisles(new Set());
              loadData();
            }}
            onCancel={() => setShowMergeDialog(false)}
          />
        );
      })()}
    </>
  );
};

// ── Aisle Row Component (Sortable) ────────────────────────────────────────────

interface AisleRowProps {
  aisle: Aisle;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (aisle: Aisle) => void;
  onDelete: (aisle: Aisle) => void;
  onSplit: (aisle: Aisle) => void;
}

const AisleRow: React.FC<AisleRowProps> = ({ aisle, isSelected, onToggleSelect, onEdit, onDelete, onSplit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: aisle.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSystemAisle = aisle.id === UNCATEGORISED_AISLE_ID;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(aisle.id)}
        aria-label={`Select ${aisle.name}`}
        className="shrink-0"
      />

      {/* Drag Handle */}
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Aisle Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{aisle.name}</span>
          {isSystemAisle && (
            <Badge variant="secondary" className="shrink-0">
              <Shield className="h-3 w-3 mr-1" />
              System
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Sort Order: {aisle.sortOrder}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(aisle)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSplit(aisle)}
          title="Split aisle"
        >
          <Scissors className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(aisle)}
          disabled={isSystemAisle}
          className={isSystemAisle ? 'opacity-50 cursor-not-allowed' : ''}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

// ── Create Dialog ─────────────────────────────────────────────────────────────

interface CreateAisleDialogProps {
  onSubmit: (input: { name: string }) => Promise<void>;
  onCancel: () => void;
}

const CreateAisleDialog: React.FC<CreateAisleDialogProps> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Aisle name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim() });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Aisle</DialogTitle>
          <DialogDescription>
            Add a new canonical aisle for inventory organisation
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Stack spacing="gap-4">
            <div>
              <Label htmlFor="name">Aisle Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dairy, Bakery, Frozen"
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Aisle
                  </>
                )}
              </Button>
            </DialogFooter>
          </Stack>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Edit Dialog ───────────────────────────────────────────────────────────────

interface EditAisleDialogProps {
  aisle: Aisle;
  onSubmit: (updates: Partial<Pick<Aisle, 'name'>>) => Promise<void>;
  onCancel: () => void;
}

const EditAisleDialog: React.FC<EditAisleDialogProps> = ({ aisle, onSubmit, onCancel }) => {
  const [name, setName] = useState(aisle.name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Aisle name is required');
      return;
    }

    if (name.trim() === aisle.name) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim() });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Aisle</DialogTitle>
          <DialogDescription>
            Update the aisle name
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Stack spacing="gap-4">
            <div>
              <Label htmlFor="edit-name">Aisle Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dairy, Bakery, Frozen"
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </Stack>
        </form>
      </DialogContent>
    </Dialog>
  );
};
