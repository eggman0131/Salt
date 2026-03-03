/**
 * Canon Module – AI Ingredient Parse Tool (Admin UI)
 *
 * Minimal admin tool for validating the AI batch ingredient parse pipeline.
 * Allows pasting ingredient lines, running the AI parse, and inspecting the
 * structured results + review flags.
 *
 * Display-only: calls data/aiParseIngredients for I/O and api.ts for
 * pure validation logic.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { aiParseIngredients } from '../../data/aiParseIngredients';
import { validateAiParseResults, UNCATEGORISED_AISLE } from '../../api';
import type { AisleRef, UnitRef, ValidatedParseResult } from '../../api';

// ---------------------------------------------------------------------------
// Demo aisles and units used when the tool runs standalone
// (In production these would come from the canon data layer)
// ---------------------------------------------------------------------------

const DEMO_AISLES: AisleRef[] = [
  { id: 'produce', name: 'Produce' },
  { id: 'dairy', name: 'Dairy & Eggs' },
  { id: 'meat', name: 'Meat & Fish' },
  { id: 'dry-goods', name: 'Dry Goods & Baking' },
  { id: 'condiments', name: 'Condiments & Sauces' },
  { id: 'frozen', name: 'Frozen' },
  UNCATEGORISED_AISLE,
];

const DEMO_UNITS: UnitRef[] = [
  { id: 'g', name: 'g', plural: null },
  { id: 'kg', name: 'kg', plural: null },
  { id: 'ml', name: 'ml', plural: null },
  { id: 'l', name: 'l', plural: null },
  { id: 'tsp', name: 'tsp', plural: 'tsps' },
  { id: 'tbsp', name: 'tbsp', plural: 'tbsps' },
  { id: 'clove', name: 'clove', plural: 'cloves' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AiIngredientParseTool: React.FC = () => {
  const [rawText, setRawText] = useState('');
  const [results, setResults] = useState<ValidatedParseResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  async function handleParse() {
    if (lines.length === 0) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const raw = await aiParseIngredients(lines, DEMO_AISLES, DEMO_UNITS);
      const { items } = validateAiParseResults(
        raw,
        DEMO_AISLES,
        DEMO_UNITS,
        lines.length,
      );
      setResults(items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to parse ingredients. Please try again or contact support if the issue persists.',
      );
    } finally {
      setLoading(false);
    }
  }

  const hasReviewFlags = results?.some((r) => r.flags.length > 0) ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          AI Ingredient Parse Tool
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Paste ingredient lines below, one per line, then run the AI parse to
          see structured results and review flags.
        </p>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <label
          htmlFor="ingredient-input"
          className="text-sm font-medium text-foreground"
        >
          Ingredient Lines
        </label>
        <Textarea
          id="ingredient-input"
          placeholder={`2 cloves garlic, finely chopped\n200g chicken breast\n1 tbsp olive oil`}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={8}
          className="font-mono text-sm"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          {lines.length} ingredient{lines.length === 1 ? '' : 's'} detected
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end">
        <Button
          onClick={handleParse}
          disabled={loading || lines.length === 0}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing…
            </>
          ) : (
            'Run AI Parse'
          )}
        </Button>
      </div>

      {/* Results */}
      {results !== null && (
        <div className="space-y-3">
          {/* Summary badge */}
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Results</h3>
            {hasReviewFlags ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Needs review
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Clean
              </Badge>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Canonical Name</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Aisle</TableHead>
                  <TableHead>Preparations</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(({ result, flags }) => (
                  <TableRow
                    key={result.index}
                    className={flags.length > 0 ? 'bg-destructive/5' : ''}
                  >
                    <TableCell className="text-muted-foreground text-xs">
                      {result.index}
                    </TableCell>
                    <TableCell className="font-medium">
                      {result.canonicalName || (
                        <span className="text-muted-foreground italic">
                          missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{result.quantity ?? '—'}</TableCell>
                    <TableCell>
                      {result.recipeUnitId ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.aisleId === UNCATEGORISED_AISLE.id ? (
                        <span className="text-muted-foreground italic">
                          {result.suggestedAisleName
                            ? `? ${result.suggestedAisleName}`
                            : 'uncategorised'}
                        </span>
                      ) : (
                        result.aisleId
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.preparations.join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.notes.join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      {flags.length === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <div className="flex flex-col gap-1">
                          {flags.map((f, fi) => (
                            <Badge
                              key={fi}
                              variant="destructive"
                              className="text-xs"
                              title={f.message}
                            >
                              {f.code}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};
