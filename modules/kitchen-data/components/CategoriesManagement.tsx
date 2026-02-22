import React, { useState, useEffect } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Trash2, Pencil, X, CheckCircle, AlertCircle } from 'lucide-react';
import { RecipeCategory } from '../../../types/contract';
import { kitchenDataBackend } from '../backend';
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
        kitchenDataBackend.getPendingCategories(),
        kitchenDataBackend.getCategories(),
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
    const trimmed = synonymInput.trim().toLowerCase();
    if (trimmed && !synonyms.includes(trimmed)) {
      setSynonyms([...synonyms, trimmed]);
      setSynonymInput('');
    }
  };

  const handleRemoveSynonym = (syn: string) => {
    setSynonyms(synonyms.filter(s => s !== syn));
  };

  const handleAdd = async () => {
    if (!name.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      await kitchenDataBackend.createCategory({
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
      await kitchenDataBackend.approveCategory(category.id);
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
      await kitchenDataBackend.deleteCategory(categoryToDelete.id);
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
      await kitchenDataBackend.updateCategory(categoryToEdit.id, {
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
                <Badge key={syn} variant="outline" className="text-xs">
                  {syn}
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
            </p>
          </div>
          <AddButton onClick={handleAddClick} className="shrink-0" label="Add" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col space-y-3 h-full px-0 md:px-6">
        {/* Pending Categories Section */}
        {pendingCategories.length > 0 && (
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
              {pendingCategories.map((category) => renderCategoryCard(category, true))}
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

          {approvedCategories.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                No approved categories yet. Add categories above or approve pending suggestions.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {approvedCategories.map((category) => renderCategoryCard(category, false))}
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

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <AddButton
                onClick={handleAdd}
                disabled={!name.trim() || isAdding}
                label={isAdding ? 'Adding...' : 'Add Category'}
              />
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

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCategoryToEdit(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={!name.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
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
      </CardContent>
    </>
  );
};
