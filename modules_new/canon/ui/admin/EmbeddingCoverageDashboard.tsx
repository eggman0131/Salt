/**
 * Canon Module — Embedding Coverage Dashboard
 *
 * Displays embedding coverage statistics and provides tools for:
 * - Generating embeddings for canon items (generic only)
 * - Viewing coverage by aisle
 * 
 * Note: CofID embeddings are seeded via the Canon Seeder tool during initial setup.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Database,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import * as canonApi from '../../api';
import type { CanonEmbeddingLookup } from '../../../../types/contract';

interface CoverageStats {
  total: number;
  cofidCount: number;
  canonCount: number;
  percentage: number;
}

interface AisleCoverage {
  aisleId: string;
  aisleName: string;
  total: number;
  cofidCount: number;
  canonCount: number;
  percentage: number;
}

export const EmbeddingCoverageDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embeddings, setEmbeddings] = useState<CanonEmbeddingLookup[]>([]);
  const [coverageStats, setCoverageStats] = useState<CoverageStats | null>(null);
  const [aisleCoverage, setAisleCoverage] = useState<AisleCoverage[]>([]);
  const [generatingCanon, setGeneratingCanon] = useState(false);

  // Load embeddings and calculate coverage
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all embeddings
      const allEmbeddings = await canonApi.getEmbeddingsFromLookup();
      setEmbeddings(allEmbeddings);

      // Calculate overall coverage
      const cofidCount = allEmbeddings.filter(e => e.kind === 'cofid').length;
      const canonCount = allEmbeddings.filter(e => e.kind === 'canon').length;
      const total = allEmbeddings.length;
      const percentage = total > 0 ? Math.round((total / total) * 100) : 0;

      setCoverageStats({
        total,
        cofidCount,
        canonCount,
        percentage,
      });

      // Calculate per-aisle coverage
      const aisles = await canonApi.getCanonAisles();

      // Group embeddings by aisle
      const grouped = canonApi.groupCoverageByAisle(allEmbeddings);

      const aisleCoverageData: AisleCoverage[] = aisles.map(aisle => {
        const aisleEmbeddings = grouped[aisle.id] || [];
        const cofidEntry = aisleEmbeddings.find(g => g.kind === 'cofid');
        const canonEntry = aisleEmbeddings.find(g => g.kind === 'canon');
        
        const cofidCount = cofidEntry?.count ?? 0;
        const canonCount = canonEntry?.count ?? 0;
        const total = cofidCount + canonCount;
        const percentage = total > 0 ? Math.round((total / total) * 100) : 0;

        return {
          aisleId: aisle.id,
          aisleName: aisle.name,
          total,
          cofidCount,
          canonCount,
          percentage,
        };
      });

      setAisleCoverage(aisleCoverageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load embeddings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Generate canon item embeddings
  const handleGenerateCanon = async () => {
    try {
      setGeneratingCanon(true);
      toast.info('Generating canon item embeddings...');

      const result = await canonApi.generateCanonItemEmbeddings();

      if (result.success) {
        toast.success(
          `Generated ${result.generated} canon embeddings` +
            (result.errors > 0 ? ` (${result.errors} errors)` : '')
        );
        await loadData();
      } else {
        toast.error(result.message || 'Failed to generate embeddings');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGeneratingCanon(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span>Loading embedding coverage...</span>
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

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Embedding Coverage Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Manage semantic matching embeddings for CofID and canon items
        </p>
      </div>

      {/* CofID Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          CofID embeddings are seeded during initial setup via the <strong>Canon Seeder</strong> tool.
          Use the button below to generate embeddings for canon items without CofID links.
        </AlertDescription>
      </Alert>

      {/* Action Button */}
      <div className="flex gap-3">
        <Button
          onClick={handleGenerateCanon}
          disabled={generatingCanon}
          variant="outline"
        >
          {generatingCanon ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Canon Embeddings
            </>
          )}
        </Button>
      </div>

      {/* Overall Coverage Stats */}
      {coverageStats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">
                Total Embeddings
              </div>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{coverageStats.total}</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">
                CofID Items
              </div>
              <Badge variant="outline" className="text-xs">
                CofID
              </Badge>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {coverageStats.cofidCount}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">
                Canon Items
              </div>
              <Badge variant="outline" className="text-xs">
                Canon
              </Badge>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {coverageStats.canonCount}
            </div>
          </Card>
        </div>
      )}

      {/* Per-Aisle Coverage Table */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Coverage by Aisle</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Aisle</th>
                <th className="text-right py-2 px-3 font-medium">Total</th>
                <th className="text-right py-2 px-3 font-medium">CofID</th>
                <th className="text-right py-2 px-3 font-medium">Canon</th>
                <th className="text-right py-2 px-3 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {aisleCoverage.map(aisle => (
                <tr key={aisle.aisleId} className="border-b last:border-0">
                  <td className="py-2 px-3 font-medium">{aisle.aisleName}</td>
                  <td className="py-2 px-3 text-right">{aisle.total}</td>
                  <td className="py-2 px-3 text-right">
                    <Badge variant="outline" className="text-blue-600">
                      {aisle.cofidCount}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Badge variant="outline" className="text-green-600">
                      {aisle.canonCount}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {aisle.total > 0 ? (
                      <div className="flex items-center justify-end gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span className="font-medium">{aisle.percentage}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Empty State */}
      {embeddings.length === 0 && (
        <Alert>
          <AlertDescription>
            No embeddings indexed yet. Import CofID embeddings or generate canon item
            embeddings to enable semantic matching.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
