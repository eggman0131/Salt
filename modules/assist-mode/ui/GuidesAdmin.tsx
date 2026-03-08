/**
 * Assist Mode Admin — Cook Guides Management Tool
 *
 * Lists all generated cook guides, deduplicates on load, and allows deletion.
 */

import React, { useState, useEffect } from 'react';
import { getAllCookGuides, deleteCookGuide } from '../api';
import type { CookGuide } from '../types';
import { getRecipe } from '../../recipes/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Loader2, Trash2, ChefHat } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

export const GuidesAdmin: React.FC = () => {
  const [guides, setGuides] = useState<CookGuide[]>([]);
  const [recipeNames, setRecipeNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [guideToDeleteId, setGuideToDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setIsLoading(true);
    try {
      const all = await getAllCookGuides();

      // Keep only the most recent guide per recipe; delete stale duplicates
      const byRecipe = new Map<string, CookGuide>();
      all.forEach(g => {
        const existing = byRecipe.get(g.recipeId);
        if (!existing || new Date(g.generatedAt) > new Date(existing.generatedAt)) {
          byRecipe.set(g.recipeId, g);
        }
      });

      const keep = Array.from(byRecipe.values());
      const stale = all.filter(g => !keep.find(k => k.id === g.id));
      if (stale.length > 0) {
        await Promise.all(stale.map(g => deleteCookGuide(g.id)));
        softToast.success(`Cleaned up ${stale.length} duplicate guide${stale.length === 1 ? '' : 's'}`);
      }

      setGuides(keep);

      // Resolve recipe titles
      const names: Record<string, string> = {};
      await Promise.all(
        keep.map(async g => {
          try {
            const recipe = await getRecipe(g.recipeId);
            names[g.recipeId] = recipe?.title ?? `Recipe ${g.recipeId.slice(0, 8)}…`;
          } catch {
            names[g.recipeId] = `Recipe ${g.recipeId.slice(0, 8)}…`;
          }
        })
      );
      setRecipeNames(names);
    } catch {
      softToast.error('Failed to load Assist Mode guides');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeletingId(id);
    try {
      await deleteCookGuide(id);
      setGuides(prev => prev.filter(g => g.id !== id));
      setGuideToDeleteId(null);
      softToast.success('Guide deleted');
    } catch {
      softToast.error('Failed to delete guide');
    } finally {
      setIsDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {guides.length} {guides.length === 1 ? 'guide' : 'guides'} generated
        </p>

        {guides.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <ChefHat className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No guides yet. Generate one from a recipe to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {guides.map(guide => (
              <div
                key={guide.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {recipeNames[guide.recipeId] ?? guide.recipeTitle}
                  </p>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">{guide.steps.length} steps</Badge>
                    {guide.prepGroups && (
                      <Badge variant="outline" className="text-xs">{guide.prepGroups.length} prep groups</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {new Date(guide.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGuideToDeleteId(guide.id)}
                  disabled={isDeletingId !== null}
                  className="ml-2 text-destructive hover:text-destructive"
                >
                  {isDeletingId === guide.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!guideToDeleteId} onOpenChange={open => !open && setGuideToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete guide?</AlertDialogTitle>
            <AlertDialogDescription>
              The generated guide will be permanently removed. The recipe itself will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!isDeletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => guideToDeleteId && handleDelete(guideToDeleteId)}
              disabled={!!isDeletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
