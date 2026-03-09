import React, { useState } from 'react';
import { Trash2, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { softToast } from '@/lib/soft-toast';
import { deleteItem, updateItemChecked } from '../../api';
import type { ShoppingListItem } from '../../../../types/contract';
import { formatQty } from '../../logic/unit-normalisation';
import { hasUnitMismatch } from '../../logic/aggregation';

interface ItemRowProps {
  item: ShoppingListItem;
  onUpdated: () => void;
}

export const ItemRow: React.FC<ItemRowProps> = ({ item, onUpdated }) => {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteItem(item.id);
      onUpdated();
    } catch {
      softToast.error('Failed to remove item');
      setIsDeleting(false);
    }
  };

  const handleToggleChecked = async () => {
    try {
      await updateItemChecked(item.id, !item.checked);
      onUpdated();
    } catch {
      softToast.error('Failed to update item');
    }
  };

  const qtyLabel =
    item.displayQty != null && item.displayUnit
      ? `${formatQty(item.displayQty)} ${item.displayUnit}`
      : item.totalBaseQty != null && item.baseUnit
      ? `${formatQty(item.totalBaseQty)} ${item.baseUnit}`
      : null;

  const mismatch = hasUnitMismatch(item.contributions);

  return (
    <div className={`border rounded-md transition-opacity ${item.checked ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={handleToggleChecked}
          className="h-4 w-4 rounded border-border accent-primary shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${item.checked ? 'line-through' : ''}`}>
              {item.name}
            </span>
            {qtyLabel && (
              <span className="text-xs text-muted-foreground">{qtyLabel}</span>
            )}
            {mismatch && (
              <span title="Mixed units — check contributions">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              </span>
            )}
          </div>
          {item.aisle && (
            <p className="text-xs text-muted-foreground">{item.aisle}</p>
          )}
        </div>

        {item.contributions.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-7 w-7"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isDeleting}
          title="Remove item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded && item.contributions.length > 0 && (
        <div className="ml-7 mb-2 space-y-1 border-l-2 border-muted pl-3 pb-2">
          {item.contributions.map((c, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-medium">
                {c.sourceType === 'recipe' ? c.recipeTitle ?? 'Recipe' : 'Manual'}
              </span>
              {' — '}
              <span className="italic">{c.rawText}</span>
              {c.qty != null && c.unit && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                  {formatQty(c.qty)} {c.unit}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
