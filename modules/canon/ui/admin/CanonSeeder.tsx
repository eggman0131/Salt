/**
 * Canon Seeder Admin Tool
 *
 * In-app seeding for canon aisles, units, CofID items, and group→aisle mappings.
 * Loads data from seed JSON files and writes to Firestore in authenticated context.
 */

import { useRef, useState } from 'react';
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
  seedItems,
  SeedResult,
  getCanonItems,
  loadFdcData,
  enrichCanonItemsWithFdc,
  type FdcEnrichmentResult,
} from '../../api';

// Import seed data files
import aislesData from '@/seed-data/canon-aisles.json';
import unitsData from '@/seed-data/canon-units.json';
import canonItemsData from '@/seed-data/canon-items-combined.json';
const canonItemsArray = (canonItemsData as any[]) || [];

type SeedStatus = 'idle' | 'seeding' | 'success' | 'error' | 'cancelled';

interface SeedState {
  aisles: SeedStatus;
  units: SeedStatus;
  canonItems: SeedStatus;
  fdcEnrichment: SeedStatus;
  aislesResult?: SeedResult;
  unitsResult?: SeedResult;
  canonItemsResult?: { imported: number; failed: number; errors: Array<{ id: string; reason: string }> };
  fdcEnrichmentResult?: FdcEnrichmentResult;
  // Progress tracking for large operations
  canonItemsProgress?: { processed: number; total: number };
  fdcEnrichmentProgress?: { processed: number; total: number };
  canonAbortController?: AbortController;
  fdcAbortController?: AbortController;
}

export default function CanonSeeder() {
  const [state, setState] = useState<SeedState>({
    aisles: 'idle',
    units: 'idle',
    canonItems: 'idle',
    fdcEnrichment: 'idle',
  });
  const canonFileRef = useRef<HTMLInputElement>(null);

  const handleSeedAisles = async () => {
    setState(s => ({ ...s, aisles: 'seeding' }));

    try {
      const { valid, invalid } = validateAisleSeeds(aislesData);

      if (invalid.length > 0) {
        toast.error(`Found ${invalid.length} invalid aisles`);
        setState(s => ({ ...s, aisles: 'error' }));
        return;
      }

      const prepared = valid.map((seed, index) =>
        prepareAisleForFirestore(seed, crypto.randomUUID(), index)
      );
      await seedCanonAisles(prepared);

      const result: SeedResult = {
        total: valid.length,
        succeeded: valid.length,
        failed: 0,
        items: prepared.map(a => ({ id: a.id, success: true })),
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


  const handleSeedCanonItems = async (file: File) => {
    const abortController = new AbortController();
    setState(s => ({ ...s, canonItems: 'seeding', canonAbortController: abortController, canonItemsProgress: { processed: 0, total: 0 } }));

    try {
      const text = await file.text();
      const items = JSON.parse(text);
      if (!Array.isArray(items)) throw new Error('JSON must be an array of canon items');

      setState(s => ({ ...s, canonItemsProgress: { processed: 0, total: items.length } }));

      const result = await seedItems(
        items,
        (processed, total) => {
          setState(s => ({ ...s, canonItemsProgress: { processed, total } }));
        },
        abortController.signal
      );

      setState(s => ({
        ...s,
        canonItems: result.failed === 0 ? 'success' : 'error',
        canonItemsResult: result,
        canonItemsProgress: undefined,
        canonAbortController: undefined,
      }));

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} canon items${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
      } else {
        toast.error(`No items imported (${result.failed} failed)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('cancelled') || msg.includes('aborted')) {
        setState(s => ({ ...s, canonItems: 'cancelled', canonItemsProgress: undefined, canonAbortController: undefined }));
        toast.info('Canon items import cancelled');
      } else {
        setState(s => ({ ...s, canonItems: 'error', canonItemsProgress: undefined, canonAbortController: undefined }));
        toast.error(msg || 'Failed to import canon items');
      }
    }
  };

  const handleCancelCanonItems = () => {
    state.canonAbortController?.abort();
    setState(s => ({ ...s, canonItems: 'cancelled', canonAbortController: undefined }));
  };

  const handleSeedCanonItemsFromFile = async () => {
    const abortController = new AbortController();
    setState(s => ({ ...s, canonItems: 'seeding', canonAbortController: abortController, canonItemsProgress: { processed: 0, total: canonItemsArray.length } }));

    try {
      const result = await seedItems(
        canonItemsArray,
        (processed, total) => {
          setState(s => ({ ...s, canonItemsProgress: { processed, total } }));
        },
        abortController.signal
      );

      setState(s => ({
        ...s,
        canonItems: result.failed === 0 ? 'success' : 'error',
        canonItemsResult: result,
        canonItemsProgress: undefined,
        canonAbortController: undefined,
      }));

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} canon items${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
      } else {
        toast.error(`No items imported (${result.failed} failed)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('cancelled') || msg.includes('aborted')) {
        setState(s => ({ ...s, canonItems: 'cancelled', canonItemsProgress: undefined, canonAbortController: undefined }));
        toast.info('Canon items import cancelled');
      } else {
        setState(s => ({ ...s, canonItems: 'error', canonItemsProgress: undefined, canonAbortController: undefined }));
        toast.error(msg || 'Failed to import canon items');
      }
    }
  };

  const handleEnrichWithFdc = async () => {
    const abortController = new AbortController();
    setState(s => ({
      ...s,
      fdcEnrichment: 'seeding',
      fdcAbortController: abortController,
      fdcEnrichmentProgress: { processed: 0, total: 0 },
    }));

    try {
      // Load canon items from Firestore
      const canonItems = await getCanonItems();
      setState(s => ({ ...s, fdcEnrichmentProgress: { processed: 0, total: canonItems.length } }));

      if (abortController.signal.aborted) {
        setState(s => ({ ...s, fdcEnrichment: 'cancelled', fdcEnrichmentProgress: undefined }));
        return;
      }

      // Download FDC binary + index (cached in module scope after first load)
      await loadFdcData();

      const result = await enrichCanonItemsWithFdc(
        canonItems,
        (processed, total) => {
          setState(s => ({ ...s, fdcEnrichmentProgress: { processed, total } }));
        },
        abortController.signal
      );

      setState(s => ({
        ...s,
        fdcEnrichment: result.success ? 'success' : 'error',
        fdcEnrichmentResult: result,
        fdcEnrichmentProgress: undefined,
        fdcAbortController: undefined,
      }));

      if (result.success) {
        toast.success(
          `FDC enrichment complete: ${result.enriched} enriched, ${result.noMatch} no match${result.errors > 0 ? `, ${result.errors} errors` : ''}`
        );
      } else {
        toast.error(result.message || 'FDC enrichment failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('cancelled') || msg.includes('aborted')) {
        setState(s => ({ ...s, fdcEnrichment: 'cancelled', fdcEnrichmentProgress: undefined, fdcAbortController: undefined }));
        toast.info('FDC enrichment cancelled');
      } else {
        console.error('Error enriching with FDC:', err);
        setState(s => ({ ...s, fdcEnrichment: 'error', fdcEnrichmentProgress: undefined, fdcAbortController: undefined }));
        toast.error(msg || 'FDC enrichment failed');
      }
    }
  };

  const handleCancelFdcEnrichment = () => {
    state.fdcAbortController?.abort();
    setState(s => ({ ...s, fdcEnrichment: 'cancelled', fdcAbortController: undefined }));
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
              Seed all collections in order: aisles → units
            </p>
          </div>
          <Button
            onClick={handleSeedAll}
            disabled={
              state.aisles === 'seeding' ||
              state.units === 'seeding'
            }
            className="gap-2"
          >
            {(state.aisles === 'seeding' ||
              state.units === 'seeding') ? (
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

        {/* Canon Items */}
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                Canon Items
                {renderStatusIcon(state.canonItems)}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {canonItemsArray.length} items from generated seed data
              </p>
            </div>

            {state.canonItemsResult && (
              <div className={`text-sm space-y-1 p-3 rounded border ${state.canonItemsResult.failed === 0 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'}`}>
                <div className={`font-medium ${state.canonItemsResult.failed === 0 ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}`}>
                  {state.canonItemsResult.failed === 0 ? '✓ Imported' : '⚠ Partial import'}
                </div>
                <div className="text-muted-foreground">
                  {state.canonItemsResult.imported} imported
                  {state.canonItemsResult.failed > 0 && `, ${state.canonItemsResult.failed} failed`}
                </div>
                {state.canonItemsResult.errors.length > 0 && (
                  <ul className="text-xs mt-1 space-y-0.5">
                    {state.canonItemsResult.errors.slice(0, 3).map((e, i) => (
                      <li key={i} className="text-destructive">{e.id}: {e.reason}</li>
                    ))}
                    {state.canonItemsResult.errors.length > 3 && (
                      <li className="text-muted-foreground">…and {state.canonItemsResult.errors.length - 3} more</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <input
              ref={canonFileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleSeedCanonItems(file);
                e.target.value = '';
              }}
            />

            <div className="flex gap-2">
              <Button
                onClick={handleSeedCanonItemsFromFile}
                disabled={state.canonItems === 'seeding' || canonItemsArray.length === 0}
                variant="outline"
                className="flex-1"
              >
                {state.canonItems === 'seeding' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Seed Canon Items
                  </>
                )}
              </Button>
              <Button
                onClick={() => canonFileRef.current?.click()}
                disabled={state.canonItems === 'seeding'}
                variant="ghost"
                size="sm"
                title="Upload custom JSON"
                className="px-3"
              >
                Upload
              </Button>
              {state.canonItems === 'seeding' && (
                <Button onClick={handleCancelCanonItems} variant="destructive" size="sm" className="px-3">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {state.canonItems === 'seeding' && state.canonItemsProgress && state.canonItemsProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {state.canonItemsProgress.processed} of {state.canonItemsProgress.total} items…
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((state.canonItemsProgress.processed / state.canonItemsProgress.total) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(state.canonItemsProgress.processed / state.canonItemsProgress.total) * 100}
                  className="h-2"
                />
              </div>
            )}
          </div>
        </Card>
      </div>

        {/* FDC Enrichment */}
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                FDC Portions Enrichment
                {renderStatusIcon(state.fdcEnrichment)}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Match canon items to USDA FDC foods to populate unit conversion fields
              </p>
            </div>

            {state.fdcEnrichmentResult && (
              <div className={`text-sm space-y-1 p-3 rounded border ${state.fdcEnrichmentResult.success ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'}`}>
                <div className={`font-medium ${state.fdcEnrichmentResult.success ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}`}>
                  {state.fdcEnrichmentResult.success ? '✓ Complete' : '⚠ Partial'}
                </div>
                <div className="text-muted-foreground">
                  {state.fdcEnrichmentResult.enriched} enriched
                  {state.fdcEnrichmentResult.noMatch > 0 && `, ${state.fdcEnrichmentResult.noMatch} no match`}
                  {state.fdcEnrichmentResult.errors > 0 && `, ${state.fdcEnrichmentResult.errors} errors`}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleEnrichWithFdc}
                disabled={state.fdcEnrichment === 'seeding'}
                variant="outline"
                className="flex-1"
              >
                {state.fdcEnrichment === 'seeding' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Enrich with FDC
                  </>
                )}
              </Button>
              {state.fdcEnrichment === 'seeding' && (
                <Button
                  onClick={handleCancelFdcEnrichment}
                  variant="destructive"
                  size="sm"
                  className="px-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {state.fdcEnrichment === 'seeding' && state.fdcEnrichmentProgress && state.fdcEnrichmentProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {state.fdcEnrichmentProgress.processed} of {state.fdcEnrichmentProgress.total} items…
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((state.fdcEnrichmentProgress.processed / state.fdcEnrichmentProgress.total) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(state.fdcEnrichmentProgress.processed / state.fdcEnrichmentProgress.total) * 100}
                  className="h-2"
                />
              </div>
            )}
          </div>
        </Card>

      {/* Info Box */}
      <Card className="p-4 bg-muted/50">
        <div className="text-sm space-y-2">
          <div className="font-medium">Seeding Order</div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Canon Aisles (foundational reference data)</li>
            <li>Canon Units (foundational reference data)</li>
            <li>Canon Items (ingredient and product data from seed generation)</li>
            <li>FDC Portions Enrichment (populate unit conversion fields from USDA portions data)</li>
          </ol>
          <div className="pt-2 border-t text-xs">
            ✓ All operations are idempotent and can be run multiple times safely
          </div>
        </div>
      </Card>
    </div>
  );
}
