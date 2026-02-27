import React, { useState, useEffect } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Pencil, X, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { RecipeCategory } from '../../../types/contract';
import { categoriesBackend } from '../backend';
import { softToast } from '@/lib/soft-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CategoriesManagementProps {
  onRefresh: () => void;
  onPendingChange?: () => void;
}

export const CategoriesManagement: React.FC<CategoriesManagementProps> = ({ 
  onRefresh,
  onPendingChange 
}) => {
  const [pendingCategories, setPendingCategories] = useState<RecipeCategory[]>([]);
  const [approvedCategories, setApprovedCategories] = useState<RecipeCategory[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<RecipeCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<RecipeCategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [synonymInput, setSynonymInput] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const [pending, all] = await Promise.all([
        categoriesBackend.getPendingCategories(),
        categoriesBackend.getCategories(),
      ]);
      
      setPendingCategories(pending);
      setApprovedCategories(all.filter(c => c.isApproved));
      onPendingChange?.();
    } catch (err) {
      console.error('Failed to load categories', err);
      softToast.error('Failed to load categories');
    }
  };

  const handleAddClick = () => {
    setName('');
    setDescription('');
    setSynonyms([]);
    setSynonymInput('');
    setShowAddDialog(true);
  };

  const handleAddSynonym = () => {
    // Split by comma, trim, lowercase, and filter duplicates/empty strings
    const newSynonyms = synonymInput
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s && !synonyms.includes(s));
    
    if (newSynonyms.length > 0) {
      setSynonyms([...synonyms, ...newSynonyms]);
      setSynonymInput('');
    }
  };

  const handleRemoveSynonym = (syn: string) => {
    setSynonyms(synonyms.filter(s => s !== syn));
  };

  const handleRemoveSynonymFromCategory = async (category: RecipeCategory, synToRemove: string) => {
    try {
      const updatedSynonyms = (category.synonyms || []).filter(s => s !== synToRemove);
      await categoriesBackend.updateCategory(category.id, {
        synonyms: updatedSynonyms,
      });
      await loadCategories();
      softToast.success('Synonym removed', { description: synToRemove });
      onRefresh();
    } catch (err) {
      console.error('Failed to remove synonym', err);
      softToast.error('Failed to remove synonym');
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      await categoriesBackend.createCategory({
        name: name.trim(),
        description: description.trim() || undefined,
        synonyms: synonyms.length > 0 ? synonyms : [],
        isApproved: true, // Manual categories are pre-approved
      });
      
      await loadCategories();
      setShowAddDialog(false);
      softToast.success('Category added', { description: name.trim() });
      onRefresh();
    } catch (err) {
      console.error('Failed to create category', err);
      softToast.error('Failed to add category');
    } finally {
      setIsAdding(false);
    }
  };

  const handleApprove = async (category: RecipeCategory) => {
    setApproving(category.id);
    try {
      await categoriesBackend.approveCategory(category.id);
      await loadCategories();
      softToast.success('Category approved', { description: category.name });
      onRefresh();
    } catch (err) {
      console.error('Failed to approve category', err);
      softToast.error('Failed to approve category');
    } finally {
      setApproving(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    
    setIsDeleting(true);
    try {
      await categoriesBackend.deleteCategory(categoryToDelete.id);
      await loadCategories();
      softToast.success('Category deleted', { description: categoryToDelete.name });
      onRefresh();
    } catch (err) {
      console.error('Failed to delete category', err);
      softToast.error('Failed to delete category');
    } finally {
      setIsDeleting(false);
      setCategoryToDelete(null);
    }
  };

  const handleEditClick = (category: RecipeCategory) => {
    setCategoryToEdit(category);
    setName(category.name);
    setDescription(category.description || '');
    setSynonyms(category.synonyms || []);
    setSynonymInput('');
  };

  const handleEditSave = async () => {
    if (!categoryToEdit || !name.trim()) return;
    
    setIsSaving(true);
    try {
      await categoriesBackend.updateCategory(categoryToEdit.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        synonyms: synonyms,
      });
      
      await loadCategories();
      setCategoryToEdit(null);
      softToast.success('Category updated', { description: name.trim() });
      onRefresh();
    } catch (err) {
      console.error('Failed to update category', err);
      softToast.error('Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    const allIds = [...filteredPendingCategories, ...filteredApprovedCategories].map(c => c.id);
    setSelectedIds(new Set(allIds));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      await Promise.all(idsToDelete.map(id => categoriesBackend.deleteCategory(id)));
      await loadCategories();
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      softToast.success(`Deleted ${idsToDelete.length} categor${idsToDelete.length === 1 ? 'y' : 'ies'}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to bulk delete categories', err);
      softToast.error('Failed to delete categories');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkApprove = async () => {
    setIsBulkApproving(true);
    try {
      const pendingIds = Array.from(selectedIds).filter(id =>
        pendingCategories.some(cat => cat.id === id)
      );
      await Promise.all(pendingIds.map(id => categoriesBackend.approveCategory(id)));
      await loadCategories();
      setSelectedIds(new Set());
      softToast.success(`Approved ${pendingIds.length} categor${pendingIds.length === 1 ? 'y' : 'ies'}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to bulk approve categories', err);
      softToast.error('Failed to approve categories');
    } finally {
      setIsBulkApproving(false);
    }
  };

  const filteredPendingCategories = pendingCategories.filter(cat =>
    filterText === '' || 
    cat.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (cat.synonyms && cat.synonyms.some(syn => syn.toLowerCase().includes(filterText.toLowerCase())))
  );

  const filteredApprovedCategories = approvedCategories.filter(cat =>
    filterText === '' || 
    cat.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (cat.synonyms && cat.synonyms.some(syn => syn.toLowerCase().includes(filterText.toLowerCase())))
  );

  const renderCategoryCard = (category: RecipeCategory, isPending: boolean) => (
    <div
      key={category.id}
      className={`p-4 border rounded-lg ${
        isPending 
          ? 'bg-warning/10 border-warning/30' 
          : 'bg-background shadow-sm hover:shadow-md transition-shadow'
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox 
          checked={selectedIds.has(category.id)}
          onCheckedChange={() => handleToggleSelect(category.id)}
          className="shrink-0 mt-1"
        />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{category.name}</p>
            
            
            {category.confidence && (
              <Badge variant="secondary" className="text-xs">
                CI: {Math.round(category.confidence * 100)}%
              </Badge>
            )}
          </div>
          
          {category.description && (
            <p className="text-xs text-muted-foreground">{category.description}</p>
          )}
          
          {category.synonyms && category.synonyms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {category.synonyms.map((syn) => (
                <Badge key={syn} variant="outline" className="text-xs pl-2 pr-1 flex items-center gap-1">
                  <span>{syn}</span>
                  <button
                    onClick={() => handleRemoveSynonymFromCategory(category, syn)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    title={`Remove synonym "${syn}"`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isPending && (
            <>
              <Button
                onClick={() => handleEditClick(category)}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleApprove(category)}
                variant="ghost"
                size="icon"
                disabled={approving === category.id}
                className="text-muted-foreground hover:bg-green-100 dark:hover:bg-green-950 hover:text-green-700 dark:hover:text-green-400"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {!isPending && (
            <Button
              onClick={() => handleEditClick(category)}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            onClick={() => setCategoryToDelete(category)}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Categories</CardTitle>
            <p className="text-sm text-muted-foreground">
              {approvedCategories.length} approved, {pendingCategories.length} pending
              {filterText && ` (${filteredPendingCategories.length + filteredApprovedCategories.length} filtered)`}
            </p>
          </div>
          <AddButton onClick={handleAddClick} className="shrink-0" label="Add" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col space-y-3 h-full px-0 md:px-6">
        {/* Filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filter categories by name or synonym..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selection Actions */}
        {selectedIds.size > 0 && (() => {
          const selectedPendingCount = Array.from(selectedIds).filter(id =>
            pendingCategories.some(cat => cat.id === id)
          ).length;
          
          return (
            <div className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
                {selectedPendingCount > 0 && (
                  <span className="text-warning ml-1">({selectedPendingCount} pending)</span>
                )}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectNone}
                >
                  Clear
                </Button>
                {selectedPendingCount > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleBulkApprove}
                    disabled={isBulkApproving}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {isBulkApproving ? 'Approving...' : `Approve (${selectedPendingCount})`}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete ({selectedIds.size})
                </Button>
              </div>
            </div>
          );
        })()}

        {/* Select All/None */}
        {(filteredPendingCategories.length > 0 || filteredApprovedCategories.length > 0) && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectNone}
              className="text-xs"
            >
              Select None
            </Button>
          </div>
        )}

        {/* Pending Categories Section */}
        {filteredPendingCategories.length > 0 && (
          <div className="space-y-3 shrink-0 w-full">
            <div>
              <h3 className="text-sm font-semibold text-warning flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pending Approval
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                AI-suggested categories awaiting review
              </p>
            </div>
            
            <div className="space-y-2">
              {filteredPendingCategories.map((category) => renderCategoryCard(category, true))}
            </div>
            
            <Separator />
          </div>
        )}

        {/* Approved Categories Section */}
        <div className="flex-1 min-h-0 space-y-3 flex flex-col w-full">
          <div>
            <h3 className="text-sm font-semibold">Approved Categories</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Active recipe categories
            </p>
          </div>

          {filteredApprovedCategories.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                {approvedCategories.length === 0 
                  ? 'No approved categories yet. Add categories above or approve pending suggestions.'
                  : 'No categories match your filter.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {filteredApprovedCategories.map((category) => renderCategoryCard(category, false))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Add Category Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add Recipe Category</DialogTitle>
              <DialogDescription>
                Create a new category for organising recipes
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Category Name</Label>
                  <Input 
                    id="add-name"
                    placeholder="e.g. Mains, Desserts, Quick Meals" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-description">Description</Label>
                  <Textarea 
                    id="add-description"
                    placeholder="Optional description of this category"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Synonyms</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add synonym"
                      value={synonymInput}
                      onChange={(e) => setSynonymInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSynonym();
                        }
                      }}
                    />
                    <AddButton type="button" onClick={handleAddSynonym} variant="outline" label="Add" />
                  </div>
                  
                  {synonyms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {synonyms.map((syn) => (
                        <Badge key={syn} variant="secondary" className="text-xs">
                          {syn}
                          <button
                            onClick={() => handleRemoveSynonym(syn)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isAdding}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!name.trim() || isAdding}
                className="flex-1"
              >
                {isAdding ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Category Dialog */}
        <Dialog open={!!categoryToEdit} onOpenChange={() => setCategoryToEdit(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Edit Recipe Category</DialogTitle>
              <DialogDescription>
                Update the category details
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Category Name</Label>
                  <Input 
                    id="edit-name"
                    placeholder="e.g. Mains, Desserts, Quick Meals" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea 
                    id="edit-description"
                    placeholder="Optional description of this category"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Synonyms</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add synonym"
                      value={synonymInput}
                      onChange={(e) => setSynonymInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSynonym();
                        }
                      }}
                    />
                    <AddButton type="button" onClick={handleAddSynonym} variant="outline" label="Add" />
                  </div>
                  
                  {synonyms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {synonyms.map((syn) => (
                        <Badge key={syn} variant="secondary" className="text-xs">
                          {syn}
                          <button
                            onClick={() => handleRemoveSynonym(syn)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setCategoryToEdit(null)}
                disabled={isSaving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={!name.trim() || isSaving}
                className="flex-1"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category?</AlertDialogTitle>
              <AlertDialogDescription>
                {categoryToDelete && (
                  <>
                    Are you sure you want to delete <strong>{categoryToDelete.name}</strong>? 
                    This action cannot be undone and may affect recipes in this category.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete Category'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} Categor{selectedIds.size === 1 ? 'y' : 'ies'}?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedIds.size} categor{selectedIds.size === 1 ? 'y' : 'ies'}? 
                This action cannot be undone and may affect recipes in these categories.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Categor${selectedIds.size === 1 ? 'y' : 'ies'}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </>
  );
};
