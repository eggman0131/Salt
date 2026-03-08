/**
 * Canon Units — Full CRUD interface with category grouping
 *
 * Manage canonical units:
 * - List all units grouped by category (weight, volume, count, colloquial)
 * - Create new units with category selection
 * - Edit existing units (name, plural form, category)
 * - Delete units with cascade warnings (shows affected canon items)
 * - Drag-and-drop reordering within categories
 *
 * All data flows through api.ts only — no direct imports from logic or data.
 * Uses Salt design primitives for responsive, consistent layout.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  getCanonUnits,
  getCanonItems,
  addCanonUnit,
  editCanonUnit,
  removeCanonUnit,
  reorderUnits,
  sortUnits,
  groupUnitsByCategory,
  type CanonItem,
} from '../api';
import type { Unit } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, GripVertical, AlertTriangle } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAdminRefresh } from '@/shared/providers';
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

type UnitCategory = 'weight' | 'volume' | 'count' | 'colloquial';

const UNIT_CATEGORIES: Record<UnitCategory, { label: string; description: string }> = {
  weight: { label: 'Weight', description: 'e.g., g, kg, oz, lb' },
  volume: { label: 'Volume', description: 'e.g., ml, l, cup, tbsp' },
  count: { label: 'Count', description: 'e.g., whole, piece, clove' },
  colloquial: { label: 'Colloquial', description: 'e.g., handful, pinch, bunch' },
};

// ── Main Component ────────────────────────────────────────────────────────────

export const CanonUnits: React.FC = () => {
  const { refreshTrigger } = useAdminRefresh();
  const [searchTerm, setSearchTerm] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<CanonItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentUnit, setCurrentUnit] = useState<Unit | null>(null);

  // ── Search / Filter ──────────────────────────────────────────────────────
  const filteredUnits = useMemo(() => {
    if (!searchTerm.trim()) return units;
    const lower = searchTerm.toLowerCase();
    return units.filter(unit =>
      unit.name.toLowerCase().includes(lower) ||
      (unit.plural?.toLowerCase().includes(lower))
    );
  }, [units, searchTerm]);

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
      const [unitsData, itemsData] = await Promise.all([
        getCanonUnits(),
        getCanonItems(),
      ]);
      setUnits(sortUnits(unitsData));
      setItems(itemsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load units');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleCreate = async (input: {
    name: string;
    plural?: string | null;
    category: UnitCategory;
  }) => {
    try {
      const categoryUnits = units.filter(u => u.category === input.category);
      const maxSortOrder = categoryUnits.reduce((max, u) => Math.max(max, u.sortOrder), 0);
      await addCanonUnit({ ...input, sortOrder: maxSortOrder + 1 });
      toast.success('Unit created successfully');
      await loadData();
      setShowCreateDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create unit');
    }
  };

  const handleEdit = async (
    id: string,
    updates: Partial<Pick<Unit, 'name' | 'plural' | 'category' | 'sortOrder'>>
  ) => {
    try {
      await editCanonUnit(id, updates);
      toast.success('Unit updated successfully');
      await loadData();
      setShowEditDialog(false);
      setCurrentUnit(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update unit');
    }
  };

  const getAffectedItems = (unitId: string): CanonItem[] => {
    return items.filter(item => item.preferredUnitId === unitId);
  };

  const handleDelete = async (id: string) => {
    try {
      await removeCanonUnit(id);
      toast.success('Unit deleted successfully');
      await loadData();
      setShowDeleteDialog(false);
      setCurrentUnit(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  };

  const handleDragEnd = async (event: DragEndEvent, category: UnitCategory) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const categoryUnits = units.filter(u => u.category === category);
    const oldIndex = categoryUnits.findIndex(u => u.id === active.id);
    const newIndex = categoryUnits.findIndex(u => u.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categoryUnits, oldIndex, newIndex);
    const otherUnits = units.filter(u => u.category !== category);
    const newUnits = [...otherUnits, ...reordered].sort((a, b) => {
      const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
    setUnits(newUnits);

    // Update sortOrder in backend
    const updates = reordered.map((unit, index) => ({
      id: unit.id,
      sortOrder: index,
    }));

    try {
      await reorderUnits(updates);
      toast.success('Unit order updated');
    } catch (err) {
      toast.error('Failed to update unit order');
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
          <h1 className="text-2xl font-bold text-foreground">Canon Units</h1>
          <div className="text-destructive">{error}</div>
        </Section>
      </Page>
    );
  }

  const groupedUnits = groupUnitsByCategory(units);
  const groupedFilteredUnits = groupUnitsByCategory(filteredUnits);
  const hasUnits = Object.values(groupedUnits).some(arr => arr.length > 0);
  const hasFilteredUnits = Object.values(groupedFilteredUnits).some(arr => arr.length > 0);

  return (
    <>
      <Page>
        {/* Header Section */}
        <Section spacing="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Canon Units</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Manage canonical measurement units grouped by category
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
            </Button>
          </div>
        </Section>

        {/* Search Input */}
        <Section>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Search units by name or plural form..."
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
              Found {filteredUnits.length} of {units.length} units
            </p>
          )}
        </Section>

        {/* Stats Section */}
        {hasFilteredUnits && (
          <Section spacing="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{filteredUnits.length} units {searchTerm ? `matching '${searchTerm}'` : ''}</Badge>
              {(Object.entries(groupedFilteredUnits) as [UnitCategory, Unit[]][]).map(
                ([category, categoryUnits]) =>
                  categoryUnits.length > 0 && (
                    <Badge key={category} variant="secondary">
                      {UNIT_CATEGORIES[category].label}: {categoryUnits.length}
                    </Badge>
                  )
              )}
            </div>
          </Section>
        )}

        {/* Units by Category */}
        {hasFilteredUnits ? (
          <Stack spacing="gap-6">
            {(Object.entries(groupedFilteredUnits) as [UnitCategory, Unit[]][]).map(
              ([category, categoryUnits]) =>
                categoryUnits.length > 0 && (
                  <Section key={category} spacing="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {UNIT_CATEGORIES[category].label}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        {UNIT_CATEGORIES[category].description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, category)}
                      >
                        <SortableContext
                          items={categoryUnits.map(u => u.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {categoryUnits.map(unit => (
                            <UnitRow
                              key={unit.id}
                              unit={unit}
                              affectedItems={getAffectedItems(unit.id)}
                              onEdit={(u) => {
                                setCurrentUnit(u);
                                setShowEditDialog(true);
                              }}
                              onDelete={(u) => {
                                setCurrentUnit(u);
                                setShowDeleteDialog(true);
                              }}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  </Section>
                )
            )}
          </Stack>
        ) : (
          <Section>
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              <p>{searchTerm ? 'No units match your search' : 'No units found'}</p>
              <Button
                variant="ghost"
                onClick={() => {
                  if (searchTerm) setSearchTerm('');
                  else setShowCreateDialog(true);
                }}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                {searchTerm ? 'Clear search' : 'Create your first unit'}
              </Button>
            </div>
          </Section>
        )}
      </Page>

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateUnitDialog
          onSubmit={handleCreate}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && currentUnit && (
        <EditUnitDialog
          unit={currentUnit}
          onSubmit={(updates) => handleEdit(currentUnit.id, updates)}
          onCancel={() => {
            setShowEditDialog(false);
            setCurrentUnit(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteDialog && currentUnit && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Unit</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{currentUnit.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Show affected items if any */}
            {(() => {
              const affected = getAffectedItems(currentUnit.id);
              return affected.length > 0 ? (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 my-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-destructive">
                        {affected.length} canon item{affected.length > 1 ? 's' : ''} will be affected:
                      </p>
                      <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-muted-foreground">
                        {affected.slice(0, 5).map(item => (
                          <li key={item.id}>{item.name}</li>
                        ))}
                        {affected.length > 5 && (
                          <li>and {affected.length - 5} more...</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowDeleteDialog(false);
                  setCurrentUnit(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(currentUnit.id)}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};

// ── Unit Row Component (Sortable) ─────────────────────────────────────────────

interface UnitRowProps {
  unit: Unit;
  affectedItems: CanonItem[];
  onEdit: (unit: Unit) => void;
  onDelete: (unit: Unit) => void;
}

const UnitRow: React.FC<UnitRowProps> = ({ unit, affectedItems, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: unit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Drag Handle */}
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Unit Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {unit.name}
            {unit.plural && <span className="text-muted-foreground text-sm ml-1">({unit.plural})</span>}
          </span>
          {affectedItems.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {affectedItems.length} item{affectedItems.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Sort Order: {unit.sortOrder}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(unit)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(unit)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

// ── Create Dialog ─────────────────────────────────────────────────────────────

interface CreateUnitDialogProps {
  onSubmit: (input: {
    name: string;
    plural?: string | null;
    category: UnitCategory;
  }) => Promise<void>;
  onCancel: () => void;
}

const CreateUnitDialog: React.FC<CreateUnitDialogProps> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [plural, setPlural] = useState('');
  const [category, setCategory] = useState<UnitCategory>('weight');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Unit name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        plural: plural.trim() || null,
        category,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Unit</DialogTitle>
          <DialogDescription>
            Add a new canonical measurement unit
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Stack spacing="gap-4">
            <div>
              <Label htmlFor="name">Unit Name (Singular)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., g, ml, clove, pinch"
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="plural">Plural Form (Optional)</Label>
              <Input
                id="plural"
                value={plural}
                onChange={(e) => setPlural(e.target.value)}
                placeholder="e.g., cloves (if singular is 'clove')"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as UnitCategory)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(UNIT_CATEGORIES) as [UnitCategory, typeof UNIT_CATEGORIES[UnitCategory]][]).map(
                    ([key, { label, description }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex flex-col">
                          <span>{label}</span>
                          <span className="text-xs text-muted-foreground">{description}</span>
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
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
                      Create Unit
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </Stack>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Edit Dialog ───────────────────────────────────────────────────────────────

interface EditUnitDialogProps {
  unit: Unit;
  onSubmit: (updates: Partial<Pick<Unit, 'name' | 'plural' | 'category' | 'sortOrder'>>) => Promise<void>;
  onCancel: () => void;
}

const EditUnitDialog: React.FC<EditUnitDialogProps> = ({ unit, onSubmit, onCancel }) => {
  const [name, setName] = useState(unit.name);
  const [plural, setPlural] = useState(unit.plural || '');
  const [category, setCategory] = useState<UnitCategory>(unit.category);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Unit name is required');
      return;
    }

    const updates: Partial<Pick<Unit, 'name' | 'plural' | 'category' | 'sortOrder'>> = {};
    if (name.trim() !== unit.name) updates.name = name.trim();
    if (plural.trim() !== (unit.plural || '')) updates.plural = plural.trim() || null;
    if (category !== unit.category) updates.category = category;

    if (Object.keys(updates).length === 0) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(updates);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Unit</DialogTitle>
          <DialogDescription>
            Update unit details
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Stack spacing="gap-4">
            <div>
              <Label htmlFor="edit-name">Unit Name (Singular)</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., g, ml, clove, pinch"
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="edit-plural">Plural Form (Optional)</Label>
              <Input
                id="edit-plural"
                value={plural}
                onChange={(e) => setPlural(e.target.value)}
                placeholder="e.g., cloves (if singular is 'clove')"
              />
            </div>

            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as UnitCategory)}>
                <SelectTrigger id="edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(UNIT_CATEGORIES) as [UnitCategory, typeof UNIT_CATEGORIES[UnitCategory]][]).map(
                    ([key, { label, description }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex flex-col">
                          <span>{label}</span>
                          <span className="text-xs text-muted-foreground">{description}</span>
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
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
