import React from 'react';
import { ShoppingList, ShoppingListItem, CanonicalItem, Unit, Aisle } from '../../../../types/contract';
import { Button, Input, Label } from '../../../../components/UI';

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
      {/* List Selector Modal */}
      {showListSelector && (
        <div className="fixed inset-0 bg-black/50 z-400 flex items-center justify-center p-4" onClick={onCloseListSelector}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Select List</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lists.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No lists yet</p>
              ) : (
                lists.map(list => (
                  <button
                    key={list.id}
                    onClick={() => {
                      onSelectList(list);
                      onCloseListSelector();
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                      selectedList?.id === list.id
                        ? 'bg-orange-100 text-orange-900 border-2 border-orange-600'
                        : 'bg-gray-50 text-gray-900 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{list.name}</span>
                      {list.isDefault && <span className="text-xs font-bold text-orange-600">DEFAULT</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={onCloseListSelector}
              className="mt-4 w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* New List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 bg-black/50 z-400 flex items-center justify-center p-4" onClick={onCloseNewListModal}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create Shopping List</h3>
            <input
              type="text"
              value={newListName}
              onChange={(e) => onNewListNameChange(e.target.value)}
              placeholder="List name (e.g. Weekly Shop)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && onCreateList()}
            />
            <div className="flex gap-3">
              <button
                onClick={onCloseNewListModal}
                disabled={isCreatingList}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onCreateList}
                disabled={isCreatingList || !newListName.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingList ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Items Modal */}
      {showAddItemsModal && (
        <div className="fixed inset-0 bg-black/50 z-400 flex items-center justify-center p-4" onClick={onCloseAddItemsModal}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Add Item</h3>
              <p className="text-sm text-gray-600 mt-1">Search for an existing item or create a new one</p>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {addSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span className="font-medium">Item added to list</span>
                </div>
              )}
              
              <div className="relative">
                <Label htmlFor="item-name">Item name</Label>
                <Input
                  id="item-name"
                  type="text"
                  value={manualItemName}
                  onChange={(e) => onManualItemNameChange(e.target.value)}
                  placeholder="Type to search or enter new item..."
                  autoFocus
                  className={selectedCanonicalItem ? 'border-green-500 bg-green-50' : ''}
                />
                {selectedCanonicalItem && (
                  <div className="mt-1 text-xs text-green-700 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Existing item selected
                  </div>
                )}
                {filteredIngredients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 border border-gray-200 rounded-lg bg-white shadow-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {filteredIngredients.map(ing => (
                      <button
                        key={ing.id}
                        onClick={() => onSelectCanonicalItem(ing)}
                        className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{ing.name}</p>
                          <p className="text-xs text-gray-500">{ing.preferredUnit} • {ing.aisle}</p>
                        </div>
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.1"
                    min="0"
                    value={manualItemQuantity}
                    onChange={(e) => onManualItemQuantityChange(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    type="text"
                    value={manualItemUnit}
                    onChange={(e) => onManualItemUnitChange(e.target.value)}
                    placeholder="e.g. g, kg, ml, l, item"
                    list="unit-options"
                  />
                  <datalist id="unit-options">
                    {units.map(unit => (
                      <option key={unit.id} value={unit.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <Label htmlFor="aisle">Aisle {!selectedCanonicalItem && <span className="text-gray-400 font-normal">(optional for new items)</span>}</Label>
                <Input
                  id="aisle"
                  type="text"
                  value={manualItemAisle}
                  onChange={(e) => onManualItemAisleChange(e.target.value)}
                  placeholder="e.g. Bakery, Frozen"
                  list="aisle-options"
                />
                <datalist id="aisle-options">
                  {aisles.map(aisle => (
                    <option key={aisle.id} value={aisle.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={onCloseAddItemsModal}
                disabled={isAddingItem}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Close
              </button>
              <button
                onClick={onAddItem}
                disabled={isAddingItem || !manualItemName.trim() || !manualItemQuantity}
                className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAddingItem ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add to List'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete List Confirmation Modal */}
      {showDeleteConfirmModal && selectedList && (
        <div className="fixed inset-0 bg-black/50 z-400 flex items-center justify-center p-4" onClick={onCloseDeleteConfirm}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete List?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedList.name}</strong>? This will also remove all items in the list.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCloseDeleteConfirm}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDeleteList}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {showDeleteItemConfirm && itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-400 flex items-center justify-center p-4" onClick={onCloseDeleteItemConfirm}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Remove Item?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove <strong>{itemToDelete.name}</strong> from this list?
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCloseDeleteItemConfirm}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDeleteItem}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Checked Items Confirmation Modal */}
      {showRemoveCheckedConfirm && (
        <div className="fixed inset-0 bg-black/50 z-400 flex items-center justify-center p-4" onClick={onCloseRemoveCheckedConfirm}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Remove Ticked Items?</h3>
            <p className="text-gray-600 mb-6">
              Remove {checkedCount} ticked item{checkedCount !== 1 ? 's' : ''} from this list?
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCloseRemoveCheckedConfirm}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onRemoveCheckedItems}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                {removingChecked ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
