/**
 * Prep Phase View Component
 * 
 * Displays prep groups as a checklist where user can mark items as prepped.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { PrepGroup } from '../types';

interface PrepPhaseViewProps {
  prepGroups: PrepGroup[];
}

export const PrepPhaseView: React.FC<PrepPhaseViewProps> = ({ prepGroups }) => {
  const [completedPrepIds, setCompletedPrepIds] = useState<Set<string>>(new Set());

  const togglePrep = (prepId: string) => {
    const newSet = new Set(completedPrepIds);
    if (newSet.has(prepId)) {
      newSet.delete(prepId);
    } else {
      newSet.add(prepId);
    }
    setCompletedPrepIds(newSet);
  };

  const allPrepped = completedPrepIds.size === prepGroups.length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Prep Phase</h2>
        <p className="text-sm text-muted-foreground">Prepare ingredients before you start cooking</p>
      </div>

      <div className="grid gap-3">
        {prepGroups.map(group => (
          <Card key={group.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 space-y-3">
              {/* Header with checkbox */}
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={completedPrepIds.has(group.id)}
                  onCheckedChange={() => togglePrep(group.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-medium text-sm">{group.container}</span>
                    <Badge variant="secondary" className="text-xs">
                      {group.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{group.prepInstructions}</p>
                </div>
              </div>

              {/* Ingredients list */}
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
        ))}
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
