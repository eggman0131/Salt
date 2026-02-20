import React, { useState, useEffect } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import { CanonicalItem, Unit, Aisle } from '../../../types/contract';
import { kitchenDataBackend } from '../backend';
import { softToast } from '@/lib/soft-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ItemsManagementProps {
  onRefresh: () => void;
}

export const ItemsManagement: React.FC<ItemsManagementProps> = ({ onRefresh }) => {
  const [items, setItems] = useState<CanonicalItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [itemToDelete, setItemToDelete] = useState<CanonicalItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CanonicalItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [isStaple, setIsStaple] = useState(false);
  const [aisleId, setAisleId] = useState<string>('none');
  const [unitId, setUnitId] = useState<string>('none');
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [synonymInput, setSynonymInput] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsData, unitsData, aislesData] = await Promise.all([
        kitchenDataBackend.getCanonicalItems(),
        kitchenDataBackend.getUnits(),
        kitchenDataBackend.getAisles(),
      ]);
      setItems(itemsData);
      setUnits(unitsData);
      setAisles(aislesData);
    } catch (err) {
      console.error('Failed to load data', err);
      softToast.error('Failed to load items');
    }
  };

  const handleAddClick = () => {
    setName('');
    setIsStaple(false);
    setAisleId('none');
    setUnitId('none');
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
      await kitchenDataBackend.createCanonicalItem({
        name: name.trim(),
        normalisedName: name.trim().toLowerCase(),
        isStaple,
        aisle: aisleId && aisleId !== 'none' ? aisleId : undefined,
        preferredUnit: unitId && unitId !== 'none' ? unitId : undefined,
        synonyms: synonyms.length > 0 ? synonyms : [],
      });
      
      await loadData();
      setShowAddDialog(false);
      softToast.success('Item added', { description: name.trim() });
      onRefresh();
    } catch (err) {
      console.error('Failed to create item', err);
      softToast.error('Failed to add item');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    try {
      await kitchenDataBackend.deleteCanonicalItem(itemToDelete.id);
      await loadData();
      softToast.success('Item deleted', { description: itemToDelete.name });
      onRefresh();
    } catch (err) {
      console.error('Failed to delete item', err);
      softToast.error('Failed to delete item');
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const handleEditClick = (item: CanonicalItem) => {
    setItemToEdit(item);
    setName(item.name);
    setIsStaple(item.isStaple);
    setAisleId(item.aisle || 'none');
    setUnitId(item.preferredUnit || 'none');
    setSynonyms(item.synonyms || []);
    setSynonymInput('');
  };

  const handleEditSave = async () => {
    if (!itemToEdit || !name.trim()) return;
    
    setIsSaving(true);
    try {
      await kitchenDataBackend.updateCanonicalItem(itemToEdit.id, {
        name: name.trim(),
        normalisedName: name.trim().toLowerCase(),
        isStaple,
        aisle: aisleId && aisleId !== 'none' ? aisleId : undefined,
        preferredUnit: unitId && unitId !== 'none' ? unitId : undefined,
        synonyms: synonyms,
      });
      
      await loadData();
      setItemToEdit(null);
      softToast.success('Item updated', { description: name.trim() });
      onRefresh();
    } catch (err) {
      console.error('Failed to update item', err);
      softToast.error('Failed to update item');
    } finally {
      setIsSaving(false);
    }
  };

  const getAisleName = (aisleId?: string) => {
    if (!aisleId) return 'None';
    return aisles.find(a => a.id === aisleId)?.name || 'Unknown';
  };

  const getUnitName = (unitId?: string) => {
    if (!unitId) return 'None';
    return units.find(u => u.id === unitId)?.name || 'Unknown';
  };

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Canonical Items</CardTitle>
            <p className="text-sm text-muted-foreground">
              {items.length} canonical {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <Button onClick={handleAddClick} className="shrink-0">
            + Add
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col space-y-3 h-full px-0 md:px-6">
        {/* Items List */}
        <div className="flex-1 min-h-0">
          {items.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                No canonical items yet. Add items above.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.isStaple && (
                        <Badge variant="secondary" className="text-xs">
                          Staple
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium">Aisle:</span> {getAisleName(item.aisle)}
                        {' · '}
                        <span className="font-medium">Unit:</span> {getUnitName(item.preferredUnit)}
                      </p>
                      
                      {item.synonyms && item.synonyms.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.synonyms.map((syn) => (
                            <Badge key={syn} variant="outline" className="text-xs">
                              {syn}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      onClick={() => handleEditClick(item)}
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setItemToDelete(item)}
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
            )}
        </div>

        {/* Add Item Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add Canonical Item</DialogTitle>
              <DialogDescription>
                Create a new standard ingredient for recipes
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Item Name</Label>
                  <Input 
                    id="add-name"
                    placeholder="e.g. Chicken Breast" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="add-staple"
                    checked={isStaple}
                    onCheckedChange={(checked) => setIsStaple(checked as boolean)}
                  />
                  <Label htmlFor="add-staple" className="cursor-pointer">
                    Mark as staple ingredient
                  </Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aisle</Label>
                    <Select value={aisleId} onValueChange={setAisleId}>
                      <SelectTrigger>
                        <SelectValue>{getAisleName(aisleId)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="none">None</SelectItem>
                        {aisles.map((aisle) => (
                          <SelectItem key={aisle.id} value={aisle.id}>
                            {aisle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Unit</Label>
                    <Select value={unitId} onValueChange={setUnitId}>
                      <SelectTrigger>
                        <SelectValue>{getUnitName(unitId)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="none">None</SelectItem>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Button type="button" onClick={handleAddSynonym} variant="outline">
                      Add
                    </Button>
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
              <Button
                onClick={handleAdd}
                disabled={!name.trim() || isAdding}
              >
                {isAdding ? 'Adding...' : 'Add Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={!!itemToEdit} onOpenChange={() => setItemToEdit(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Edit Canonical Item</DialogTitle>
              <DialogDescription>
                Update the item details
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Item Name</Label>
                  <Input 
                    id="edit-name"
                    placeholder="e.g. Chicken Breast" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="edit-staple"
                    checked={isStaple}
                    onCheckedChange={(checked) => setIsStaple(checked as boolean)}
                  />
                  <Label htmlFor="edit-staple" className="cursor-pointer">
                    Mark as staple ingredient
                  </Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aisle</Label>
                    <Select value={aisleId} onValueChange={setAisleId}>
                      <SelectTrigger>
                        <SelectValue>{getAisleName(aisleId)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="none">None</SelectItem>
                        {aisles.map((aisle) => (
                          <SelectItem key={aisle.id} value={aisle.id}>
                            {aisle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Unit</Label>
                    <Select value={unitId} onValueChange={setUnitId}>
                      <SelectTrigger>
                        <SelectValue>{getUnitName(unitId)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="none">None</SelectItem>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Button type="button" onClick={handleAddSynonym} variant="outline">
                      Add
                    </Button>
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
                onClick={() => setItemToEdit(null)}
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
        <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Item?</AlertDialogTitle>
              <AlertDialogDescription>
                {itemToDelete && (
                  <>
                    Are you sure you want to delete <strong>{itemToDelete.name}</strong>? 
                    This action cannot be undone and may affect recipes using this item.
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
                {isDeleting ? 'Deleting...' : 'Delete Item'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </>
  );
};
