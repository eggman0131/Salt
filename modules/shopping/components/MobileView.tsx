import React, { useState } from 'react';
import { ShoppingList, ShoppingListItem, CanonicalItem, Unit, Aisle } from '../../../types/contract';
import { Button, Card, Input, Label } from '../../../components/UI';

interface MobileViewProps {
  selectedList: ShoppingList;
  items: ShoppingListItem[];
  itemsByAisle: Record<string, ShoppingListItem[]>;
  completionPercent: number;
  checkedCount: number;
  showCheckedItems: boolean;
  editingNotes: { [itemId: string]: string };
  updatingItemId: string | null;
  units: Unit[];
  aisles: Aisle[];
  onToggleChecked: (item: ShoppingListItem) => void;
  onUpdateNotes: (itemId: string) => void;
  onDeleteItem: (item: ShoppingListItem) => void;
  onShowListSelector: () => void;
  onShowAddItemsModal: () => void;
  onShowRemoveCheckedConfirm: () => void;
  onToggleShowChecked: () => void;
  setEditingNotes: React.Dispatch<React.SetStateAction<{ [itemId: string]: string }>>;
}

export const ShoppingListMobileView: React.FC<MobileViewProps> = ({
  selectedList,
  items,
  itemsByAisle,
  completionPercent,
  checkedCount,
  showCheckedItems,
  editingNotes,
  updatingItemId,
  units,
  aisles,
  onToggleChecked,
  onUpdateNotes,
  onDeleteItem,
  onShowListSelector,
  onShowAddItemsModal,
  onShowRemoveCheckedConfirm,
  onToggleShowChecked,
  setEditingNotes,
}) => {
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
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

  return (
    <div className="space-y-6 md:hidden">
      {/* Mobile List Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 cursor-pointer" onClick={onShowListSelector}>
            <h2 className="text-xl font-bold text-gray-900 hover:text-orange-600 transition-colors">
              {selectedList.name}
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              {items.length} item{items.length !== 1 ? 's' : ''} • {items.filter(i => !i.checked).length} remaining
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onToggleShowChecked}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title={showCheckedItems ? 'Hide checked' : 'Show checked'}
            >
              {showCheckedItems ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              )}
            </button>
            <button
              onClick={onShowAddItemsModal}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Add item"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
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

      {/* Mobile Items List */}
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
        <div className="space-y-2">
          {Object.keys(itemsByAisle)
            .sort()
            .filter(aisleName => showCheckedItems || itemsByAisle[aisleName].some(item => !item.checked))
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
                  <div className="flex items-center gap-3 flex-1">
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
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 text-left">
                      {aisleName}
                    </h4>
                  </div>
                  {itemsByAisle[aisleName].some(item => !item.checked) && (
                    <span className="bg-orange-600 text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-fit ml-auto flex-shrink-0">
                      {itemsByAisle[aisleName].filter(item => !item.checked).length}
                    </span>
                  )}
                </div>
              </button>

              {/* Aisle items */}
              {!collapsedAisles[aisleName] && (
                <div className="space-y-2 px-1.5 py-4 border-t border-gray-100">
                  {itemsByAisle[aisleName]
                    .filter(item => showCheckedItems || !item.checked)
                    .map(item => (
                    <Card
                      key={item.id}
                      onTouchStart={(e) => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
                      onTouchEnd={(e) => {
                        const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
                        const diffX = touchStart.x - touchEnd.x;
                        const diffY = Math.abs(touchStart.y - touchEnd.y);
                        if (diffX > 100 && diffY < 50) {
                          setSwipedItemId(item.id);
                        } else if (diffX < -50) {
                          setSwipedItemId(null);
                        }
                      }}
                      className={`p-4 transition-all relative ${
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
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {/* Save handled by parent */}}
                                  disabled={updatingItemId === item.id}
                                  className="flex-1"
                                >
                                  {updatingItemId === item.id ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  onClick={() => {
                                    const next = { ...editingItems };
                                    delete next[item.id];
                                    setEditingItems(next);
                                  }}
                                  className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div
                                onClick={() => startEditItem(item)}
                                className="flex items-baseline gap-2 cursor-pointer"
                              >
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
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
                                title="Save note"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  const newNotes = { ...editingNotes };
                                  delete newNotes[item.id];
                                  setEditingNotes(newNotes);
                                }}
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
                                title="Cancel"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
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
                      
                      {/* Swipe-to-delete overlay */}
                      {swipedItemId === item.id && (
                        <div className="absolute inset-0 bg-red-600 rounded-lg flex items-center justify-between px-4">
                          <span className="text-white font-semibold">Delete this item?</span>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => onDeleteItem(item)}
                              className="bg-white !text-red-700 hover:bg-red-50 hover:!text-red-800 px-3"
                            >
                              Delete
                            </Button>
                            <Button
                              onClick={() => setSwipedItemId(null)}
                              className="bg-red-700 text-white hover:bg-red-800 px-3"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
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
