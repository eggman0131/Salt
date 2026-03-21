/**
 * LinkedIngredientRefs
 *
 * Shows all recipe ingredients currently linked to a canon item.
 * Loaded on demand — supports the admin review workflow for deciding
 * whether to approve, merge, or split a pending canon item.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { getCanonItemIngredientRefs, type CanonItem, type IngredientRef } from '../api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

// ── Component ─────────────────────────────────────────────────────────────────

interface LinkedIngredientRefsProps {
  item: CanonItem;
}

export const LinkedIngredientRefs: React.FC<LinkedIngredientRefsProps> = ({ item }) => {
  const [refs, setRefs] = useState<IngredientRef[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset when item changes
  useEffect(() => {
    setRefs(null);
    setIsExpanded(false);
  }, [item.id]);

  const handleToggle = async () => {
    if (refs !== null) {
      setIsExpanded(v => !v);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getCanonItemIngredientRefs(item.id);
      setRefs(data);
      setIsExpanded(true);
    } catch {
      softToast.error('Failed to load recipe links');
    } finally {
      setIsLoading(false);
    }
  };

  // Group refs by recipe, sorted alphabetically
  const byRecipe = useMemo(() => {
    if (!refs) return [];
    const map = new Map<string, { recipeTitle: string; refs: IngredientRef[] }>();
    for (const ref of refs) {
      const entry = map.get(ref.recipeId) ?? { recipeTitle: ref.recipeTitle, refs: [] };
      entry.refs.push(ref);
      map.set(ref.recipeId, entry);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.recipeTitle.localeCompare(b.recipeTitle)
    );
  }, [refs]);

  const recipeCount = byRecipe.length;
  const totalUses = refs?.length ?? 0;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Recipe Usage</h3>
          {refs !== null && (
            <Badge variant={totalUses === 0 ? 'secondary' : 'outline'} className="text-xs">
              {totalUses === 0
                ? 'Unused'
                : `${totalUses} use${totalUses !== 1 ? 's' : ''} in ${recipeCount} recipe${recipeCount !== 1 ? 's' : ''}`}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          disabled={isLoading}
          className="h-7 text-xs gap-1"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isExpanded ? (
            <><ChevronUp className="h-3 w-3" />Hide</>
          ) : (
            <><ChevronDown className="h-3 w-3" />{refs !== null ? 'Show' : 'Load'}</>
          )}
        </Button>
      </div>

      {isExpanded && refs !== null && (
        <div className="space-y-2">
          {totalUses === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recipe ingredients are linked to this item yet.
            </p>
          ) : (
            byRecipe.map(({ recipeTitle, refs: recipeRefs }) => (
              <div key={recipeTitle} className="rounded-md border text-sm overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 border-b">
                  <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{recipeTitle}</span>
                  {recipeRefs.length > 1 && (
                    <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                      ×{recipeRefs.length}
                    </Badge>
                  )}
                </div>
                <div className="divide-y">
                  {recipeRefs.map(ref => (
                    <div key={ref.ingredientId} className="px-3 py-2 space-y-0.5">
                      <p className="text-xs font-mono text-muted-foreground">{ref.raw}</p>
                      {ref.ingredientName.toLowerCase() !== ref.raw.toLowerCase() && (
                        <p className="text-xs text-muted-foreground">
                          → {ref.ingredientName}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
};
