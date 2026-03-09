/**
 * AI Ingredient Parse Tool
 *
 * Admin interface for parsing ingredient lines using AI,
 * validating results, and displaying review flags.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, GitBranch, ChevronDown, ChevronRight, XCircle, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCanonAisles,
  getCanonUnits,
  callAiParseIngredients,
  processRawRecipeIngredients,
  validateAiParseResults,
  type ValidatedParseResult,
  UNCATEGORISED_AISLE,
} from '../../api';
import type { RecipeIngredient } from '../../../../types/contract';

type ViewState = 'input' | 'loading' | 'results' | 'error';
type RunMode = 'parse-only' | 'full-pipeline';

interface PipelineProgress {
  stage: 'parse' | 'match';
  current: number;
  total: number;
}

interface ParseState {
  view: ViewState;
  mode?: RunMode;
  error?: string;
  results?: ValidatedParseResult[];
  pipelineResults?: RecipeIngredient[];
  hasReviewFlags?: boolean;
  progress?: PipelineProgress;
}

/**
 * Color mapping for review flags
 */
function getFlagColor(flag: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (flag) {
    case 'invalid-aisle-id-repaired':
    case 'invalid-unit-id-repaired':
      return 'destructive';
    case 'missing-aisle-suggestion':
    case 'index-mismatch':
    case 'index-duplicate':
    case 'data-repaired':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Human-readable flag label
 */
function getFlagLabel(flag: string): string {
  switch (flag) {
    case 'invalid-aisle-id-repaired':
      return 'Aisle repaired';
    case 'invalid-unit-id-repaired':
      return 'Unit repaired';
    case 'missing-aisle-suggestion':
      return 'Needs aisle suggestion';
    case 'index-mismatch':
      return 'Index mismatch';
    case 'index-duplicate':
      return 'Duplicate index';
    case 'data-repaired':
      return 'Data repaired';
    default:
      return flag;
  }
}

// ── Pipeline Ingredient Card ───────────────────────────────────────────────────

type NearMiss = { name: string; score: number; method: 'exact' | 'fuzzy' | 'semantic' };

function scoreColor(score: number): string {
  if (score >= 0.85) return 'text-green-600 dark:text-green-400';
  if (score >= 0.70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500';
}

function NearMissList({ candidates, label }: { candidates: NearMiss[]; label: string }) {
  if (candidates.length === 0) {
    return (
      <div className="flex items-start gap-2 text-xs">
        <span className="text-muted-foreground w-20 shrink-0 pt-0.5">{label}</span>
        <span className="text-muted-foreground italic">No candidates above threshold</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground w-20 shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-2">
        {candidates.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`font-mono font-medium ${scoreColor(c.score)}`}>
              {(c.score * 100).toFixed(0)}%
            </span>
            <span className="text-foreground">{c.name}</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{c.method}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}

function PipelineIngredientCard({ result }: { result: import('../../../../types/contract').RecipeIngredient }) {
  const [expanded, setExpanded] = useState(false);
  const audit = result.matchingAudit;
  const decision = audit?.decisionAction ?? 'no_match';
  const score = audit?.topScore;
  const nearMisses: NearMiss[] = (audit?.nearMisses ?? []) as NearMiss[];

  const fuzzyMisses = nearMisses.filter(m => m.method !== 'semantic');
  const semanticMisses = nearMisses.filter(m => m.method === 'semantic');

  // Top match name from nearMisses[0] when use_existing_canon
  const topMatchName = decision === 'use_existing_canon' ? nearMisses[0]?.name : undefined;

  function DecisionIcon() {
    if (decision === 'use_existing_canon') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />;
    if (decision === 'create_new_canon') return <PlusCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />;
    return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        }
        <DecisionIcon />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{result.ingredientName}</span>
            {decision === 'use_existing_canon' && topMatchName && (
              <span className="text-xs text-muted-foreground">
                → <span className="font-medium text-foreground">{topMatchName}</span>
              </span>
            )}
            {decision === 'create_new_canon' && (
              <span className="text-xs text-amber-600 dark:text-amber-400">new canon item</span>
            )}
            {decision === 'no_match' && (
              <span className="text-xs text-red-500">unmatched</span>
            )}
          </div>
          {result.raw && result.raw !== result.ingredientName && (
            <p className="text-xs text-muted-foreground truncate">{result.raw}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {typeof score === 'number' && (
            <span className={`text-xs font-mono font-medium ${scoreColor(score)}`}>
              {(score * 100).toFixed(0)}%
            </span>
          )}
          {nearMisses.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {nearMisses.length} candidate{nearMisses.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2.5">
          {/* Parse info */}
          <div className="flex items-start gap-2 text-xs">
            <span className="text-muted-foreground w-20 shrink-0 pt-0.5">Parse</span>
            <div className="flex flex-wrap gap-3 text-foreground">
              {result.quantity != null && (
                <span>
                  <span className="text-muted-foreground">qty </span>
                  <span className="font-mono">{result.quantity}</span>
                </span>
              )}
              {result.unit && (
                <span>
                  <span className="text-muted-foreground">unit </span>
                  <span className="font-mono">{result.unit}</span>
                </span>
              )}
              {result.preparation && (
                <span>
                  <span className="text-muted-foreground">prep </span>
                  <span className="font-mono">{result.preparation}</span>
                </span>
              )}
            </div>
          </div>

          {/* Lexical candidates */}
          <NearMissList candidates={fuzzyMisses} label="Lexical" />

          {/* Semantic candidates */}
          {nearMisses.length === 0 && fuzzyMisses.length === 0 ? (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground w-20 shrink-0">Semantic</span>
              <span className="text-muted-foreground italic">
                {result.embedding ? 'No candidates above threshold' : 'No embedding available for query'}
              </span>
            </div>
          ) : (
            <NearMissList candidates={semanticMisses} label="Semantic" />
          )}

          {/* Decision reason */}
          {audit?.reason && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground w-20 shrink-0 pt-0.5">Decision</span>
              <span className="text-foreground">{audit.reason}</span>
            </div>
          )}

          {/* Stage */}
          {audit?.stage && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground w-20 shrink-0">Stage</span>
              <span className="font-mono text-muted-foreground">{audit.stage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiIngredientParseTool() {
  const [input, setInput] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [state, setState] = useState<ParseState>({ view: 'input' });

  const handleParse = async () => {
    // Validate input
    const lines = input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      toast.error('Please enter at least one ingredient line');
      return;
    }

    setState({ view: 'loading' });

    try {
      // Fetch canonical data
      const aisles = await getCanonAisles();
      const units = await getCanonUnits();

      if (!aisles || aisles.length === 0) {
        toast.error('Canon aisles not found. Please seed data first.');
        setState({ view: 'error', error: 'Canon aisles collection is empty' });
        return;
      }

      if (!units || units.length === 0) {
        toast.error('Canon units not found. Please seed data first.');
        setState({ view: 'error', error: 'Canon units collection is empty' });
        return;
      }

      // Build descriptions for AI
      const aisleDescriptions = Object.fromEntries(aisles.map(a => [a.id, a.name]));
      const unitDescriptions = Object.fromEntries(units.map(u => [u.id, u.name]));

      // Call AI parse
      const parseResult = await callAiParseIngredients(lines, aisleDescriptions, unitDescriptions);

      if (!parseResult.success || !parseResult.data) {
        toast.error('AI parse failed: ' + (parseResult.error || 'Unknown error'));
        setState({ view: 'error', error: parseResult.error || 'Unknown error' });
        return;
      }

      // Validate and repair
      const validatedResult = validateAiParseResults(
        parseResult.data,
        aisles.map(a => a.id),
        units.map(u => u.id)
      );

      if (validatedResult.hasErrors) {
        toast.error('Parse validation failed: ' + (validatedResult.errors?.[0] || 'Unknown error'));
        setState({ view: 'error', error: validatedResult.errors?.[0] || 'Unknown error' });
        return;
      }

      // Success
      if (validatedResult.hasReviewFlags) {
        toast.info(`Parsed ${validatedResult.results.length} items with review flags`);
      } else {
        toast.success(`Parsed ${validatedResult.results.length} items successfully`);
      }

      setState({
        view: 'results',
        results: validatedResult.results,
        hasReviewFlags: validatedResult.hasReviewFlags,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Error: ' + message);
      setState({ view: 'error', error: message });
    }
  };

  const handleRunPipeline = async () => {
    const lines = input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      toast.error('Please enter at least one ingredient line');
      return;
    }

    setState({
      view: 'loading',
      mode: 'full-pipeline',
      progress: { stage: 'parse', current: 0, total: lines.length },
    });

    try {
      const ingredients = await processRawRecipeIngredients(
        lines,
        progress => {
          setState(prev => ({
            ...prev,
            view: 'loading',
            mode: 'full-pipeline',
            progress,
          }));
        },
        { dryRun }
      );

      const linkedCount = ingredients.filter(ing => !!ing.canonicalItemId).length;
      const newCanonCount = ingredients.filter(
        ing => ing.matchingAudit?.decisionAction === 'create_new_canon'
      ).length;

      if (dryRun) {
        toast.success(
          `Dry run complete: ${linkedCount}/${ingredients.length} would link, ${newCanonCount} would create new canon item${newCanonCount === 1 ? '' : 's'}`
        );
      } else {
        toast.success(
          `Pipeline complete: ${linkedCount}/${ingredients.length} linked, ${newCanonCount} new canon item${newCanonCount === 1 ? '' : 's'} created`
        );
      }

      setState({
        view: 'results',
        mode: 'full-pipeline',
        pipelineResults: ingredients,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Pipeline failed: ' + message);
      setState({ view: 'error', mode: 'full-pipeline', error: message });
    }
  };

  const handleReset = () => {
    setInput('');
    setState({ view: 'input' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">AI Ingredient Parser</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Parse ingredient lines using AI and validate against canonical data
        </p>
      </div>

      {/* Input Section */}
      {state.view === 'input' || state.view === 'loading' ? (
        <Card className="p-6 space-y-4">
          <div>
            <Label className="text-base font-medium">Ingredient Lines</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Enter one ingredient per line (e.g., 200g chicken, 1 tbsp olive oil, etc.)
            </p>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="200g chicken breast, diced&#10;1 tbsp olive oil&#10;2 cloves garlic, minced"
              className="font-mono text-sm min-h-32"
              disabled={state.view === 'loading'}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset} disabled={state.view === 'loading'}>
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={handleParse}
              disabled={state.view === 'loading' || input.trim().length === 0}
            >
              {state.view === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {state.mode === 'full-pipeline' ? 'Running pipeline...' : 'Parsing...'}
                </>
              ) : (
                'Parse Ingredients'
              )}
            </Button>
            <Button
              onClick={handleRunPipeline}
              disabled={state.view === 'loading' || input.trim().length === 0}
            >
              {state.view === 'loading' && state.mode === 'full-pipeline' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running Pipeline...
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Run Full Pipeline
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Dry run</p>
              <p className="text-xs text-muted-foreground">Show full matching decisions without creating new canon items</p>
            </div>
            <Checkbox
              checked={dryRun}
              onCheckedChange={(checked) => setDryRun(Boolean(checked))}
              disabled={state.view === 'loading'}
              aria-label="Toggle dry run mode"
            />
          </div>

          {state.view === 'loading' && state.mode === 'full-pipeline' && state.progress && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {state.progress.stage === 'parse' ? 'Parsing ingredients' : 'Matching and linking'}
              </p>
              <p className="text-muted-foreground mt-1">
                {state.progress.current}/{state.progress.total} completed
              </p>
            </div>
          )}
        </Card>
      ) : null}

      {/* Error State */}
      {state.view === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Parse Failed</p>
            <p className="text-sm">{state.error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="mt-3"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Parse-only Results Section */}
      {state.view === 'results' && state.mode !== 'full-pipeline' && state.results && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium">
                  {state.results.length} ingredient{state.results.length !== 1 ? 's' : ''} parsed
                </p>
                {state.hasReviewFlags && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Some items have review flags
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={handleReset}>
              Parse Again
            </Button>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Item</th>
                  <th className="text-left py-2 px-3 font-medium">Quantity</th>
                  <th className="text-left py-2 px-3 font-medium">Unit</th>
                  <th className="text-left py-2 px-3 font-medium">Aisle</th>
                  <th className="text-left py-2 px-3 font-medium">Notes</th>
                  <th className="text-left py-2 px-3 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {state.results.map((result, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-medium">{result.itemName}</div>
                      <div className="text-xs text-muted-foreground">
                        {result.preparations.length > 0 && (
                          <span>{result.preparations.join(', ')}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">{result.quantity ?? '—'}</td>
                    <td className="py-3 px-3">{result.recipeUnitId ?? '—'}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium">
                        {result.aisleId === UNCATEGORISED_AISLE.id ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {UNCATEGORISED_AISLE.name}
                          </span>
                        ) : (
                          result.aisleId
                        )}
                      </div>
                      {result.suggestedAisleName && (
                        <div className="text-xs text-muted-foreground">
                          Suggested: {result.suggestedAisleName}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {result.notes.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {result.notes.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {result.reviewFlags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.reviewFlags.map((flag, j) => (
                            <Badge key={j} variant={getFlagColor(flag)} className="text-xs">
                              {getFlagLabel(flag)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Review Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Review Required Items</p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>
                  <strong>Aisle repaired:</strong> Invalid aisle ID was corrected to "Uncategorised"
                </li>
                <li>
                  <strong>Unit repaired:</strong> Invalid unit was removed
                </li>
                <li>
                  <strong>Needs aisle suggestion:</strong> Item is categorised as "Uncategorised" — please suggest a better aisle
                </li>
                <li>
                  <strong>Data repaired:</strong> Missing or invalid fields were corrected
                </li>
              </ul>
            </AlertDescription>
          </Alert>
        </>
      )}

      {/* Full Pipeline Results */}
      {state.view === 'results' && state.mode === 'full-pipeline' && state.pipelineResults && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium">
                  {state.pipelineResults.length} ingredient{state.pipelineResults.length !== 1 ? 's' : ''} processed through full pipeline
                </p>
                <p className="text-sm text-muted-foreground">
                  {state.pipelineResults.filter(i => i.canonicalItemId).length} linked • {state.pipelineResults.filter(i => i.matchingAudit?.decisionAction === 'create_new_canon').length} {dryRun ? 'would create new canon items' : 'new canon items created'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dryRun ? 'Dry run mode was enabled: no new canon items were created.' : 'Live mode: pipeline created canon items where needed.'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleReset}>
              Run Again
            </Button>
          </div>

          <div className="space-y-1">
            {state.pipelineResults.map((result) => (
              <PipelineIngredientCard key={result.id} result={result} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
