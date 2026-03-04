/**
 * Canon Viewer — Read-only UI components
 *
 * Display-only components for browsing canon aisles and units.
 * All data is fetched via api.ts — no direct logic or data imports.
 */

import React, { useEffect, useState } from 'react';
import { Aisle, Unit } from '../../../types/contract';
import { getCanonAisles, getCanonUnits, groupUnitsByCategory } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

// ── Aisles Viewer ─────────────────────────────────────────────────────────────

export const AislesViewer: React.FC = () => {
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCanonAisles()
      .then(setAisles)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load aisles'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Canon Aisles</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Canon Aisles</CardTitle></CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Canon Aisles <Badge variant="secondary">{aisles.length}</Badge></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {aisles.map(aisle => (
            <div key={aisle.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted">
              <span className="font-medium text-sm">{aisle.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{aisle.id}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Units Viewer ─────────────────────────────────────────────────────────────

export const UnitsViewer: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCanonUnits()
      .then(setUnits)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load units'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Canon Units</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Canon Units</CardTitle></CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const grouped = groupUnitsByCategory(units);
  const categoryLabels: Record<string, string> = {
    weight: 'Weight',
    volume: 'Volume',
    count: 'Count',
    colloquial: 'Colloquial',
  };

  return (
    <div className="space-y-4">
      {(Object.keys(grouped) as (keyof typeof grouped)[]).map(cat => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="text-base">
              {categoryLabels[cat]}
              <Badge variant="secondary" className="ml-2">{grouped[cat].length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {grouped[cat].map(unit => (
                <Badge key={unit.id} variant="outline">
                  {unit.name}{unit.plural ? ` / ${unit.plural}` : ''}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
