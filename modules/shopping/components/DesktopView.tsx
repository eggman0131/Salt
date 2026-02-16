import React, { useState } from 'react';
import { ShoppingList, ShoppingListItem, Unit, Aisle } from '../../../types/contract';
import { Button, Card, Input, Label } from '../../../components/UI';

interface DesktopViewProps {
  selectedList: ShoppingList;
  items: ShoppingListItem[];
  itemsByAisle: Record<string, ShoppingListItem[]>;
  completionPercent: number;
  checkedCount: number;
  editingNotes: { [itemId: string]: string };
  updatingItemId: string | null;
  removingChecked: boolean;
  units: Unit[];
  aisles: Aisle[];
  onToggleChecked: (item: ShoppingListItem) => void;
  onUpdateNotes: (itemId: string) => void;
  onSaveItemEdit: (itemId: string) => Promise<void>;
  onDeleteItem: (item: ShoppingListItem) => void;
  onShowAddItemsModal: () => void;
  onShowRemoveCheckedConfirm: () => void;
  onShowDeleteConfirmModal: () => void;
  setEditingNotes: React.Dispatch<React.SetStateAction<{ [itemId: string]: string }>>;
}

export const ShoppingListDesktopView: React.FC<DesktopViewProps> = ({
  selectedList,
  items,
  itemsByAisle,
  completionPercent,
  checkedCount,
  editingNotes,
  updatingItemId,
  removingChecked,
  units,
  aisles,
  onToggleChecked,
  onUpdateNotes,
  onSaveItemEdit,
  onDeleteItem,
  onShowAddItemsModal,
  onShowRemoveCheckedConfirm,
  onShowDeleteConfirmModal,
  setEditingNotes,
}) => {
  const [collapsedAisles, setCollapsedAisles] = useState<Record<string, boolean>>({});
  const [editingItems, setEditingItems] = useState<Record<string, { name: string; quantity: string; unit: string; aisle: string }>>({});

  const startEditItem = (item: ShoppingListItem) => {
    setEditingItems(prev => ({
      ...prev,
      [item.id]: {
        name: item.name,
        quantity: String(item.quantity),
        unit: item.unit,
        aisle: item.aisle || ''
      }
    }));
  };

  const cancelEditItem = (itemId: string) => {
    setEditingItems(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleSaveEdit = async (itemId: string) => {
    await onSaveItemEdit(itemId);
    cancelEditItem(itemId);
  };

  return (
    <div className="hidden md:block space-y-6">
      {/* Desktop List Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900">
              {selectedList.name}
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              {items.length} item{items.length !== 1 ? 's' : ''} • {items.filter(i => !i.checked).length} remaining
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onShowAddItemsModal}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Add item"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
            <button
              onClick={onShowRemoveCheckedConfirm}
              disabled={checkedCount === 0 || removingChecked}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={removingChecked ? 'Removing ticked items' : `Remove ticked items (${checkedCount})`}
            >
              {removingChecked ? (
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />
                </svg>
              )}
            </button>
            <button
              onClick={onShowDeleteConfirmModal}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
              title="Delete list"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
        
        {items.length > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-orange-600 h-full transition-all duration-500 rounded-full"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        )}
      </Card>

      {/* Desktop Items List */}
      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 mb-4">No items yet</p>
          <button
            onClick={onShowAddItemsModal}
            className="text-orange-600 hover:text-orange-700 font-semibold"
          >
            Add your first item →
          </button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.keys(itemsByAisle)
            .sort()
            .map(aisleName => (
            <div key={aisleName} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Aisle header */}
              <button
                onClick={() => setCollapsedAisles(prev => ({
                  ...prev,
                  [aisleName]: !prev[aisleName]
                }))}
                className="w-full bg-white hover:bg-gray-50 transition-colors px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                        collapsedAisles[aisleName] ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 8.755l-9 5.196-9-5.196" />
                    </svg>
                    <h4 className="text-sm font-black uppercase tracking-widest text-gray-400">
                      {aisleName}
                    </h4>
                  </div>
                  {itemsByAisle[aisleName].some(item => !item.checked) && (
                    <span className="bg-orange-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      {itemsByAisle[aisleName].filter(item => !item.checked).length}
                    </span>
                  )}
                </div>
              </button>

              {/* Aisle items */}
              {!collapsedAisles[aisleName] && (
                <div className="space-y-2 p-4 pt-3 border-t border-gray-100">
                  {itemsByAisle[aisleName].map(item => (
                    <Card
                      key={item.id}
                      className={`p-4 transition-all ${
                        item.checked ? 'bg-gray-50 opacity-60' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => onToggleChecked(item)}
                          className="w-5 h-5 mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {editingItems[item.id] ? (
                                <div className="space-y-3">
                                  <div>
                                    <Label htmlFor={`edit-name-${item.id}`}>Item name</Label>
                                    <Input
                                      id={`edit-name-${item.id}`}
                                      value={editingItems[item.id].name}
                                      onChange={(e) =>
                                        setEditingItems(prev => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            name: e.target.value
                                          }
                                        }))
                                      }
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label htmlFor={`edit-quantity-${item.id}`}>Quantity</Label>
                                      <Input
                                        id={`edit-quantity-${item.id}`}
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={editingItems[item.id].quantity}
                                        onChange={(e) =>
                                          setEditingItems(prev => ({
                                            ...prev,
                                            [item.id]: {
                                              ...prev[item.id],
                                              quantity: e.target.value
                                            }
                                          }))
                                        }
                                        className="text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor={`edit-unit-${item.id}`}>Unit</Label>
                                      <Input
                                        id={`edit-unit-${item.id}`}
                                        value={editingItems[item.id].unit}
                                        onChange={(e) =>
                                          setEditingItems(prev => ({
                                            ...prev,
                                            [item.id]: {
                                              ...prev[item.id],
                                              unit: e.target.value
                                            }
                                          }))
                                        }
                                        list={`unit-options-${item.id}`}
                                        className="text-sm"
                                      />
                                      <datalist id={`unit-options-${item.id}`}>
                                        {units.map(unit => (
                                          <option key={unit.id} value={unit.name} />
                                        ))}
                                      </datalist>
                                    </div>
                                  </div>
                                  <div>
                                    <Label htmlFor={`edit-aisle-${item.id}`}>Aisle</Label>
                                    <Input
                                      id={`edit-aisle-${item.id}`}
                                      value={editingItems[item.id].aisle}
                                      onChange={(e) =>
                                        setEditingItems(prev => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            aisle: e.target.value
                                          }
                                        }))
                                      }
                                      list={`aisle-options-${item.id}`}
                                      className="text-sm"
                                    />
                                    <datalist id={`aisle-options-${item.id}`}>
                                      {aisles.map(aisle => (
                                        <option key={aisle.id} value={aisle.name} />
                                      ))}
                                    </datalist>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-baseline gap-2">
                                    <h5 className={`font-semibold text-gray-900 break-words flex-1 ${item.checked ? 'line-through' : ''}`}>
                                      {item.name}
                                    </h5>
                                    <span className="text-sm text-gray-600 whitespace-nowrap flex-shrink-0">
                                      {item.quantity}
                                    </span>
                                    <span className="text-sm text-gray-600 whitespace-nowrap flex-shrink-0">
                                      {item.unit}
                                    </span>
                                  </div>
                                  {item.isStaple && (
                                    <span className="inline-block text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-wide font-bold mt-2">
                                      Staple
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-start gap-2 flex-shrink-0">
                              {editingItems[item.id] ? (
                                <>
                                  <Button
                                    onClick={() => handleSaveEdit(item.id)}
                                    disabled={updatingItemId === item.id}
                                    className="px-3"
                                  >
                                    {updatingItemId === item.id ? 'Saving...' : 'Save'}
                                  </Button>
                                  <Button
                                    onClick={() => cancelEditItem(item.id)}
                                    className="px-3 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  >
                                    Cancel
                                  </Button>
                                  <button
                                    onClick={() => onDeleteItem(item)}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                                    title="Remove item"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditItem(item)}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                    title="Edit item"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => onDeleteItem(item)}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                                    title="Remove item"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Notes section */}
                          {!editingItems[item.id] && item.note && !editingNotes[item.id] && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-sm text-gray-700 flex items-start justify-between gap-2">
                              <span>{item.note}</span>
                              <button
                                onClick={() => setEditingNotes({ ...editingNotes, [item.id]: item.note || '' })}
                                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                                </svg>
                              </button>
                            </div>
                          )}
                          {!editingItems[item.id] && editingNotes[item.id] !== undefined && (
                            <div className="mt-2 flex gap-2">
                              <Input
                                value={editingNotes[item.id]}
                                onChange={(e) => setEditingNotes({ ...editingNotes, [item.id]: e.target.value })}
                                placeholder="Add a note..."
                                className="flex-1"
                              />
                              <button
                                onClick={() => onUpdateNotes(item.id)}
                                className="px-3 flex-shrink-0 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  const newNotes = { ...editingNotes };
                                  delete newNotes[item.id];
                                  setEditingNotes(newNotes);
                                }}
                                className="px-3 flex-shrink-0 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {!editingItems[item.id] && !item.note && !editingNotes[item.id] && (
                            <button
                              onClick={() => setEditingNotes({ ...editingNotes, [item.id]: '' })}
                              className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                            >
                              + Add note
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
