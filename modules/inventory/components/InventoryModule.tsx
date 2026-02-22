import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Trash2, Pencil, X, Loader2 } from 'lucide-react';
import { Equipment, EquipmentCandidate } from '../../../types/contract';
import { inventoryBackend } from '../backend';
import { softToast } from '@/lib/soft-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InventoryModuleProps {
  inventory: Equipment[];
  onRefresh: () => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ inventory, onRefresh }) => {
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [equipmentToEdit, setEquipmentToEdit] = useState<Equipment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<EquipmentCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Edit state
  const [status, setStatus] = useState<Equipment['status']>('Available');
  const [accessories, setAccessories] = useState<Equipment['accessories']>([]);
  const [newAccessoryName, setNewAccessoryName] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleAddClick = () => {
    setSearchQuery('');
    setCandidates([]);
    setHasSearched(false);
    setShowAddDialog(true);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await inventoryBackend.searchEquipmentCandidates(searchQuery.trim());
      setCandidates(results);

      if (results.length === 0) {
        softToast.info('No matches found', { description: 'Try a different search term' });
      }
    } catch (err) {
      console.error('Failed to search equipment', err);
      softToast.error('Search failed', { description: 'Please try again' });
      setCandidates([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidate = async (candidate: EquipmentCandidate) => {
    setIsGenerating(true);
    try {
      const details = await inventoryBackend.generateEquipmentDetails(candidate);

      const newEquipment = {
        name: `${candidate.brand} ${candidate.modelName}`,
        brand: candidate.brand || details.brand || '',
        modelName: candidate.modelName || details.modelName || '',
        type: details.type || '',
        class: details.class || '',
        description: details.description || candidate.description || '',
        status: 'Available' as const,
        accessories: (details.accessories || []).map((acc) => ({
          ...acc,
          id: acc.id || uuidv4(),
        })),
      };

      await inventoryBackend.createEquipment(newEquipment);
      softToast.success('Equipment added', { description: newEquipment.name });
      await onRefresh();
      setShowAddDialog(false);
    } catch (err) {
      console.error('Failed to add equipment:', err);
      softToast.error('Failed to add equipment', { description: 'Please try again' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!equipmentToDelete) return;

    setIsDeleting(true);
    try {
      await inventoryBackend.deleteEquipment(equipmentToDelete.id);
      await onRefresh();
      softToast.success('Equipment deleted', { description: equipmentToDelete.name });
    } catch (err) {
      console.error('Failed to delete equipment', err);
      softToast.error('Failed to delete equipment');
    } finally {
      setIsDeleting(false);
      setEquipmentToDelete(null);
    }
  };

  const handleEditClick = (equipment: Equipment) => {
    setEquipmentToEdit(equipment);
    setStatus(equipment.status);
    setAccessories(equipment.accessories || []);
    setNewAccessoryName('');
  };

  const handleAddAccessory = async () => {
    if (!newAccessoryName.trim() || !equipmentToEdit || isValidating) return;

    setIsValidating(true);
    try {
      const validated = await inventoryBackend.validateAccessory(
        equipmentToEdit.name || equipmentToEdit.brand || 'Equipment',
        newAccessoryName.trim()
      );

      setAccessories([
        ...accessories,
        {
          ...validated,
          id: uuidv4(),
        },
      ]);
      setNewAccessoryName('');
      softToast.success('Accessory added');
    } catch (err) {
      console.error('Failed to validate accessory', err);
      softToast.error('Failed to add accessory');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveAccessory = (accessoryId: string) => {
    setAccessories(accessories.filter((a) => a.id !== accessoryId));
  };

  const handleToggleAccessoryOwned = (accessoryId: string) => {
    setAccessories(
      accessories.map((a) => (a.id === accessoryId ? { ...a, owned: !a.owned } : a))
    );
  };

  const handleEditSave = async () => {
    if (!equipmentToEdit) return;

    setIsSaving(true);
    try {
      await inventoryBackend.updateEquipment(equipmentToEdit.id, {
        status,
        accessories,
      });

      await onRefresh();
      setEquipmentToEdit(null);
      softToast.success('Equipment updated', { description: equipmentToEdit.name });
    } catch (err) {
      console.error('Failed to update equipment', err);
      softToast.error('Failed to update equipment');
    } finally {
      setIsSaving(false);
    }
  };

  const categoryVariant = (category: EquipmentCandidate['category']) => {
    switch (category) {
      case 'Complex Appliance':
        return 'default' as const;
      case 'Technical Cookware':
        return 'secondary' as const;
      case 'Standard Tool':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Kitchen Equipment</CardTitle>
            <p className="text-sm text-muted-foreground">
              {inventory.length} {inventory.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <AddButton onClick={handleAddClick} className="shrink-0" label="Add" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col space-y-3 h-full px-0 md:px-6">
        {/* Equipment List */}
        <div className="flex-1 min-h-0">
          {inventory.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                No equipment yet. Add equipment above.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop with ScrollArea */}
              <div className="hidden md:block h-full">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {inventory.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm line-clamp-2 flex-1">{item.name}</p>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {item.status}
                            </Badge>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>
                              <span className="font-medium">Brand:</span> {item.brand}
                            </p>
                            <p>
                              <span className="font-medium">Model:</span> {item.modelName}
                            </p>
                            <p>
                              <span className="font-medium">Type:</span> {item.type}
                            </p>
                            <p>
                              <span className="font-medium">Class:</span> {item.class}
                            </p>

                            {item.accessories && item.accessories.length > 0 && (
                              <p className="pt-1">
                                {item.accessories.filter((a) => a.owned).length} /{' '}
                                {item.accessories.length} accessories
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 pt-2 border-t">
                          <Button
                            onClick={() => handleEditClick(item)}
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => setEquipmentToDelete(item)}
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
              </div>

              {/* Mobile without ScrollArea */}
              <div className="md:hidden">
                <div className="grid grid-cols-1 gap-3">
                  {inventory.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 p-3 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm line-clamp-2 flex-1">{item.name}</p>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {item.status}
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            <span className="font-medium">Brand:</span> {item.brand}
                          </p>
                          <p>
                            <span className="font-medium">Model:</span> {item.modelName}
                          </p>
                          <p>
                            <span className="font-medium">Type:</span> {item.type}
                          </p>
                          <p>
                            <span className="font-medium">Class:</span> {item.class}
                          </p>

                          {item.accessories && item.accessories.length > 0 && (
                            <p className="pt-1">
                              {item.accessories.filter((a) => a.owned).length} /{' '}
                              {item.accessories.length} accessories
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 pt-2 border-t">
                        <Button
                          onClick={() => handleEditClick(item)}
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => setEquipmentToDelete(item)}
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
              </div>
            </>
          )}
        </div>
      </CardContent>

      {/* Add Equipment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Equipment</DialogTitle>
          <DialogDescription>
            Search our database or add a new item to your kitchen.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="search-query">Search</Label>
                  <div className="flex gap-2">
                    <Input
                      id="search-query"
                      placeholder="e.g., KitchenAid Stand Mixer"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearch();
                        }
                      }}
                      disabled={isSearching || isGenerating}
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || isSearching || isGenerating}
                      variant="outline"
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                </div>

                {/* Results */}
                {isSearching ? (
                  <div className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-3">
                      Searching equipment database...
                    </p>
                  </div>
                ) : isGenerating ? (
                  <div className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-3">
                      Generating equipment details...
                    </p>
                  </div>
                ) : hasSearched && candidates.length === 0 ? (
                  <div className="py-12 text-center border border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      No equipment found matching "{searchQuery}"
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try a different search term or brand name
                    </p>
                  </div>
                ) : candidates.length > 0 ? (
                  <div className="space-y-2">
                    {candidates.map((candidate, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectCandidate(candidate)}
                        className="w-full text-left p-3 border rounded-lg hover:border-primary/50 transition-colors"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">
                                {candidate.brand} {candidate.modelName}
                              </p>
                            </div>
                            <Badge
                              variant={categoryVariant(candidate.category)}
                              className="text-xs shrink-0"
                            >
                              {candidate.category}
                            </Badge>
                          </div>

                          {candidate.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {candidate.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Edit Equipment Dialog */}
      <Dialog open={!!equipmentToEdit} onOpenChange={() => setEquipmentToEdit(null)}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{equipmentToEdit?.name}</DialogTitle>
          <DialogDescription>
            {equipmentToEdit?.brand} • {equipmentToEdit?.modelName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex gap-2 flex-wrap">
                    {(['Available', 'In Use', 'Maintenance'] as const).map((s) => (
                      <Button
                        key={s}
                        onClick={() => setStatus(s)}
                        variant={status === s ? 'default' : 'outline'}
                        size="sm"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Equipment Details */}
                {equipmentToEdit && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Equipment Details</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Brand:</span>
                        <p className="font-medium">{equipmentToEdit.brand}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Model:</span>
                        <p className="font-medium">{equipmentToEdit.modelName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <p className="font-medium">{equipmentToEdit.type}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Class:</span>
                        <p className="font-medium">{equipmentToEdit.class}</p>
                      </div>
                    </div>
                    {equipmentToEdit.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {equipmentToEdit.description}
                      </p>
                    )}
                  </div>
                )}

                {/* Accessories */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Accessories</Label>
                    {accessories && accessories.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {accessories.filter((a) => a.owned).length} / {accessories.length} owned
                      </Badge>
                    )}
                  </div>

                  {/* Add Accessory */}
                  <div className="space-y-2 rounded-lg border border-dashed p-3">
                    <Label htmlFor="new-accessory" className="text-xs">
                      Add New Accessory
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="new-accessory"
                        placeholder="e.g., Pasta Attachment"
                        value={newAccessoryName}
                        onChange={(e) => setNewAccessoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAccessory();
                          }
                        }}
                        disabled={isValidating}
                      />
                      <AddButton
                        type="button"
                        onClick={handleAddAccessory}
                        disabled={!newAccessoryName.trim() || isValidating}
                        variant="outline"
                        label={isValidating ? 'Validating...' : 'Add'}
                      />
                    </div>
                  </div>

                  {/* Accessories List */}
                  {accessories && accessories.length > 0 ? (
                    <div className="space-y-2">
                      {accessories.map((accessory) => (
                        <div
                          key={accessory.id}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <Checkbox
                            checked={accessory.owned}
                            onCheckedChange={() => handleToggleAccessoryOwned(accessory.id)}
                          />

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{accessory.name}</p>
                            {accessory.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {accessory.description}
                              </p>
                            )}
                            <Badge variant="outline" className="mt-1 text-xs">
                              {accessory.type}
                            </Badge>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAccessory(accessory.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center border border-dashed rounded-lg">
                      <p className="text-sm text-muted-foreground">No accessories yet</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEquipmentToEdit(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!equipmentToDelete} onOpenChange={() => setEquipmentToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Equipment?</AlertDialogTitle>
          <AlertDialogDescription>
            {equipmentToDelete && (
              <>
                Are you sure you want to delete <strong>{equipmentToDelete.name}</strong>?
                {equipmentToDelete.accessories && equipmentToDelete.accessories.length > 0 && (
                  <>
                    {' '}
                    This equipment has {equipmentToDelete.accessories.length} accessor
                    {equipmentToDelete.accessories.length !== 1 ? 'ies' : 'y'} that will
                    also be deleted.
                  </>
                )}
                {' '}
                This action cannot be undone.
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
            {isDeleting ? 'Deleting...' : 'Delete Equipment'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

