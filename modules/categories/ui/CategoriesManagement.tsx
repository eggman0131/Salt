/**
 * Categories Management UI
 *
 * Full-featured category management: search, filter, multiselect,
 * bulk approve/delete, and complete CRUD via dialogs.
 * Uses getCategories() as single source of truth and filters client-side
 * to avoid the dual-fetch overlap bug in the previous implementation.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { RecipeCategory } from '../../../types/contract';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  approveCategory,
} from '../api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  Sparkles,
  Trash2,
  Pencil,
  CheckCheck,
  X,
  AlertCircle,
} from 'lucide-react';
import { useAdminRefresh } from '@/shared/providers';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'approved' | 'pending';

interface CategoryFormState {
  name: string;
  description: string;
  synonymsInput: string;
  synonyms: string[];
}

const emptyForm = (): CategoryFormState => ({
  name: '',
  description: '',
  synonymsInput: '',
  synonyms: [],
});

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ category: RecipeCategory }> = ({ category }) => {
  if (category.isApproved) {
    return (
      <Badge variant="secondary" className="gap-1 text-green-700 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800">
      <Clock className="h-3 w-3" />
      Pending Review
    </Badge>
  );
};

const SourceCell: React.FC<{ category: RecipeCategory }> = ({ category }) => {
  if (category.confidence == null) {
    return <span className="text-muted-foreground text-sm">Manual</span>;
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 cursor-default">
            <Sparkles className="h-3 w-3" />
            AI · {Math.round(category.confidence * 100)}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          AI suggested with {Math.round(category.confidence * 100)}% confidence
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ── Tag input ─────────────────────────────────────────────────────────────────

const SynonymsInput: React.FC<{
  synonyms: string[];
  input: string;
  onChange: (synonyms: string[], input: string) => void;
}> = ({ synonyms, input, onChange }) => {
  const commit = () => {
    const val = input.trim().replace(/,$/, '');
    if (val && !synonyms.includes(val)) {
      onChange([...synonyms, val], '');
    } else {
      onChange(synonyms, '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !input && synonyms.length > 0) {
      onChange(synonyms.slice(0, -1), '');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-9 p-2 rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
        {synonyms.map(s => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-sm"
          >
            {s}
            <button
              type="button"
              onClick={() => onChange(synonyms.filter(x => x !== s), input)}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder={synonyms.length === 0 ? 'Type and press Enter or comma…' : 'Add more…'}
          value={input}
          onChange={e => onChange(synonyms, e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
        />
      </div>
      <p className="text-xs text-muted-foreground">Press Enter or comma to add each synonym</p>
    </div>
  );
};

// ── Category form dialog ──────────────────────────────────────────────────────

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RecipeCategory | null;
  onSave: (form: CategoryFormState) => Promise<void>;
}

const CategoryDialog: React.FC<CategoryDialogProps> = ({ open, onOpenChange, editing, onSave }) => {
  const [form, setForm] = useState<CategoryFormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? { name: editing.name, description: editing.description ?? '', synonymsInput: '', synonyms: editing.synonyms ?? [] }
          : emptyForm()
      );
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle>
          <DialogDescription>
            {editing ? `Editing "${editing.name}"` : 'Create a new recipe category.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Italian"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this category…"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Synonyms</Label>
            <SynonymsInput
              synonyms={form.synonyms}
              input={form.synonymsInput}
              onChange={(synonyms, synonymsInput) => setForm(f => ({ ...f, synonyms, synonymsInput }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || isSaving}>
            {isSaving ? 'Saving…' : editing ? 'Save Changes' : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const CategoriesManagement: React.FC = () => {
  const { refreshTrigger } = useAdminRefresh();

  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toolbar state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RecipeCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<'selected' | RecipeCategory | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  // ── Data ──

  const load = useCallback(async () => {
    setError(null);
    try {
      const all = await getCategories();
      setCategories(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  // ── Filtered view ──

  const filtered = useMemo(() => {
    let list = categories;

    if (statusFilter === 'approved') list = list.filter(c => c.isApproved);
    else if (statusFilter === 'pending') list = list.filter(c => !c.isApproved);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.synonyms?.some(s => s.toLowerCase().includes(q))
      );
    }

    return list;
  }, [categories, statusFilter, search]);

  const pendingCount = useMemo(() => categories.filter(c => !c.isApproved).length, [categories]);

  // ── Selection helpers ──

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.delete(c.id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.add(c.id)); return s; });
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // ── CRUD handlers ──

  const handleSaveCategory = async (form: CategoryFormState) => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      synonyms: form.synonyms.length ? form.synonyms : undefined,
    };

    if (editingCategory) {
      await updateCategory(editingCategory.id, payload);
    } else {
      await createCategory({ ...payload, isApproved: true });
    }
    await load();
    setEditingCategory(null);
  };

  const handleApprove = async (ids: string[]) => {
    setIsActioning(true);
    try {
      await Promise.all(ids.map(id => approveCategory(id)));
      setSelected(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
      await load();
    } finally {
      setIsActioning(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsActioning(true);
    try {
      const ids = deleteTarget === 'selected'
        ? [...selected]
        : [deleteTarget.id];
      await Promise.all(ids.map(id => deleteCategory(id)));
      setSelected(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
      await load();
    } finally {
      setIsActioning(false);
      setDeleteTarget(null);
    }
  };

  const openCreate = () => { setEditingCategory(null); setDialogOpen(true); };
  const openEdit = (cat: RecipeCategory) => { setEditingCategory(cat); setDialogOpen(true); };

  // ── Counts for delete dialog ──
  const deleteLabel = deleteTarget === 'selected'
    ? `${selected.size} ${selected.size === 1 ? 'category' : 'categories'}`
    : deleteTarget
      ? `"${deleteTarget.name}"`
      : '';

  // ── Selected pending count for bulk approve ──
  const selectedPendingIds = useMemo(
    () => [...selected].filter(id => categories.find(c => c.id === id && !c.isApproved)),
    [selected, categories]
  );

  // ── Skeleton ──
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
        </div>
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Pending notice */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <div
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
          onClick={() => setStatusFilter('pending')}
        >
          <Clock className="h-4 w-4 shrink-0" />
          <span><strong>{pendingCount}</strong> {pendingCount === 1 ? 'category requires' : 'categories require'} approval — click to filter</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, description or synonym…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({categories.length})</SelectItem>
            <SelectItem value="approved">Approved ({categories.filter(c => c.isApproved).length})</SelectItem>
            <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={openCreate} className="gap-2 shrink-0 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium flex-1">
            {selected.size} selected
          </span>
          {selectedPendingIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={isActioning}
              onClick={() => handleApprove(selectedPendingIds)}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Approve {selectedPendingIds.length > 1 ? `(${selectedPendingIds.length})` : ''}
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            disabled={isActioning}
            onClick={() => setDeleteTarget('selected')}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete {selected.size > 1 ? `(${selected.size})` : ''}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== 'all'
              ? 'No categories match your current filters.'
              : 'No categories yet. Create one to get started.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Synonyms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="hidden lg:table-cell w-32">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cat => (
                <TableRow
                  key={cat.id}
                  className={selected.has(cat.id) ? 'bg-primary/5' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(cat.id)}
                      onCheckedChange={() => toggleOne(cat.id)}
                      aria-label={`Select ${cat.name}`}
                    />
                  </TableCell>

                  <TableCell>
                    <div>
                      <p className="font-medium leading-snug">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{cat.description}</p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    {cat.synonyms && cat.synonyms.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {cat.synonyms.slice(0, 4).map(s => (
                          <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
                        ))}
                        {cat.synonyms.length > 4 && (
                          <Badge variant="secondary" className="text-xs font-normal">+{cat.synonyms.length - 4}</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <StatusBadge category={cat} />
                  </TableCell>

                  <TableCell className="hidden lg:table-cell">
                    <SourceCell category={cat} />
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {new Date(cat.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Row actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(cat)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {!cat.isApproved && (
                          <DropdownMenuItem onClick={() => handleApprove([cat.id])}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(cat)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right px-1">
          Showing {filtered.length} of {categories.length} categories
        </p>
      )}

      {/* Create / Edit dialog */}
      <CategoryDialog
        open={dialogOpen}
        onOpenChange={open => { setDialogOpen(open); if (!open) setEditingCategory(null); }}
        editing={editingCategory}
        onSave={handleSaveCategory}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteLabel} from the system. Recipes that use{' '}
              {deleteTarget === 'selected' && selected.size > 1 ? 'these categories' : 'this category'}{' '}
              will become uncategorised. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActioning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isActioning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isActioning ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
