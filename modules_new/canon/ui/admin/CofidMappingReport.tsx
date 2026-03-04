/**
 * Canon Module — CofID Mapping Report Viewer
 *
 * Displays the results of CofID item import and mapping validation.
 * Read-only diagnostic tool.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import * as canonApi from '../../api';

export const CofidMappingReportViewer: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);

        // Fetch CofID items
        const cofidItems = await canonApi.getCanonCofidItems();

        // Fetch canonical aisles
        const aisles = await canonApi.getCanonAisles();

        // Load mapping file (would need to be seeded or embedded)
        // For now, show what we have
        const cofidMapping = {
          'AA': { name: 'Flours, grains and starches', aisle: 'Pantry' },
          'AC': { name: 'Rice', aisle: 'Rice, Pasta & Grains' },
          'AD': { name: 'Pasta', aisle: 'Pantry' },
          'FA': { name: 'Chicken', aisle: 'Meat & Fish' },
          'BAK': { name: 'Whole milk', aisle: 'Dairy & Eggs' },
          'BL': { name: 'Cheeses', aisle: 'Dairy & Eggs' },
        };

        // Generate report using Canon API
        const importReport = canonApi.generateCofidImportReport(
          cofidItems,
          cofidMapping,
          aisles as any,
        );

        setReport(importReport);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span>Generating CofID mapping report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!report) {
    return (
      <Alert>
        <AlertDescription>No CofID items found to report on.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">CofID Import Report</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Generated at {new Date(report.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Items</div>
          <div className="text-2xl font-bold">{report.totalItems}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Imported</div>
          <div className="text-2xl font-bold text-green-600">{report.importedItems}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Failed</div>
          <div className="text-2xl font-bold text-red-600">{report.failedItems}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">
            Embedding Errors
          </div>
          <div className="text-2xl font-bold">
            {report.embeddingValidationErrors?.length ?? 0}
          </div>
        </Card>
      </div>

      {/* Mapping Results */}
      {report.mappingResults && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Mapping Results</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Mapped</div>
              <div className="text-xl font-bold text-green-600">
                {report.mappingResults.mapped}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unmapped</div>
              <div className="text-xl font-bold text-amber-600">
                {report.mappingResults.unmapped}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Forced to Uncategorised</div>
              <div className="text-xl font-bold text-orange-600">
                {report.mappingResults.forced_to_uncategorised}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Embedding Errors */}
      {report.embeddingValidationErrors && report.embeddingValidationErrors.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-900">
            <AlertTriangle className="h-4 w-4" />
            Embedding Validation Errors
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {report.embeddingValidationErrors.map((err: any) => (
              <div key={err.id} className="text-sm p-2 bg-white rounded border border-red-200">
                <div className="font-mono text-red-700">{err.id}:</div>
                <div className="text-red-600 ml-2">{err.reason}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Mapping Failures */}
      {report.mappingFailures && report.mappingFailures.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Unmapped Groups (will use Uncategorised)
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {report.mappingFailures.map((failure: any) => (
              <div key={failure.group} className="text-sm p-2 bg-white rounded border border-amber-200">
                <div className="font-semibold text-amber-900">
                  {failure.group} — {failure.groupName}
                </div>
                <div className="text-amber-800">{failure.reason}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Collisions */}
      {report.collisions && report.collisions.length > 0 && (
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-yellow-900">
            <AlertTriangle className="h-4 w-4" />
            Aisle Name Collisions
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {report.collisions.map((collision: any) => (
              <div key={collision.normalisedName} className="text-sm p-2 bg-white rounded border border-yellow-200">
                <div className="font-mono text-yellow-900">"{collision.normalisedName}"</div>
                <div className="text-yellow-800 ml-2">
                  Multiple aisles: {collision.aisleNames.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {report.mappingFailures?.length === 0 &&
        report.embeddingValidationErrors?.length === 0 &&
        !report.collisions && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              All CofID items validated successfully!
            </AlertDescription>
          </Alert>
        )}
    </div>
  );
};
