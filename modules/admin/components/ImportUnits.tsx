import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { seedCanonUnits } from '../../../modules_new/canon/api';
import { softToast } from '@/lib/soft-toast';
import unitsData from '../../../seed-data/units.json';

export const ImportUnits: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      // Filter to only required/expected fields, omit id and createdAt
      const unitsToImport = unitsData.map(u => ({
        name: u.name,
        plural: u.plural,
        category: u.category,
        sortOrder: u.sortOrder,
      }));

      softToast.info('Seeding cooking units', {
        description: `Setting up ${unitsToImport.length} cooking units...`,
      });

      await seedCanonUnits(unitsToImport as any);

      softToast.success('Cooking units seeded', {
        description: `${unitsToImport.length} units seeded`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to seed units';
      console.error('Unit seeding failed:', err);
      softToast.error('Seeding failed', {
        description: errorMsg,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-4 md:p-6">
        <div className="space-y-1">
          <CardTitle className="text-xl md:text-2xl">Cooking Units</CardTitle>
          <p className="text-sm text-muted-foreground">
            Seed British cooking unit vocabulary for ingredient parsing
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          The ingredient parser uses units to normalize recipe imports. This seed includes professional British cooking vocabulary covering weights, volumes, counts, and colloquial measurements.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Available units: {unitsData.length}</p>
          <div className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-y-auto p-2 border rounded bg-muted/30">
            {unitsData.slice(0, 10).map((unit) => (
              <div key={unit.id}>
                <span className="font-mono text-xs">{unit.name}</span>
                {unit.plural && <span className="text-xs"> / {unit.plural}</span>}
                <span className="text-xs"> ({unit.category})</span>
              </div>
            ))}
            {unitsData.length > 10 && (
              <div className="text-xs italic">
                ... and {unitsData.length - 10} more
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={handleImport}
          disabled={isImporting}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isImporting ? 'Seeding...' : 'Seed Cooking Units'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Safe to run multiple times. Existing units are preserved; only new units are added.
        </p>
      </CardContent>
    </Card>
  );
};
