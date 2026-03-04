/**
 * Canon Seeder Admin Tool
 *
 * In-app seeding for canon aisles and units.
 * Loads data from seed JSON files and writes to Firestore in authenticated context.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Upload } from 'lucide-react';
import {
  validateAisleSeeds,
  validateUnitSeeds,
  prepareAisleForFirestore,
  prepareUnitForFirestore,
  seedCanonAisles,
  seedCanonUnits,
  SeedResult,
} from '../../api';

// Import seed data files
import aislesData from '@/seed-data/canon-aisles.json';
import unitsData from '@/seed-data/canon-units.json';

type SeedStatus = 'idle' | 'seeding' | 'success' | 'error';

interface SeedState {
  aisles: SeedStatus;
  units: SeedStatus;
  aislesResult?: SeedResult;
  unitsResult?: SeedResult;
}

export default function CanonSeeder() {
  const [state, setState] = useState<SeedState>({
    aisles: 'idle',
    units: 'idle',
  });

  const handleSeedAisles = async () => {
    setState(s => ({ ...s, aisles: 'seeding' }));

    try {
      // Validate seed data
      const { valid, invalid } = validateAisleSeeds(aislesData);

      if (invalid.length > 0) {
        toast.error(`Found ${invalid.length} invalid aisles in seed data`);
        setState(s => ({ ...s, aisles: 'error' }));
        return;
      }

      // Prepare for Firestore
      const prepared = valid.map(prepareAisleForFirestore);

      // Batch write to Firestore
      await seedCanonAisles(prepared);

      const result: SeedResult = {
        total: valid.length,
        succeeded: valid.length,
        failed: 0,
        items: valid.map(a => ({ id: a.id, success: true })),
      };

      setState(s => ({ ...s, aisles: 'success', aislesResult: result }));
      toast.success(`Seeded ${valid.length} canon aisles`);
    } catch (error) {
      console.error('Error seeding aisles:', error);
      toast.error('Failed to seed aisles');
      setState(s => ({ ...s, aisles: 'error' }));
    }
  };

  const handleSeedUnits = async () => {
    setState(s => ({ ...s, units: 'seeding' }));

    try {
      // Validate seed data
      const { valid, invalid } = validateUnitSeeds(unitsData);

      if (invalid.length > 0) {
        toast.error(`Found ${invalid.length} invalid units in seed data`);
        setState(s => ({ ...s, units: 'error' }));
        return;
      }

      // Prepare for Firestore
      const prepared = valid.map(prepareUnitForFirestore);

      // Batch write to Firestore
      await seedCanonUnits(prepared);

      const result: SeedResult = {
        total: valid.length,
        succeeded: valid.length,
        failed: 0,
        items: valid.map(u => ({ id: u.id, success: true })),
      };

      setState(s => ({ ...s, units: 'success', unitsResult: result }));
      toast.success(`Seeded ${valid.length} canon units`);
    } catch (error) {
      console.error('Error seeding units:', error);
      toast.error('Failed to seed units');
      setState(s => ({ ...s, units: 'error' }));
    }
  };

  const handleSeedAll = async () => {
    await handleSeedAisles();
    await handleSeedUnits();
  };

  const renderStatusIcon = (status: SeedStatus) => {
    switch (status) {
      case 'seeding':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Canon Seeder</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Import canonical aisles and units from seed files into Firestore
        </p>
      </div>

      {/* Seed All Button */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Seed All Collections</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Seed both aisles ({aislesData.length}) and units ({unitsData.length}) in one go
            </p>
          </div>
          <Button
            onClick={handleSeedAll}
            disabled={state.aisles === 'seeding' || state.units === 'seeding'}
            className="gap-2"
          >
            {(state.aisles === 'seeding' || state.units === 'seeding') ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Seeding...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Seed All
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Individual Seed Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Aisles */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  Canon Aisles
                  {renderStatusIcon(state.aisles)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {aislesData.length} aisles ready to seed
                </p>
              </div>
            </div>

            {state.aislesResult && (
              <div className="text-sm space-y-1 p-3 bg-muted/50 rounded">
                <div className="font-medium">Result:</div>
                <div className="text-muted-foreground">
                  Total: {state.aislesResult.total} | Succeeded: {state.aislesResult.succeeded} | Failed: {state.aislesResult.failed}
                </div>
              </div>
            )}

            <Button
              onClick={handleSeedAisles}
              disabled={state.aisles === 'seeding'}
              variant="outline"
              className="w-full"
            >
              {state.aisles === 'seeding' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Seeding...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Seed Aisles
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Units */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  Canon Units
                  {renderStatusIcon(state.units)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {unitsData.length} units ready to seed
                </p>
              </div>
            </div>

            {state.unitsResult && (
              <div className="text-sm space-y-1 p-3 bg-muted/50 rounded">
                <div className="font-medium">Result:</div>
                <div className="text-muted-foreground">
                  Total: {state.unitsResult.total} | Succeeded: {state.unitsResult.succeeded} | Failed: {state.unitsResult.failed}
                </div>
              </div>
            )}

            <Button
              onClick={handleSeedUnits}
              disabled={state.units === 'seeding'}
              variant="outline"
              className="w-full"
            >
              {state.units === 'seeding' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Seeding...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Seed Units
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Info Notice */}
      <div className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-4 py-2">
        <p className="font-medium">Idempotent Operation</p>
        <p className="mt-1">
          Seeding is safe to run multiple times. Existing documents with matching IDs will be overwritten.
        </p>
      </div>
    </div>
  );
}
