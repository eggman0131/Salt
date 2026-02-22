import React from 'react';
import { ShoppingList, ShoppingListItem, CanonicalItem, Unit, Aisle } from '../../../../types/contract';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { ScrollArea } from '../../../../components/ui/scroll-area';
import { Check, Loader2, Plus } from 'lucide-react';

interface ShoppingListModalsProps {
  // List Selector Modal
  showListSelector: boolean;
  lists: ShoppingList[];
  selectedList: ShoppingList | null;
  onSelectList: (list: ShoppingList) => void;
  onCloseListSelector: () => void;

  // New List Modal
  showNewListModal: boolean;
  newListName: string;
  isCreatingList: boolean;
  onNewListNameChange: (name: string) => void;
  onCreateList: () => void;
  onCloseNewListModal: () => void;

  // Add Items Modal
  showAddItemsModal: boolean;
  manualItemName: string;
  manualItemQuantity: string;
  manualItemUnit: string;
  manualItemAisle: string;
  isAddingItem: boolean;
  addSuccess: boolean;
  selectedCanonicalItem: CanonicalItem | null;
  filteredIngredients: CanonicalItem[];
  units: Unit[];
  aisles: Aisle[];
  onManualItemNameChange: (name: string) => void;
  onManualItemQuantityChange: (quantity: string) => void;
  onManualItemUnitChange: (unit: string) => void;
  onManualItemAisleChange: (aisle: string) => void;
  onSelectCanonicalItem: (item: CanonicalItem) => void;
  onAddItem: () => void;
  onCloseAddItemsModal: () => void;

  // Delete Modals
  showDeleteConfirmModal: boolean;
  showDeleteItemConfirm: boolean;
  showRemoveCheckedConfirm: boolean;
  itemToDelete: ShoppingListItem | null;
  checkedCount: number;
  removingChecked: boolean;
  onDeleteList: () => void;
  onDeleteItem: () => void;
  onRemoveCheckedItems: () => void;
  onCloseDeleteConfirm: () => void;
  onCloseDeleteItemConfirm: () => void;
  onCloseRemoveCheckedConfirm: () => void;
}

export const ShoppingListModals: React.FC<ShoppingListModalsProps> = ({
  showListSelector,
  lists,
  selectedList,
  onSelectList,
  onCloseListSelector,
  showNewListModal,
  newListName,
  isCreatingList,
  onNewListNameChange,
  onCreateList,
  onCloseNewListModal,
  showAddItemsModal,
  manualItemName,
  manualItemQuantity,
  manualItemUnit,
  manualItemAisle,
  isAddingItem,
  addSuccess,
  selectedCanonicalItem,
  filteredIngredients,
  units,
  aisles,
  onManualItemNameChange,
  onManualItemQuantityChange,
  onManualItemUnitChange,
  onManualItemAisleChange,
  onSelectCanonicalItem,
  onAddItem,
  onCloseAddItemsModal,
  showDeleteConfirmModal,
  showDeleteItemConfirm,
  showRemoveCheckedConfirm,
  itemToDelete,
  checkedCount,
  removingChecked,
  onDeleteList,
  onDeleteItem,
  onRemoveCheckedItems,
  onCloseDeleteConfirm,
  onCloseDeleteItemConfirm,
  onCloseRemoveCheckedConfirm,
}) => {
  return (
    <>
      <Dialog open={showListSelector} onOpenChange={(open: boolean) => !open && onCloseListSelector()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select list</DialogTitle>
            <DialogDescription>Choose the list you want to shop with.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-80 pr-3">
            <div className="space-y-2">
              {lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lists yet.</p>
              ) : (
                lists.map(list => (
                  <Button
                    key={list.id}
                    variant={selectedList?.id === list.id ? 'secondary' : 'ghost'}
                    className="w-full justify-between"
                    onClick={() => {
                      onSelectList(list);
                      onCloseListSelector();
                    }}
                  >
                    <span>{list.name}</span>
                    {list.isDefault && <Badge variant="outline">Default</Badge>}
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onCloseListSelector}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewListModal} onOpenChange={(open: boolean) => !open && onCloseNewListModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create shopping list</DialogTitle>
            <DialogDescription>Name your new list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="new-list-name">List name</Label>
            <Input
              id="new-list-name"
              value={newListName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNewListNameChange(e.target.value)}
              placeholder="Weekly shop"
              autoFocus
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onCreateList()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseNewListModal} disabled={isCreatingList}>
              Cancel
            </Button>
            <Button onClick={onCreateList} disabled={isCreatingList || !newListName.trim()}>
              {isCreatingList ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddItemsModal} onOpenChange={(open: boolean) => !open && onCloseAddItemsModal()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
            <DialogDescription>Search for an existing item or add a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {addSuccess && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary" />
                Item added to the list.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="item-name">Item name</Label>
              <Input
                id="item-name"
                value={manualItemName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onManualItemNameChange(e.target.value)}
                placeholder="Start typing..."
                className={selectedCanonicalItem ? 'border-primary' : ''}
              />
              {filteredIngredients.length > 0 && (
                <div className="rounded-md border border-border bg-card shadow-sm">
                  <ScrollArea className="max-h-56">
                    <div className="divide-y divide-border">
                      {filteredIngredients.map(ingredient => (
                        <button
                          key={ingredient.id}
                          onClick={() => onSelectCanonicalItem(ingredient)}
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{ingredient.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {ingredient.preferredUnit || 'items'} · {ingredient.aisle || 'Uncategorised'}
                            </p>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.1"
                  min="0"
                  value={manualItemQuantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onManualItemQuantityChange(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={manualItemUnit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onManualItemUnitChange(e.target.value)}
                  placeholder="g, kg, ml, l, items"
                  list="unit-options"
                />
                <datalist id="unit-options">
                  {units.map(unit => (
                    <option key={unit.id} value={unit.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aisle">Aisle</Label>
              <Input
                id="aisle"
                value={manualItemAisle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onManualItemAisleChange(e.target.value)}
                placeholder="Bakery, Frozen"
                list="aisle-options"
              />
              <datalist id="aisle-options">
                {aisles.map(aisle => (
                  <option key={aisle.id} value={aisle.name} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCloseAddItemsModal} disabled={isAddingItem}>
              Close
            </Button>
            <Button
              onClick={onAddItem}
              disabled={isAddingItem || !manualItemName.trim() || !manualItemQuantity}
            >
              {isAddingItem ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </span>
              ) : (
                'Add to list'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirmModal} onOpenChange={(open: boolean) => !open && onCloseDeleteConfirm()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the list and all items inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteList}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteItemConfirm} onOpenChange={(open: boolean) => !open && onCloseDeleteItemConfirm()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete ? `Remove ${itemToDelete.name} from the list?` : 'Remove this item?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRemoveCheckedConfirm} onOpenChange={(open: boolean) => !open && onCloseRemoveCheckedConfirm()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove ticked items?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {checkedCount} ticked item{checkedCount !== 1 ? 's' : ''} from this list?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemoveCheckedItems}
              disabled={removingChecked}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingChecked ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
