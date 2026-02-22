import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ShoppingList,
  ShoppingListItem,
  CanonicalItem,
  Unit,
  Aisle,
} from '../../../types/contract';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AddButton } from '@/components/ui/add-button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  MessageSquare,
  Trash2,
  CheckCheck,
  Eye,
  EyeOff,
  ShoppingCart,
} from 'lucide-react';
import { groupItemsByAisle, filterCanonicalItems } from '../utils';
import { softToast } from '@/lib/soft-toast';

// ─── Item Row ─────────────────────────────────────────────────────────────────
// Flat row — no Card wrapper. Mobile: swipe-left to reveal delete.
// Desktop: delete button visible on the right.

interface ItemRowProps {
  item: ShoppingListItem;
  onToggle: () => void;
  onDelete: () => void;
  onSaveNote: (note: string) => void;
  onEdit: () => void;
}

const ItemRow: React.FC<ItemRowProps> = ({ item, onToggle, onDelete, onSaveNote, onEdit }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note ?? '');
  const drag = useRef({ startX: 0, startY: 0, active: false, axis: null as 'x' | 'y' | null });

  useEffect(() => { setNoteValue(item.note ?? ''); }, [item.note]);

  const REVEAL_THRESHOLD = 40;
  const MAX_REVEAL = 72;

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, active: true, axis: null };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = drag.current.startX - e.clientX;
    const dy = Math.abs(e.clientY - drag.current.startY);
    if (!drag.current.axis) {
      if (Math.abs(dx) > 5 || dy > 5) drag.current.axis = Math.abs(dx) > dy ? 'x' : 'y';
      return;
    }
    if (drag.current.axis !== 'x') return;
    setSwipeX(dx > 0 ? Math.min(dx, MAX_REVEAL) : 0);
  };

  const onPointerUp = () => {
    drag.current.active = false;
    // Snap to revealed or closed, but don't auto-delete
    if (swipeX >= REVEAL_THRESHOLD) setSwipeX(MAX_REVEAL);
    else setSwipeX(0);
  };

  const handleDeleteClick = () => {
    setSwipeX(0);
    onDelete();
  };

  const hasNote = !!item.note?.trim();

  return (
    <div className="relative overflow-hidden border-b last:border-b-0">
      {/* Delete zone revealed on swipe — tappable */}
      <button
        className="absolute inset-y-0 right-0 w-18 bg-destructive flex items-center justify-center"
        onClick={handleDeleteClick}
        aria-label="Delete item"
      >
        <Trash2 className="h-4 w-4 text-destructive-foreground" />
      </button>

      {/* The row itself */}
      <div
        className={cn(
          'relative bg-background flex items-center gap-3 px-4 min-h-13 select-none',
          item.checked && 'opacity-50',
        )}
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: drag.current.active ? 'none' : 'transform 0.15s ease-out',
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { setSwipeX(0); drag.current.active = false; }}
      >
        <Checkbox
          checked={item.checked}
          onCheckedChange={onToggle}
          className="h-5 w-5 shrink-0"
          onClick={e => e.stopPropagation()}
        />

        <button
          className="flex-1 min-w-0 py-3.5 text-left cursor-pointer"
          onClick={(e) => {
            // Don't open edit modal if user was swiping
            if (swipeX > 0) {
              e.preventDefault();
              return;
            }
            onEdit();
          }}
        >
          <span className={cn('text-sm font-medium', item.checked && 'line-through text-muted-foreground')}>
            {item.name}
          </span>
          {(item.quantity !== undefined || item.unit) && (
            <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">
              {item.quantity} {item.unit}
            </span>
          )}
        </button>

        {/* Note popover */}
        <Popover open={noteOpen} onOpenChange={setNoteOpen}>
          <PopoverTrigger asChild>
            <button
              className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted shrink-0"
              onClick={e => e.stopPropagation()}
            >
              <MessageSquare
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  hasNote ? 'text-primary fill-primary/20' : 'text-muted-foreground/30',
                )}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="end" side="left">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Note</p>
            <Textarea
              value={noteValue}
              onChange={e => setNoteValue(e.target.value)}
              onBlur={() => {
                if (noteValue !== (item.note ?? '')) onSaveNote(noteValue);
                setNoteOpen(false);
              }}
              placeholder="Add a note..."
              className="text-sm"
              autoFocus
            />
          </PopoverContent>
        </Popover>

        {/* Delete — desktop only */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// ─── Add Item Dialog ──────────────────────────────────────────────────────────
// Stays open after adding so the user can quickly add multiple items.

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: Unit[];
  aisles: Aisle[];
  canonicalItems: CanonicalItem[];
  onAdd: (name: string, quantity: number, unit: string, aisle?: string) => Promise<void>;
}

const AddItemDialog: React.FC<AddItemDialogProps> = ({
  open,
  onOpenChange,
  units,
  aisles,
  canonicalItems,
  onAdd,
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [aisle, setAisle] = useState('');
  const [matched, setMatched] = useState<CanonicalItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setQuantity('');
      setUnit('');
      setAisle('');
      setMatched(null);
    }
  }, [open]);

  const suggestions = useMemo(
    () => (matched ? [] : filterCanonicalItems(canonicalItems, name)),
    [name, canonicalItems, matched],
  );

  const applyCanonical = (ci: CanonicalItem) => {
    setName(ci.name);
    setUnit(ci.preferredUnit || '');
    setAisle(ci.aisle || '');
    setMatched(ci);
  };

  const handleAdd = async () => {
    const qty = parseFloat(quantity);
    if (!name.trim() || !quantity.trim() || isNaN(qty) || qty <= 0) {
      softToast.warning('Enter a name and valid quantity');
      return;
    }
    setIsAdding(true);
    try {
      await onAdd(name.trim(), qty, unit || 'items', aisle || undefined);
      // Stay open — reset for the next item
      setName(''); setQuantity(''); setUnit(''); setAisle(''); setMatched(null);
      setTimeout(() => nameRef.current?.focus(), 50);
    } catch {
      // errors handled upstream
    } finally {
      setIsAdding(false);
    }
  };

  const isNew = !matched && name.trim().length > 0 && suggestions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to List</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="add-item-name">Item</Label>
            <Input
              id="add-item-name"
              ref={nameRef}
              placeholder="e.g. Tomatoes"
              value={name}
              onChange={e => { setName(e.target.value); setMatched(null); }}
              onKeyDown={e => { if (e.key === 'Enter' && !suggestions.length) handleAdd(); }}
              autoFocus
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="border rounded-md overflow-hidden shadow-sm bg-popover">
                {suggestions.map(ci => (
                  <button
                    key={ci.id}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2"
                    onMouseDown={e => { e.preventDefault(); applyCanonical(ci); }}
                  >
                    <span className="font-medium">{ci.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{ci.aisle}</span>
                  </button>
                ))}
              </div>
            )}
            {isNew && (
              <p className="text-xs text-muted-foreground">New item — will be added to the catalogue</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-item-qty">Quantity</Label>
              <Input
                id="add-item-qty"
                type="number"
                min="0.1"
                step="0.1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {units.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  {units.length === 0 && <SelectItem value="items">items</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Aisle</Label>
            <Select value={aisle} onValueChange={setAisle}>
              <SelectTrigger><SelectValue placeholder="Select aisle" /></SelectTrigger>
              <SelectContent>
                {aisles.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
              Done
            </Button>
            <Button onClick={handleAdd} disabled={isAdding || !name.trim() || !quantity.trim()}>
              {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Edit Item Dialog ─────────────────────────────────────────────────────────

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ShoppingListItem | null;
  units: Unit[];
  aisles: Aisle[];
  onSave: (id: string, name: string, quantity: number, unit: string, aisle?: string) => Promise<void>;
}

const EditItemDialog: React.FC<EditItemDialogProps> = ({
  open,
  onOpenChange,
  item,
  units,
  aisles,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [aisle, setAisle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && item) {
      setName(item.name);
      setQuantity(item.quantity?.toString() ?? '');
      setUnit(item.unit ?? '');
      setAisle(item.aisle ?? '');
    }
  }, [open, item]);

  const handleSave = async () => {
    if (!item) return;
    const qty = parseFloat(quantity);
    if (!name.trim() || !quantity.trim() || isNaN(qty) || qty <= 0) {
      softToast.warning('Enter a name and valid quantity');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(item.id, name.trim(), qty, unit || 'items', aisle || undefined);
      onOpenChange(false);
    } catch {
      // errors handled upstream
    } finally {
      setIsSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-item-name">Item</Label>
            <Input
              id="edit-item-name"
              placeholder="e.g. Tomatoes"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-item-qty">Quantity</Label>
              <Input
                id="edit-item-qty"
                type="number"
                min="0.1"
                step="0.1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {units.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  {units.length === 0 && <SelectItem value="items">items</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Aisle</Label>
            <Select value={aisle} onValueChange={setAisle}>
              <SelectTrigger><SelectValue placeholder="Select aisle" /></SelectTrigger>
              <SelectContent>
                {aisles.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim() || !quantity.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Detail View ─────────────────────────────────────────────────────────

interface ShoppingListDetailViewProps {
  list: ShoppingList;
  items: ShoppingListItem[];
  allLists: ShoppingList[];
  aisles: Aisle[];
  units: Unit[];
  canonicalItems: CanonicalItem[];
  isLoadingItems: boolean;
  onBack: () => void;
  onSwitchList: (id: string) => void;
  onAddItem: (name: string, quantity: number, unit: string, aisle?: string) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<ShoppingListItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onRemoveChecked: () => Promise<void>;
  onUpdateList: (id: string, updates: Partial<ShoppingList>) => Promise<void>;
  onDeleteList: (id: string) => Promise<void>;
}

export const ShoppingListDetailView: React.FC<ShoppingListDetailViewProps> = ({
  list,
  items,
  allLists,
  aisles,
  units,
  canonicalItems,
  isLoadingItems,
  onBack,
  onSwitchList,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onRemoveChecked,
  onUpdateList: _onUpdateList,
  onDeleteList,
}) => {
  const [showChecked, setShowChecked] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);
  const [listSwitchOpen, setListSwitchOpen] = useState(false);
  const [removeCheckedOpen, setRemoveCheckedOpen] = useState(false);
  const [deleteListOpen, setDeleteListOpen] = useState(false);
  const [removingChecked, setRemovingChecked] = useState(false);
  const [deletingList, setDeletingList] = useState(false);

  const checkedCount = items.filter(i => i.checked).length;
  const percentDone = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  const visibleItems = useMemo(
    () => showChecked ? items : items.filter(i => !i.checked),
    [items, showChecked],
  );

  const groupedByAisle = useMemo(
    () => groupItemsByAisle(visibleItems, aisles),
    [visibleItems, aisles],
  );

  const handleRemoveChecked = async () => {
    setRemovingChecked(true);
    try { await onRemoveChecked(); setRemoveCheckedOpen(false); }
    finally { setRemovingChecked(false); }
  };

  const handleDeleteList = async () => {
    setDeletingList(true);
    try { await onDeleteList(list.id); }
    finally { setDeletingList(false); }
  };

  const handleEditItem = (item: ShoppingListItem) => {
    setEditingItem(item);
    setEditOpen(true);
  };

  const handleSaveEdit = async (id: string, name: string, quantity: number, unit: string, aisle?: string) => {
    await onUpdateItem(id, { name, quantity, unit, aisle });
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 pb-3">
        <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* List name — tap to switch */}
        <Popover open={listSwitchOpen} onOpenChange={setListSwitchOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 flex-1 min-w-0 text-left">
              <span className="font-semibold text-lg truncate">{list.name}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {allLists.map(l => (
              <button
                key={l.id}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors flex items-center justify-between gap-2',
                  l.id === list.id && 'font-semibold text-primary',
                )}
                onClick={() => { onSwitchList(l.id); setListSwitchOpen(false); }}
              >
                <span className="truncate">{l.name}</span>
                {l.isDefault && <Badge variant="secondary" className="text-xs shrink-0">Default</Badge>}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <span className="text-sm tabular-nums text-muted-foreground shrink-0">
          {checkedCount}/{items.length}
        </span>
        <AddButton onClick={() => setAddOpen(true)} label="Add" className="shrink-0" />
      </div>

      {/* ── Progress bar ── */}
      {items.length > 0 && (
        <div className="h-0.75 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentDone}%` }}
          />
        </div>
      )}

      {/* ── Content ── */}
      {isLoadingItems ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center border border-dashed rounded-lg">
          <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Nothing on the list</p>
          <AddButton variant="outline" onClick={() => setAddOpen(true)} label="Add item" />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center border border-dashed rounded-lg">
          <CheckCheck className="h-8 w-8 text-primary/40" />
          <p className="font-medium">All done!</p>
          <Button variant="ghost" size="sm" onClick={() => setShowChecked(true)}>
            View ticked items
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {Object.entries(groupedByAisle).map(([aisleName, aisleItems], idx) => (
            <div key={aisleName}>
              {/* Aisle section label — minimal, not collapsible */}
              <div className={cn(
                'px-4 py-2 bg-muted/40 flex items-center gap-3',
                idx > 0 && 'border-t',
              )}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {aisleName}
                </span>
                <span className="text-xs text-muted-foreground/50 tabular-nums">
                  {aisleItems.filter(i => !i.checked).length} left
                </span>
              </div>

              {/* Item rows — plain divs, no Card wrapper */}
              {aisleItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => onUpdateItem(item.id, { checked: !item.checked })}
                  onDelete={() => onDeleteItem(item.id)}
                  onSaveNote={note => onUpdateItem(item.id, { note })}
                  onEdit={() => handleEditItem(item)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Footer actions ── */}
      {(checkedCount > 0 || true) && (
        <div className="flex items-center gap-2 pt-3 mt-4 border-t">
          {checkedCount > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs gap-1.5"
                onClick={() => setShowChecked(v => !v)}
              >
                {showChecked
                  ? <><EyeOff className="h-3 w-3" /> Hide {checkedCount} done</>
                  : <><Eye className="h-3 w-3" /> Show {checkedCount} done</>
                }
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs gap-1.5"
                onClick={() => setRemoveCheckedOpen(true)}
              >
                <CheckCheck className="h-3 w-3" />
                Clear done
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs gap-1 ml-auto hidden md:flex text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteListOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
            Delete list
          </Button>
        </div>
      )}

      {/* ── Dialogs ── */}

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        units={units}
        aisles={aisles}
        canonicalItems={canonicalItems}
        onAdd={onAddItem}
      />

      <EditItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={editingItem}
        units={units}
        aisles={aisles}
        onSave={handleSaveEdit}
      />

      <AlertDialog open={removeCheckedOpen} onOpenChange={setRemoveCheckedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear done items</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {checkedCount} ticked item{checkedCount !== 1 ? 's' : ''} from the list?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingChecked}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveChecked}
              disabled={removingChecked}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingChecked && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteListOpen} onOpenChange={setDeleteListOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{list.name}&rdquo; and all its items? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingList}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteList}
              disabled={deletingList}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingList && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
