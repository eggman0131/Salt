/**
 * Canon Seeder Admin Tool
 *
 * In-app seeding for canon aisles, units, CofID items, and group→aisle mappings.
 * Loads data from seed JSON files and writes to Firestore in authenticated context.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Upload, Database, X } from 'lucide-react';
import {
  validateAisleSeeds,
  validateUnitSeeds,
  prepareAisleForFirestore,
  prepareUnitForFirestore,
  seedCanonAisles,
  seedCanonUnits,
  seedCofidGroupAisleMappings,
  seedCofidItems,
  seedCofidEmbeddings,
  getCanonAisles,
  SeedResult,
} from '../../api';

// Import seed data files
import aislesData from '@/seed-data/canon-aisles.json';
import unitsData from '@/seed-data/canon-units.json';
import cofidItemsData from '@/seed-data/cofid-items.backup.v1.json';
import cofidMappingsData from '@/scripts/cofid-aisle-mapping.json';

// Type the CofID items as array (it's either [{ id, data }] from backup or [CofIDItem])
const cofidItemsArray = (cofidItemsData as any[]) || [];
const cofidMappingsCount = Object.keys(cofidMappingsData).length;

type SeedStatus = 'idle' | 'seeding' | 'success' | 'error' | 'cancelled';

interface SeedState {
  aisles: SeedStatus;
  units: SeedStatus;
  cofidMappings: SeedStatus;
  cofidItems: SeedStatus;
  cofidEmbeddings: SeedStatus;
  aislesResult?: SeedResult;
  unitsResult?: SeedResult;
  cofidMappingsResult?: { count: number; errors: number };
  cofidItemsResult?: { imported: number; failed: number; errors: Array<{ id: string; reason: string }> };
  cofidEmbeddingsResult?: { success: boolean; imported: number; skipped: number; errors: number };
  // Progress tracking for large operations
  cofidItemsProgress?: { processed: number; total: number };
  abortController?: AbortController;
}

export default function CanonSeeder() {
  const [state, setState] = useState<SeedState>({
    aisles: 'idle',
    units: 'idle',
    cofidMappings: 'idle',
    cofidItems: 'idle',
    cofidEmbeddings: 'idle',
  });

  const handleSeedAisles = async () => {
    setState(s => ({ ...s, aisles: 'seeding' }));

    try {
      const { valid, invalid } = validateAisleSeeds(aislesData);

      if (invalid.length > 0) {
        toast.error(`Found ${invalid.length} invalid aisles`);
        setState(s => ({ ...s, aisles: 'error' }));
        return;
      }

      const prepared = valid.map(prepareAisleForFirestore);
      await seedCanonAisles(prepared);

      const result: SeedResult = {
        total: valid.length,
        succeeded: valid.length,
        failed: 0,
        items: valid.map(a => ({ id: a.id, success: true })),
      };

      setState(s => ({ ...s, aisles: 'success', aislesResult: result }));
      toast.success(`Seeded ${valid.length} aisles`);
    } catch (error) {
      console.error('Error seeding aisles:', error);
      toast.error('Failed to seed aisles');
      setState(s => ({ ...s, aisles: 'error' }));
    }
  };

  const handleSeedUnits = async () => {
    setState(s => ({ ...s, units: 'seeding' }));

    try {
      const { valid, invalid } = validateUnitSeeds(unitsData);

      if (invalid.length > 0) {
        toast.error(`Found ${invalid.length} invalid units`);
        setState(s => ({ ...s, units: 'error' }));
        return;
      }

      const prepared = valid.map(prepareUnitForFirestore);
      await seedCanonUnits(prepared);

      const result: SeedResult = {
        total: valid.length,
        succeeded: valid.length,
        failed: 0,
        items: valid.map(u => ({ id: u.id, success: true })),
      };

      setState(s => ({ ...s, units: 'success', unitsResult: result }));
      toast.success(`Seeded ${valid.length} units`);
    } catch (error) {
      console.error('Error seeding units:', error);
      toast.error('Failed to seed units');
      setState(s => ({ ...s, units: 'error' }));
    }
  };

  const handleSeedCofidMappings = async () => {
    setState(s => ({ ...s, cofidMappings: 'seeding' }));

    try {
      // Fetch seeded aisles to build name → ID lookup
      const aisles = await getCanonAisles();
      const aisleNameToId: Record<string, string> = {};
      for (const aisle of aisles) {
        aisleNameToId[aisle.name] = aisle.id;
      }

      // Transform raw mappings (with aisle names) to Firestore format (with aisleIds)
      const transformedMappings: Record<string, any> = {};
      let missingAisles = 0;

      Object.entries(cofidMappingsData).forEach(([groupCode, mapping]: [string, any]) => {
        const aisleName = mapping.aisle;
        const aisleId = aisleNameToId[aisleName];

        if (!aisleId) {
          console.warn(`[CanonSeeder] No aisle ID found for aisle name: "${aisleName}"`);
          missingAisles++;
          return; // Skip this mapping
        }

        transformedMappings[groupCode] = {
          id: groupCode,
          cofidGroup: groupCode,
          cofidGroupName: mapping.name,
          aisleId,
          aisleName,
        };
      });

      if (missingAisles > 0) {
        toast.warning(`Skipped ${missingAisles} mappings with missing aisle names`);
      }

      await seedCofidGroupAisleMappings(transformedMappings);

      const count = Object.keys(transformedMappings).length;
      setState(s => ({
        ...s,
        cofidMappings: 'success',
        cofidMappingsResult: { count, errors: missingAisles },
      }));
      toast.success(`Seeded ${count} CofID group mappings`);
    } catch (error) {
      console.error('Error seeding CofID mappings:', error);
      toast.error('Failed to seed CofID mappings');
      setState(s => ({ ...s, cofidMappings: 'error' }));
    }
  };

  const handleSeedCofidItems = async () => {
    const abortController = new AbortController();
    setState(s => ({ ...s, cofidItems: 'seeding', abortController, cofidItemsProgress: { processed: 0, total: cofidItemsArray.length } }));

    try {
      const result = await seedCofidItems(
        cofidItemsArray,
        (processed, total) => {
          setState(s => ({ ...s, cofidItemsProgress: { processed, total } }));
        },
        abortController.signal
      );

      if (result.imported > 0) {
        setState(s => ({ ...s, cofidItems: 'success', cofidItemsResult: result, cofidItemsProgress: undefined }));
        toast.success(`Seeded ${result.imported} CofID items${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
      } else {
        setState(s => ({ ...s, cofidItems: 'error', cofidItemsResult: result, cofidItemsProgress: undefined }));
        toast.error(`Failed to seed CofID items (${result.failed} errors)`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('cancelled')) {
        setState(s => ({ ...s, cofidItems: 'cancelled', cofidItemsProgress: undefined }));
        toast.info('CofID items seeding cancelled');
      } else {
        console.error('Error seeding CofID items:', error);
        toast.error(msg || 'Failed to seed CofID items');
        setState(s => ({ ...s, cofidItems: 'error', cofidItemsProgress: undefined }));
      }
    }
  };

  const handleCancelCofidItems = () => {
    state.abortController?.abort();
    setState(s => ({ ...s, cofidItems: 'cancelled', abortController: undefined }));
  };

  const handleSeedCofidEmbeddings = async () => {
    setState(s => ({ ...s, cofidEmbeddings: 'seeding' }));

    try {
      const result = await seedCofidEmbeddings(cofidItemsArray);

      if (result.success && result.imported > 0) {
        setState(s => ({ ...s, cofidEmbeddings: 'success', cofidEmbeddingsResult: result }));
        toast.success(
          `Imported ${result.imported} CofID embeddings${result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}`
        );
      } else if (result.success && result.imported === 0) {
        setState(s => ({ ...s, cofidEmbeddings: 'error', cofidEmbeddingsResult: result }));
        toast.info(result.message || 'No embeddings to import');
      } else {
        setState(s => ({ ...s, cofidEmbeddings: 'error', cofidEmbeddingsResult: result }));
        toast.error(result.message || `Failed to import embeddings (${result.errors} errors)`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error seeding CofID embeddings:', error);
      setState(s => ({ ...s, cofidEmbeddings: 'error' }));
      toast.error(msg || 'Failed to seed CofID embeddings');
    }
  };

  const handleSeedAll = async () => {
    await handleSeedAisles();
    await handleSeedUnits();
    await handleSeedCofidMappings();
    await handleSeedCofidItems();
    await handleSeedCofidEmbeddings();
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
          Import canonical data, build local embeddings, and publish the shared master snapshot
        </p>
      </div>

      {/* Seed All Button */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium flex items-center gap-2">
              <Database className="h-5 w-5" />
              Seed Everything
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Seed all collections in order: aisles → units → CofID mappings → CofID items
            </p>
          </div>
          <Button
            onClick={handleSeedAll}
            disabled={
              state.aisles === 'seeding' ||
              state.units === 'seeding' ||
              state.cofidMappings === 'seeding' ||
              state.cofidItems === 'seeding'
            }
            className="gap-2"
          >
            {(state.aisles === 'seeding' ||
              state.units === 'seeding' ||
              state.cofidMappings === 'seeding' ||
              state.cofidItems === 'seeding') ? (
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

      {/* Individual Seed Cards - 2x2 Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Aisles */}
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                Canon Aisles
                {renderStatusIcon(state.aisles)}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {aislesData.length} aisles ready
              </p>
            </div>

            {state.aislesResult && (
              <div className="text-sm space-y-1 p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                <div className="font-medium text-green-900 dark:text-green-100">✓ Seeded</div>
                <div className="text-muted-foreground">
                  {state.aislesResult.total} items
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
            <div>
              <h3 className="font-medium flex items-center gap-2">
                Canon Units
                {renderStatusIcon(state.units)}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {unitsData.length} units ready
              </p>
            </div>

            {state.unitsResult && (
              <div className="text-sm space-y-1 p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                <div className="font-medium text-green-900 dark:text-green-100">✓ Seeded</div>
                <div className="text-muted-foreground">
                  {state.unitsResult.total} items
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

        {/* CofID Group Mappings */}
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                CofID Group → Aisle Mappings
                {renderStatusIcon(state.cofidMappings)}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {cofidMappingsCount} mappings ready
              </p>
            </div>

            {state.cofidMappingsResult && (
              <div className="text-sm space-y-1 p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                <div className="font-medium text-green-900 dark:text-green-100">✓ Seeded</div>
                <div className="text-muted-foreground">
                  {state.cofidMappingsResult.count} mappings
                </div>
              </div>
            )}

            <Button
              onClick={handleSeedCofidMappings}
              disabled={state.cofidMappings === 'seeding'}
              variant="outline"
              className="w-full"
            >
              {state.cofidMappings === 'seeding' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Seeding...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Seed Mappings
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* CofID Items */}
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                CofID Items
                {renderStatusIcon(state.cofidItems)}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {cofidItemsArray.length} items ready (with embeddings)
              </p>
            </div>

            {state.cofidItemsResult && (
              <div className="text-sm space-y-1 p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                <div className="font-medium text-green-900 dark:text-green-100">✓ Seeded</div>
                <div className="text-muted-foreground">
                  {state.cofidItemsResult.imported} items
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSeedCofidItems}
                disabled={state.cofidItems === 'seeding'}
                variant="outline"
                className="flex-1"
              >
                {state.cofidItems === 'seeding' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Seed CofID Items
                  </>
                )}
              </Button>
              {state.cofidItems === 'seeding' && (
                <Button
                  onClick={handleCancelCofidItems}
                  variant="destructive"
                  size="sm"
                  className="px-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {state.cofidItems === 'seeding' && state.cofidItemsProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Importing {state.cofidItemsProgress.processed} of {state.cofidItemsProgress.total} items...
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {state.cofidItemsProgress.total > 0
                      ? Math.round((state.cofidItemsProgress.processed / state.cofidItemsProgress.total) * 100)
                      : 0}%
                  </span>
                </div>
                <Progress
                  value={(state.cofidItemsProgress.processed / state.cofidItemsProgress.total) * 100}
                  className="h-2"
                />
              </div>
            )}
          </div>
        </Card>

        {/* CofID Embeddings */}
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                CofID Embeddings
                {renderStatusIcon(state.cofidEmbeddings)}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Semantic matching vectors from backup file
              </p>
            </div>

            {state.cofidEmbeddingsResult && (
              <div className="text-sm space-y-1 p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                <div className="font-medium text-green-900 dark:text-green-100">✓ Imported</div>
                <div className="text-muted-foreground">
                  {state.cofidEmbeddingsResult.imported} embeddings
                  {state.cofidEmbeddingsResult.skipped > 0 && ` (${state.cofidEmbeddingsResult.skipped} skipped)`}
                </div>
              </div>
            )}

            <Button
              onClick={handleSeedCofidEmbeddings}
              disabled={state.cofidEmbeddings === 'seeding'}
              variant="outline"
              className="w-full"
            >
              {state.cofidEmbeddings === 'seeding' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Seed CofID Embeddings
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

          {/* Info Box */}
      <Card className="p-4 bg-muted/50">
        <div className="text-sm space-y-2">
          <div className="font-medium">Seeding Order</div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Canon Aisles (foundational reference data)</li>
            <li>Canon Units (foundational reference data)</li>
            <li>CofID Group → Aisle Mappings (for CofID item resolution)</li>
            <li>CofID Items (with embeddings for semantic matching)</li>
            <li>CofID Embeddings (build local lookup and publish Firebase Storage master snapshot)</li>
          </ol>
          <div className="pt-2 border-t text-xs">
            ✓ All operations are idempotent and can be run multiple times safely
          </div>
        </div>
      </Card>
    </div>
  );
}
