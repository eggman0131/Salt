import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Pencil, CheckCircle2, X, Plus, Trash2 } from 'lucide-react';
import type { PrepGroup } from '../types';

interface PrepPhaseViewProps {
  prepGroups: PrepGroup[];
  guideId?: string;
  onPrepGroupsUpdate?: (guideId: string, prepGroups: PrepGroup[]) => Promise<void>;
}

export const PrepPhaseView: React.FC<PrepPhaseViewProps> = ({
  prepGroups,
  guideId,
  onPrepGroupsUpdate,
}) => {
  const [completedPrepIds, setCompletedPrepIds] = useState<Set<string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editedGroups, setEditedGroups] = useState<PrepGroup[]>(prepGroups);
  const [isSaving, setIsSaving] = useState(false);

  const togglePrep = (prepId: string) => {
    const next = new Set(completedPrepIds);
    if (next.has(prepId)) { next.delete(prepId); } else { next.add(prepId); }
    setCompletedPrepIds(next);
  };

  const handleEditGroup = (group: PrepGroup) => {
    setEditedGroups(editedGroups.map((g) => (g.id === group.id ? group : g)));
  };

  const handleAddIngredient = (groupId: string) => {
    setEditedGroups(
      editedGroups.map((g) =>
        g.id === groupId ? { ...g, ingredients: [...g.ingredients, ''] } : g
      )
    );
  };

  const handleRemoveIngredient = (groupId: string, index: number) => {
    setEditedGroups(
      editedGroups.map((g) =>
        g.id === groupId
          ? { ...g, ingredients: g.ingredients.filter((_, i) => i !== index) }
          : g
      )
    );
  };

  const handleUpdateIngredient = (groupId: string, index: number, value: string) => {
    setEditedGroups(
      editedGroups.map((g) =>
        g.id === groupId
          ? { ...g, ingredients: g.ingredients.map((ing, i) => (i === index ? value : ing)) }
          : g
      )
    );
  };

  const handleSaveGroup = async (groupId: string) => {
    if (!guideId || !onPrepGroupsUpdate) return;
    try {
      setIsSaving(true);
      await onPrepGroupsUpdate(guideId, editedGroups);
      setEditingGroupId(null);
    } catch (error) {
      console.error('Failed to save prep group:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedGroups(prepGroups);
    setEditingGroupId(null);
  };

  const allPrepped = completedPrepIds.size === prepGroups.length;
  const prepProgress = prepGroups.length > 0 ? (completedPrepIds.size / prepGroups.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Mise en Place
        </h2>
        <p className="text-sm text-muted-foreground">Prepare and gather all ingredients</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preparation Progress
          </span>
          <span className="text-sm font-bold text-primary">
            {completedPrepIds.size} / {prepGroups.length}
          </span>
        </div>
        <Progress value={prepProgress} className="h-2" />
      </div>

      <Separator />

      <div className="grid gap-3">
        {editedGroups.map((group) => {
          const isEditing = editingGroupId === group.id;

          if (isEditing) {
            return (
              <Card key={group.id}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Edit Prep Group</h3>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Container</Label>
                      <Input
                        value={group.container}
                        onChange={(e) => handleEditGroup({ ...group, container: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Label</Label>
                      <Input
                        value={group.label}
                        onChange={(e) => handleEditGroup({ ...group, label: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prep Instructions</Label>
                      <Textarea
                        value={group.prepInstructions}
                        onChange={(e) => handleEditGroup({ ...group, prepInstructions: e.target.value })}
                        className="min-h-20"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Ingredients</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddIngredient(group.id)}
                          disabled={isSaving}
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {group.ingredients.map((ingredient, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              value={ingredient}
                              onChange={(e) => handleUpdateIngredient(group.id, idx, e.target.value)}
                              placeholder="e.g., 250g onion"
                              className="text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveIngredient(group.id, idx)}
                              disabled={isSaving}
                              className="px-2"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleSaveGroup(group.id)}
                      disabled={isSaving}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={group.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={completedPrepIds.has(group.id)}
                    onCheckedChange={() => togglePrep(group.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-medium text-sm">{group.container}</span>
                      <Badge variant="secondary" className="text-xs">{group.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{group.prepInstructions}</p>
                  </div>
                  {guideId && onPrepGroupsUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingGroupId(group.id)}
                      className="ml-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="ml-8 space-y-1">
                  {group.ingredients.map((ingredient, idx) => (
                    <div
                      key={idx}
                      className={`text-sm transition-opacity ${
                        completedPrepIds.has(group.id) ? 'opacity-50 line-through' : 'text-foreground'
                      }`}
                    >
                      • {ingredient}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allPrepped && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            ✓ All prep complete! Ready to start cooking.
          </p>
        </div>
      )}
    </div>
  );
};
