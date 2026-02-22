import React, { useState } from 'react';
import { ShoppingList, ShoppingListItem, Unit, Aisle } from '../../../types/contract';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Progress } from '../../../components/ui/progress';
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

interface MobileViewProps {
  selectedList: ShoppingList;
  items: ShoppingListItem[];
  itemsByAisle: Record<string, ShoppingListItem[]>;
  completionPercent: number;
  checkedCount: number;
  showCheckedItems: boolean;
  editingItems: Record<string, { name: string; quantity: string; unit: string; aisle: string }>;
  editingNotes: { [itemId: string]: string };
  updatingItemId: string | null;
  units: Unit[];
  aisles: Aisle[];
  onToggleChecked: (item: ShoppingListItem) => void;
  onUpdateNotes: (itemId: string) => void;
  onDeleteItem: (item: ShoppingListItem) => void;
  onSaveItemEdit: (itemId: string) => Promise<void>;
  onShowListSelector: () => void;
  onShowAddItemsModal: () => void;
  onShowRemoveCheckedConfirm: () => void;
  onToggleShowChecked: () => void;
  setEditingItems: React.Dispatch<
    React.SetStateAction<Record<string, { name: string; quantity: string; unit: string; aisle: string }>>
  >;
  setEditingNotes: React.Dispatch<React.SetStateAction<{ [itemId: string]: string }>>;
}

export const ShoppingListMobileView: React.FC<MobileViewProps> = ({
  selectedList,
  items,
  itemsByAisle,
  completionPercent,
  checkedCount,
  showCheckedItems,
  editingItems,
  editingNotes,
  updatingItemId,
  units,
  aisles,
  onToggleChecked,
  onUpdateNotes,
  onDeleteItem,
  onSaveItemEdit,
  onShowListSelector,
  onShowAddItemsModal,
  onShowRemoveCheckedConfirm,
  onToggleShowChecked,
  setEditingItems,
  setEditingNotes,
}) => {
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [collapsedAisles, setCollapsedAisles] = useState<Record<string, boolean>>({});

  const startEditItem = (item: ShoppingListItem) => {
    setEditingItems(prev => ({
      ...prev,
      [item.id]: {
        name: item.name,
        quantity: String(item.quantity),
        unit: item.unit,
        aisle: item.aisle || '',
      },
    }));
  };

  const cancelEditItem = (itemId: string) => {
    setEditingItems(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleFieldChange = (itemId: string, field: 'name' | 'quantity' | 'unit' | 'aisle', value: string) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const remainingCount = items.filter(item => !item.checked).length;

  return (
    <div className="space-y-4 md:hidden">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Button
                variant="ghost"
                className="h-auto p-0 text-left"
                onClick={onShowListSelector}
              >
                <span className="text-lg font-semibold text-foreground">
                  {selectedList.name}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
              </Button>
              <p className="text-xs text-muted-foreground">
                {items.length} item{items.length !== 1 ? 's' : ''} · {remainingCount} remaining
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleShowChecked}
                aria-label={showCheckedItems ? 'Hide ticked items' : 'Show ticked items'}
              >
                {showCheckedItems ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button size="icon" onClick={onShowAddItemsModal} aria-label="Add item">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {items.length > 0 && <Progress value={completionPercent} className="h-2" />}
          {checkedCount > 0 && (
            <Button variant="outline" size="sm" onClick={onShowRemoveCheckedConfirm}>
              Remove ticked items
            </Button>
          )}
        </CardHeader>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">No items yet.</p>
            <Button onClick={onShowAddItemsModal} variant="outline">
              Add your first item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.keys(itemsByAisle)
            .sort()
            .filter(aisleName => showCheckedItems || itemsByAisle[aisleName].some(item => !item.checked))
            .map(aisleName => (
              <div key={aisleName} className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() =>
                    setCollapsedAisles(prev => ({
                      ...prev,
                      [aisleName]: !prev[aisleName],
                    }))
                  }
                  className="w-full bg-card px-4 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          collapsedAisles[aisleName] ? '-rotate-90' : ''
                        }`}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {aisleName}
                      </span>
                    </div>
                    {itemsByAisle[aisleName].some(item => !item.checked) && (
                      <Badge variant="secondary">
                        {itemsByAisle[aisleName].filter(item => !item.checked).length}
                      </Badge>
                    )}
                  </div>
                </button>

                {!collapsedAisles[aisleName] && (
                  <div className="space-y-2 bg-muted/20 px-2 py-3">
                    {itemsByAisle[aisleName]
                      .filter(item => showCheckedItems || !item.checked)
                      .map(item => (
                        <Card
                          key={item.id}
                          onTouchStart={(e: React.TouchEvent<HTMLDivElement>) =>
                            setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
                          }
                          onTouchEnd={(e: React.TouchEvent<HTMLDivElement>) => {
                            const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
                            const diffX = touchStart.x - touchEnd.x;
                            const diffY = Math.abs(touchStart.y - touchEnd.y);
                            if (diffX > 100 && diffY < 50) {
                              setSwipedItemId(item.id);
                            } else if (diffX < -50) {
                              setSwipedItemId(null);
                            }
                          }}
                          className={`relative ${item.checked ? 'opacity-60' : ''}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={item.checked}
                                onCheckedChange={() => onToggleChecked(item)}
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-2">
                                {editingItems[item.id] ? (
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      <Label htmlFor={`edit-name-${item.id}`}>Item name</Label>
                                      <Input
                                        id={`edit-name-${item.id}`}
                                        value={editingItems[item.id].name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                          handleFieldChange(item.id, 'name', e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-2">
                                        <Label htmlFor={`edit-quantity-${item.id}`}>Quantity</Label>
                                        <Input
                                          id={`edit-quantity-${item.id}`}
                                          type="number"
                                          step="0.1"
                                          min="0"
                                          value={editingItems[item.id].quantity}
                                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            handleFieldChange(item.id, 'quantity', e.target.value)
                                          }
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`edit-unit-${item.id}`}>Unit</Label>
                                        <Input
                                          id={`edit-unit-${item.id}`}
                                          value={editingItems[item.id].unit}
                                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            handleFieldChange(item.id, 'unit', e.target.value)
                                          }
                                          list={`unit-options-${item.id}`}
                                        />
                                        <datalist id={`unit-options-${item.id}`}>
                                          {units.map(unit => (
                                            <option key={unit.id} value={unit.name} />
                                          ))}
                                        </datalist>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`edit-aisle-${item.id}`}>Aisle</Label>
                                      <Input
                                        id={`edit-aisle-${item.id}`}
                                        value={editingItems[item.id].aisle}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                          handleFieldChange(item.id, 'aisle', e.target.value)
                                        }
                                        list={`aisle-options-${item.id}`}
                                      />
                                      <datalist id={`aisle-options-${item.id}`}>
                                        {aisles.map(aisle => (
                                          <option key={aisle.id} value={aisle.name} />
                                        ))}
                                      </datalist>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => onSaveItemEdit(item.id)}
                                        disabled={updatingItemId === item.id}
                                        className="flex-1"
                                      >
                                        {updatingItemId === item.id ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => cancelEditItem(item.id)}
                                        className="flex-1"
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
                                      <span
                                        className={`flex-1 text-sm font-semibold ${
                                          item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                                        }`}
                                      >
                                        {item.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {item.quantity} {item.unit}
                                      </span>
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                    {item.isStaple && (
                                      <Badge variant="secondary" className="mt-2">
                                        Staple
                                      </Badge>
                                    )}
                                  </div>
                                )}

                                {!editingItems[item.id] && item.note && !editingNotes[item.id] && (
                                  <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                                    <span>{item.note}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setEditingNotes({ ...editingNotes, [item.id]: item.note || '' })
                                      }
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                                {!editingItems[item.id] && editingNotes[item.id] !== undefined && (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={editingNotes[item.id]}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setEditingNotes({ ...editingNotes, [item.id]: e.target.value })
                                      }
                                      placeholder="Add a note..."
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onUpdateNotes(item.id)}
                                      aria-label="Save note"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const next = { ...editingNotes };
                                        delete next[item.id];
                                        setEditingNotes(next);
                                      }}
                                      aria-label="Cancel"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                                {!editingItems[item.id] && !item.note && !editingNotes[item.id] && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingNotes({ ...editingNotes, [item.id]: '' })}
                                  >
                                    Add a note
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>

                          {swipedItemId === item.id && (
                            <div className="absolute inset-0 flex items-center justify-between rounded-lg bg-destructive px-4 text-destructive-foreground">
                              <span className="text-sm font-semibold">Remove this item?</span>
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => onDeleteItem(item)}
                                >
                                  Remove
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSwipedItemId(null)}
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
