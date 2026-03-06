/**
 * Categories Management UI Component
 * 
 * Display-only component that calls categoriesApi for all logic.
 * No direct imports from logic/ or data/ folders.
 */

import React, { useState, useEffect } from 'react';
import { Recipe, RecipeCategory } from '../../../types/contract';
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory,
  getPendingCategories,
  approveCategory,
  categorizeRecipe 
} from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useAdminRefresh } from '@/shared/providers';

interface CategoriesManagementProps {
  onCategorySelected?: (category: RecipeCategory) => void;
}

export const CategoriesManagement: React.FC<CategoriesManagementProps> = ({
  onCategorySelected,
}) => {
  const { refreshTrigger } = useAdminRefresh();
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [pendingCategories, setPendingCategories] = useState<RecipeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, [refreshTrigger]); // Re-fetch when refresh is triggered from dashboard

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [all, pending] = await Promise.all([
        getCategories(),
        getPendingCategories(),
      ]);
      setCategories(all);
      setPendingCategories(pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveCategory = async (id: string) => {
    try {
      await approveCategory(id);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) {
      return;
    }
    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  if (isLoading && categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categories Management</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Approved Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-muted-foreground">No categories yet.</p>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-semibold">{cat.name}</p>
                    {cat.synonyms && cat.synonyms.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {cat.synonyms.map(syn => (
                          <Badge key={syn} variant="secondary" className="text-xs">
                            {syn}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Approval ({pendingCategories.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingCategories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div>
                    <p className="font-semibold">{cat.name}</p>
                    <p className="text-sm text-muted-foreground">{cat.description}</p>
                  </div>
                  <Button
                    onClick={() => handleApproveCategory(cat.id)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
