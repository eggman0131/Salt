/**
 * Assist Mode Guides Management
 * 
 * Lists all generated assist mode cook guides and allows deletion.
 */

import React, { useState, useEffect } from 'react';
import { CookGuide } from '../../cook-mode/types';
import { cookModeBackend } from '../../cook-mode/backend';
import { recipesBackend } from '../../recipes/backend';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Trash2, ChefHat } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';

interface AssistModeGuidesListProps {
  onRefresh?: () => void;
}

export const AssistModeGuidesList: React.FC<AssistModeGuidesListProps> = ({ onRefresh }) => {
  const [guides, setGuides] = useState<CookGuide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [guideToDeletId, setGuideToDelete] = useState<string | null>(null);
  const [recipeNames, setRecipeNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    try {
      setIsLoading(true);
      const allGuides = await cookModeBackend.getAllCookGuides();
      
      // Remove duplicates - keep only the most recent guide per recipe
      const guidesByRecipe = new Map<string, CookGuide>();
      allGuides.forEach(guide => {
        const existing = guidesByRecipe.get(guide.recipeId);
        if (!existing || new Date(guide.generatedAt) > new Date(existing.generatedAt)) {
          guidesByRecipe.set(guide.recipeId, guide);
        }
      });
      
      // Delete outdated duplicates
      const guidesToKeep = Array.from(guidesByRecipe.values());
      const guidesToDelete = allGuides.filter(g => !guidesToKeep.find(k => k.id === g.id));
      
      if (guidesToDelete.length > 0) {
        console.log(`Cleaning up ${guidesToDelete.length} duplicate guide(s)...`);
        await Promise.all(guidesToDelete.map(g => cookModeBackend.deleteCookGuide(g.id)));
        softToast.success(`Cleaned up ${guidesToDelete.length} duplicate guide(s)`);
      }
      
      setGuides(guidesToKeep);

      // Load recipe names for display
      const names: Record<string, string> = {};
      for (const guide of guidesToKeep) {
        try {
          const recipe = await recipesBackend.getRecipe(guide.recipeId);
          if (recipe) {
            names[guide.recipeId] = recipe.title;
          }
        } catch (err) {
          console.error(`Failed to load recipe ${guide.recipeId}:`, err);
          names[guide.recipeId] = `Recipe ${guide.recipeId.substring(0, 8)}...`;
        }
      }
      setRecipeNames(names);
    } catch (err) {
      console.error('Failed to load guides:', err);
      softToast.error('Failed to load Assist Mode guides');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGuide = async (guideId: string) => {
    try {
      setIsDeletingId(guideId);
      await cookModeBackend.deleteCookGuide(guideId);
      setGuides(guides.filter(g => g.id !== guideId));
      setGuideToDelete(null);
      softToast.success('Guide deleted');
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete guide:', err);
      softToast.error('Failed to delete guide');
    } finally {
      setIsDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl md:text-2xl">Assist Mode Guides</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="p-4 md:p-6">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl">Assist Mode Guides</CardTitle>
            <p className="text-sm text-muted-foreground">
              {guides.length} {guides.length === 1 ? 'guide' : 'guides'} generated
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {guides.length === 0 ? (
            <div className="text-center py-8">
              <ChefHat className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No Assist Mode guides yet. Generate one from a recipe to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {guides.map((guide) => (
                <div
                  key={guide.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {recipeNames[guide.recipeId] || guide.recipeTitle}
                    </p>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {guide.steps.length} steps
                      </Badge>
                      {guide.prepGroups && (
                        <Badge variant="outline" className="text-xs">
                          {guide.prepGroups.length} prep groups
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {formatDate(guide.generatedAt)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGuideToDelete(guide.id)}
                    disabled={isDeletingId !== null}
                    className="ml-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={guideToDeletId !== null} onOpenChange={(open) => !open && setGuideToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assist Mode Guide?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the generated guide. The recipe will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => guideToDeletId && handleDeleteGuide(guideToDeletId)}
              disabled={isDeletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingId === guideToDeletId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
