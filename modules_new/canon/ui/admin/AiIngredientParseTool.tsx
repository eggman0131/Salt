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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCanonAisles,
  getCanonUnits,
  callAiParseIngredients,
  validateAiParseResults,
  buildParseSchemaDescription,
  type ValidatedParseResult,
  UNCATEGORISED_AISLE,
} from '../../api';

type ViewState = 'input' | 'loading' | 'results' | 'error';

interface ParseState {
  view: ViewState;
  error?: string;
  results?: ValidatedParseResult[];
  hasReviewFlags?: boolean;
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

export default function AiIngredientParseTool() {
  const [input, setInput] = useState('');
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
            <Button onClick={handleParse} disabled={state.view === 'loading' || input.trim().length === 0}>
              {state.view === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Parsing...
                </>
              ) : (
                'Parse Ingredients'
              )}
            </Button>
          </div>
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

      {/* Results Section */}
      {state.view === 'results' && state.results && (
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
    </div>
  );
}
