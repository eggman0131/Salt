import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, RefreshCcw, Check, X, ChevronDown, ChevronUp, Save, Download, Copy, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { IngredientParsingLog } from '../../../types/contract';
import { softToast } from '@/lib/soft-toast';
import { db } from '../../../shared/backend/firebase';
import { collection, query, orderBy, limit, getDocs, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';

/**
 * Ingredient Parser Tester - Test ingredient parsing through the full pipeline
 * Allows admins to inject ingredient strings and see results from Firestore logs
 */
export const IngredientParserTester: React.FC = () => {
  const [textarea, setTextarea] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<IngredientParsingLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [showIncorrectOnly, setShowIncorrectOnly] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [corrections, setCorrections] = useState<Record<string, Partial<IngredientParsingLog>>>({});
  const [isSavingId, setIsSavingId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load logs on mount and when component focuses
  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 2000); // Poll every 2s for new logs
    return () => clearInterval(interval);
  }, []);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logsRef = collection(db, 'ingredient_parsing_logs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as IngredientParsingLog));
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };


  const testAllIngredients = async () => {
    const lines = textarea
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      softToast.error('No ingredients', {
        description: 'Please paste ingredient strings (one per line)',
      });
      return;
    }

    setIsLoading(true);
    try {
      // testParseIngredient was removed during canon migration — pending admin module migration
      softToast.error('Unavailable', { description: 'Ingredient parser test is unavailable until admin module migration is complete.' });
      return;
      softToast.success('All ingredients tested', {
        description: `Processed ${lines.length} ingredients`,
      });
      // Reload logs after a short delay
      setTimeout(() => loadLogs(), 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      softToast.error('Batch test failed', {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCorrectness = async (logId: string, isCorrect: boolean) => {
    setIsSavingId(logId);
    try {
      const logRef = doc(db, 'ingredient_parsing_logs', logId);
      await updateDoc(logRef, {
        correct: isCorrect,
        correctedAt: new Date().toISOString(),
      });
      // Update local state
      setLogs(logs.map(log => 
        log.id === logId ? { ...log, correct: isCorrect, correctedAt: new Date().toISOString() } : log
      ));
      softToast.success(isCorrect ? 'Marked correct' : 'Marked incorrect');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      softToast.error('Failed to update', { description: message });
    } finally {
      setIsSavingId(null);
    }
  };

  const toggleExpandedRow = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  const updateCorrection = (logId: string, field: string, value: string | string[] | number | null) => {
    setCorrections(prev => ({
      ...prev,
      [logId]: {
        ...prev[logId],
        [field]: value,
      },
    }));
  };

  const saveCorrections = async (logId: string) => {
    const correction = corrections[logId];
    if (!correction || Object.keys(correction).length === 0) {
      softToast.error('No corrections', { description: 'Edit at least one field' });
      return;
    }

    setIsSavingId(logId);
    try {
      const logRef = doc(db, 'ingredient_parsing_logs', logId);
      await updateDoc(logRef, {
        ...correction,
        correctedAt: new Date().toISOString(),
      });
      // Update local state
      setLogs(logs.map(log => 
        log.id === logId ? { ...log, ...correction, correctedAt: new Date().toISOString() } : log
      ));
      // Clear corrections for this log
      setCorrections(prev => {
        const newCorrections = { ...prev };
        delete newCorrections[logId];
        return newCorrections;
      });
      softToast.success('Corrections saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      softToast.error('Failed to save', { description: message });
    } finally {
      setIsSavingId(null);
    }
  };

  const deleteAllLogs = async () => {
    setIsDeleting(true);
    try {
      const logsRef = collection(db, 'ingredient_parsing_logs');
      const q = query(logsRef);
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        softToast.info('No logs to delete', { description: 'Database is already empty' });
        setShowDeleteConfirm(false);
        return;
      }

      // Delete in batches of 500 (Firestore batch limit)
      const batch = writeBatch(db);
      let count = 0;
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });

      await batch.commit();
      setLogs([]);
      softToast.success('All logs deleted', { description: `Deleted ${count} parsing records` });
      setShowDeleteConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      softToast.error('Failed to delete logs', { description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredLogs = showIncorrectOnly ? logs.filter(log => !log.correct) : logs;

  const generateJSON = () => {
    const exportData = filteredLogs.map(log => ({
      raw: log.raw,
      parsed: {
        quantity: log.quantity,
        unit: log.unit,
        ingredientName: log.ingredientName,
        preparation: log.preparation,
        qualifiers: log.qualifiers,
      },
      corrected: log.correctedQuantity !== undefined || log.correctedUnit !== undefined || log.correctedIngredientName !== undefined ? {
        quantity: log.correctedQuantity,
        unit: log.correctedUnit,
        ingredientName: log.correctedIngredientName,
        preparation: log.correctedPreparation,
        qualifiers: log.correctedQualifiers,
      } : null,
      isCorrect: log.correct,
      correctedAt: log.correctedAt,
    }));
    return JSON.stringify(exportData, null, 2);
  };

  const generateMarkdown = () => {
    let md = '# Ingredient Parsing Results\n\n';
    
    filteredLogs.forEach(log => {
      md += `## Raw: ${log.raw}\n\n`;
      md += `### Parsed\n`;
      md += `- Quantity: ${log.quantity ?? '—'}\n`;
      md += `- Unit: ${log.unit || '—'}\n`;
      md += `- Name: ${log.ingredientName || '—'}\n`;
      md += `- Preparation: ${log.preparation || '—'}\n`;
      md += `- Qualifiers: ${log.qualifiers?.join(', ') || '—'}\n`;
      
      if (log.correctedQuantity !== undefined || log.correctedUnit !== undefined || log.correctedIngredientName !== undefined) {
        md += `\n### Corrected\n`;
        md += `- Quantity: ${log.correctedQuantity !== undefined ? log.correctedQuantity : log.quantity ?? '—'}\n`;
        md += `- Unit: ${log.correctedUnit !== undefined ? log.correctedUnit : log.unit || '—'}\n`;
        md += `- Name: ${log.correctedIngredientName !== undefined ? log.correctedIngredientName : log.ingredientName || '—'}\n`;
        md += `- Preparation: ${log.correctedPreparation !== undefined ? log.correctedPreparation : log.preparation || '—'}\n`;
        md += `- Qualifiers: ${(log.correctedQualifiers ?? []).join(', ') || '—'}\n`;
      }
      
      md += `\n---\n\n`;
    });

    return md;
  };

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      softToast.success(`${format} copied to clipboard`);
    } catch (error) {
      softToast.error('Failed to copy', { description: 'Check browser permissions' });
    }
  };

  const downloadFile = (text: string, filename: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const parsingCode = `// Parsing code from BaseCanonBackend
// This is the algorithm used to extract quantity, unit, name, preparation, and qualifiers

private normaliseIngredientString(raw: string): string {
  let text = raw
    .replace(/½/g, '1/2')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/⅓/g, '1/3')
    .replace(/⅔/g, '2/3')
    .replace(/×/g, 'x')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();
  return text;
}

private getPreparationTerms(): Set<string> {
  return new Set([
    'chopped', 'diced', 'minced', 'sliced', 'crushed', 'grated',
    'peeled', 'trimmed', 'torn', 'drained', 'finely', 'coarsely',
    'roughly', 'thinly', 'thickly', 'cubed', 'shredded', 'julienned',
    'blanched', 'roasted', 'toasted', 'caramelised', 'melted', 'whipped',
    'beaten', 'whisked', 'folded', 'sifted', 'strained', 'filtered',
    'pressed', 'zested', 'deveined', 'pitted', 'cored', 'deseeded',
    'boned', 'flaked', 'crumbled', 'scattered', 'dusted', 'rinsed',
    'patted', 'and', 'of', 'for', 'on', 'in', 'with', 'to'
  ]);
}

private parseQuantity(quantityStr: string): number | null {
  quantityStr = quantityStr.trim();
  
  // Mixed fraction: "1 1/2"
  const mixedMatch = quantityStr.match(/^(\\d+)\\s+(\\d+)\\/(\\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    return whole + numerator / denominator;
  }
  
  // Multiplier: "4 x 240"
  const multiplierMatch = quantityStr.match(/^(\\d+\\.?\\d*)\\s*x\\s*(\\d+\\.?\\d*)/);
  if (multiplierMatch) {
    return parseFloat(multiplierMatch[1]) * parseFloat(multiplierMatch[2]);
  }
  
  // Range: "2-3"
  const rangeMatch = quantityStr.match(/^(\\d+\\.?\\d*)\\s*-\\s*(\\d+\\.?\\d*)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return (min + max) / 2;
  }
  
  // Fraction: "1/2"
  const fractionMatch = quantityStr.match(/^(\\d+)\\/(\\d+)$/);
  if (fractionMatch) {
    return parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
  }
  
  // Simple: "100" or "100.5"
  const simpleMatch = quantityStr.match(/^(\\d+\\.?\\d*)$/);
  if (simpleMatch) {
    return parseFloat(simpleMatch[1]);
  }
  
  return null;
}

private parseIngredientEnhanced(raw: string, units: Unit[]): ParsedIngredientInternal {
  let text = this.normaliseIngredientString(raw);
  
  // Build unit pattern from available units
  const unitNames = units.length > 0 
    ? units.flatMap(u => [u.name, u.plural].filter((n) => n))
    : ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'clove', 'slice', 'tin', 'can', 'jar', 'pack'];
  
  const unitPattern = unitNames.join('|');
  const quantityRegex = new RegExp(
    \`^(\\\\d+\\\\s+\\\\d+\\\\/\\\\d+|\\\\d+\\\\s*-\\\\s*\\\\d+|(?:\\\\d+\\\\s*x\\\\s*)?\\\\d+\\\\.?\\\\d*|\\\\d*\\\\.\\\\d+|\\\\d+\\\\s*/\\\\s*\\\\d+)\\\\s*(\${unitPattern})?\\\\s+(.+)$\`
  );
  
  let quantityRaw: string | null = null;
  let quantityValue: number | null = null;
  let unit: string | null = null;
  
  const quantityMatch = text.match(quantityRegex);
  if (quantityMatch) {
    quantityRaw = quantityMatch[1].trim();
    unit = quantityMatch[2] || null;
    text = quantityMatch[3].trim();
    quantityValue = this.parseQuantity(quantityRaw);
  }
  
  let qualifiers: string[] = [];
  let preparation: string | null = null;
  
  // Extract parenthetical notes
  const parenRegex = /\\(([^)]+)\\)/g;
  let parenMatch;
  while ((parenMatch = parenRegex.exec(text)) !== null) {
    qualifiers.push(parenMatch[1].trim());
    text = text.replace(\`(\${parenMatch[1]})\`, '').trim();
  }
  
  // Find preparation terms
  const prepTerms = this.getPreparationTerms();
  const tokens = text.split(/\\s+/);
  let prepStartIdx = -1;
  
  for (let i = 0; i < tokens.length; i++) {
    if (prepTerms.has(tokens[i])) {
      prepStartIdx = i;
      break;
    }
  }
  
  if (prepStartIdx > 0) {
    const itemTokens = tokens.slice(0, prepStartIdx);
    const prepTokens = tokens.slice(prepStartIdx);
    preparation = prepTokens.join(' ');
    
    // Extract adjectives before item
    const adjectives = new Set(['fresh', 'dried', 'raw', 'cooked', 'extra', 'virgin']);
    let adjectiveIdx = 0;
    for (let i = 0; i < itemTokens.length; i++) {
      if (adjectives.has(itemTokens[i])) {
        qualifiers.unshift(itemTokens[i]);
        adjectiveIdx = i + 1;
      } else {
        break;
      }
    }
    
    const item = itemTokens.slice(adjectiveIdx).join(' ').trim() || 'unknown';
    return { quantityRaw, quantityValue, unit, item, qualifiers, preparation };
  }
  
  // No prep signal; extract adjectives at start
  const adjectives = new Set(['fresh', 'dried', 'raw', 'cooked', 'extra', 'virgin']);
  let adjectiveIdx = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (adjectives.has(tokens[i])) {
      qualifiers.push(tokens[i]);
      adjectiveIdx = i + 1;
    } else {
      break;
    }
  }
  
  const item = tokens.slice(adjectiveIdx).join(' ').trim() || text;
  return { quantityRaw, quantityValue, unit, item, qualifiers, preparation };
}`;

  const clearAllLogs = async () => {
    // Note: clearing would require a backend function to delete docs
    // For now, just acknowledge - logs persist in DB which is intended
    softToast.info('Logs persist in Firestore', {
      description: 'All parsing tests are permanently recorded',
    });
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-4 md:p-6 border-b">
        <div className="space-y-1">
          <CardTitle className="text-xl md:text-2xl">Ingredient Parser Tester</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test ingredient string parsing. All results persist in Firestore.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Ingredient Strings (one per line)</Label>
          <Textarea
            placeholder="400 g tomatoes, diced&#10;2 large red onions, sliced&#10;500 ml 2% milk&#10;3 garlic cloves, minced"
            value={textarea}
            onChange={(e) => setTextarea(e.target.value)}
            disabled={isLoading}
            className="font-mono text-sm h-32"
          />

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={testAllIngredients}
              disabled={!textarea.trim() || isLoading}
              size="sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Test all
                </>
              )}
            </Button>
            <Button
              onClick={() => setTextarea(`a splash of soy sauce
two handfuls of baby spinach
juice of 2 lemons
zest of unwaxed lemon
500 ml 2% milk
400 g tomatoes, diced
3 garlic cloves, finely minced
225 g butter, melted and cooled
(optional) fresh basil, chopped
level tbsp olive oil`)}
              variant="outline"
              size="sm"
            >
              Load test cases
            </Button>
            <Button
              onClick={loadLogs}
              disabled={isLoadingLogs}
              variant="outline"
              size="sm"
              className="ml-auto"
            >
              <RefreshCcw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Results Section (from Firestore) */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">
              Recent Parser Results {filteredLogs.length > 0 && `(${filteredLogs.length})`}
            </Label>
            <div className="flex gap-2">
              <Button
                variant={showIncorrectOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowIncorrectOnly(!showIncorrectOnly)}
              >
                {showIncorrectOnly ? 'Show All' : 'Show Incorrect Only'}
              </Button>
              {filteredLogs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportModal(true)}
                  className="gap-1"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              )}
              {logs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isDeleting}
                >
                  <Trash2 className="w-4 h-4" />
                  Clear all
                </Button>
              )}
            </div>
          </div>
          
          {filteredLogs.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-center font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap w-8">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Time
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Raw Input
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Unit
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Prep
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Qualifiers
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap w-8">
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log, index) => {
                      const draftCorrection = corrections[log.id];
                      const correctedQualifiers = Array.isArray(log.correctedQualifiers)
                        ? log.correctedQualifiers
                        : [];
                      const hasSavedCorrection =
                        log.correctedQuantity !== undefined ||
                        log.correctedUnit !== undefined ||
                        log.correctedIngredientName !== undefined ||
                        log.correctedPreparation !== undefined ||
                        log.correctedQualifiers !== undefined;

                      return (
                      <React.Fragment key={log.id}>
                        <tr 
                          className={`border-b hover:bg-muted/30 ${index % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-muted/20'}`}
                        >
                          <td className="px-3 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-6 w-6 p-0 ${log.correct ? 'text-green-600 bg-green-100 hover:bg-green-200' : 'text-destructive bg-destructive/10 hover:bg-destructive/20'}`}
                                onClick={() => toggleCorrectness(log.id, !log.correct)}
                                disabled={isSavingId !== null}
                              >
                                {log.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString('en-GB', { 
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-foreground max-w-xs truncate">
                            {log.raw}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {log.quantity !== null ? log.quantity : '—'}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {log.unit || '—'}
                          </td>
                          <td className="px-3 py-2 text-foreground font-semibold">
                            {log.ingredientName || '—'}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {log.preparation || '—'}
                          </td>
                          <td className="px-3 py-2">
                            {log.qualifiers && log.qualifiers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {log.qualifiers.map((q, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {q}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {!log.correct && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleExpandedRow(log.id)}
                              >
                                {expandedRows.has(log.id) ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {hasSavedCorrection && (
                          <tr className={`border-b bg-green-50/60 dark:bg-green-900/10 ${index % 2 === 0 ? 'hover:bg-green-50/80 dark:hover:bg-green-900/20' : 'hover:bg-green-50/80 dark:hover:bg-green-900/20'}`}>
                            <td className="px-3 py-2 text-center">
                              <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                                Corrected
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                              {log.correctedAt
                                ? new Date(log.correctedAt).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })
                                : '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-foreground max-w-xs truncate">
                              {log.raw}
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              {log.correctedQuantity !== null && log.correctedQuantity !== undefined ? log.correctedQuantity : '—'}
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              {log.correctedUnit || '—'}
                            </td>
                            <td className="px-3 py-2 text-foreground font-semibold">
                              {log.correctedIngredientName || '—'}
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              {log.correctedPreparation || '—'}
                            </td>
                            <td className="px-3 py-2">
                              {correctedQualifiers.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {correctedQualifiers.map((q, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                                      {q}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {!log.correct && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleExpandedRow(log.id)}
                                >
                                  {expandedRows.has(log.id) ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        )}

                        {expandedRows.has(log.id) && !log.correct && (
                          <tr className={`border-b ${index % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-muted/20'}`}>
                            <td colSpan={9} className="px-6 py-4">
                              <div className="bg-blue/5 border border-blue/20 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-foreground">Enter corrections</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Quantity</Label>
                                    <Input
                                      type="number"
                                      placeholder={log.quantity !== null ? String(log.quantity) : 'Enter qty'}
                                      value={
                                        draftCorrection?.correctedQuantity ??
                                        log.correctedQuantity ??
                                        log.quantity ??
                                        ''
                                      }
                                      onChange={(e) => updateCorrection(log.id, 'correctedQuantity', e.target.value ? Number(e.target.value) : null)}
                                      className="text-xs h-8"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Unit</Label>
                                    <Input
                                      placeholder={log.unit || 'Enter unit'}
                                      value={
                                        draftCorrection?.correctedUnit ??
                                        log.correctedUnit ??
                                        log.unit ??
                                        ''
                                      }
                                      onChange={(e) => updateCorrection(log.id, 'correctedUnit', e.target.value || null)}
                                      className="text-xs h-8"
                                    />
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <Label className="text-xs">Ingredient Name</Label>
                                    <Input
                                      placeholder={log.ingredientName || 'Enter name'}
                                      value={
                                        draftCorrection?.correctedIngredientName ??
                                        log.correctedIngredientName ??
                                        log.ingredientName ??
                                        ''
                                      }
                                      onChange={(e) => updateCorrection(log.id, 'correctedIngredientName', e.target.value || null)}
                                      className="text-xs h-8"
                                    />
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <Label className="text-xs">Preparation</Label>
                                    <Input
                                      placeholder={log.preparation || 'Enter prep'}
                                      value={
                                        draftCorrection?.correctedPreparation ??
                                        log.correctedPreparation ??
                                        log.preparation ??
                                        ''
                                      }
                                      onChange={(e) => updateCorrection(log.id, 'correctedPreparation', e.target.value || null)}
                                      className="text-xs h-8"
                                    />
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <Label className="text-xs">Qualifiers (comma-separated)</Label>
                                    <Input
                                      placeholder={log.qualifiers?.join(', ') || 'Enter qualifiers'}
                                      value={Array.isArray(draftCorrection?.correctedQualifiers)
                                        ? draftCorrection.correctedQualifiers.join(', ')
                                        : (correctedQualifiers.length > 0
                                          ? correctedQualifiers.join(', ')
                                          : (log.qualifiers ?? []).join(', '))}
                                      onChange={(e) => updateCorrection(log.id, 'correctedQualifiers', e.target.value ? e.target.value.split(',').map(q => q.trim()) : [])}
                                      className="text-xs h-8"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => saveCorrections(log.id)}
                                    disabled={isSavingId === log.id || !corrections[log.id] || Object.keys(corrections[log.id]).length === 0}
                                    className="gap-1"
                                  >
                                    <Save className="w-4 h-4" />
                                    Save corrections
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleExpandedRow(log.id)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );})}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-blue/5 border border-blue/20 rounded-lg text-sm text-muted-foreground">
              <p>
                {showIncorrectOnly 
                  ? 'All test results are marked correct! 🎉' 
                  : 'No parsing history yet. Test an ingredient to see results.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Parsing Code Section */}
        <div className="space-y-4 pt-6 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Parsing Algorithm</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(parsingCode, 'Parsing code')}
                className="gap-1"
              >
                <Copy className="w-4 h-4" />
                Copy code
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadFile(parsingCode, 'ingredient-parsing-algorithm.ts')}
                className="gap-1"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This is the actual parsing code used to extract quantity, unit, name, preparation, and qualifiers
          </p>
          <div className="bg-muted p-4 rounded-lg overflow-auto max-h-96 border">
            <pre className="font-mono text-xs">{parsingCode}</pre>
          </div>
        </div>

        {/* Export Modal */}
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Export Results</DialogTitle>
              <DialogDescription>
                Choose a format and action to share with AI or save locally
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* JSON Export */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">JSON Format</h3>
                <p className="text-xs text-muted-foreground">Structured format suitable for machine learning</p>
                <div className="bg-muted p-3 rounded-lg max-h-48 overflow-y-auto font-mono text-xs">
                  <pre>{generateJSON()}</pre>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generateJSON(), 'JSON')}
                    className="gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Copy JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFile(generateJSON(), 'ingredient-parsing-results.json')}
                    className="gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Download JSON
                  </Button>
                </div>
              </div>

              {/* Markdown Export */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Markdown Format</h3>
                <p className="text-xs text-muted-foreground">Human-readable format for chat interfaces</p>
                <div className="bg-muted p-3 rounded-lg max-h-48 overflow-y-auto font-mono text-xs">
                  <pre>{generateMarkdown()}</pre>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generateMarkdown(), 'Markdown')}
                    className="gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Markdown
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFile(generateMarkdown(), 'ingredient-parsing-results.md')}
                    className="gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Download Markdown
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all parsing data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {logs.length} ingredient parsing records from Firestore.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3">
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAllLogs()}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete all logs'
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
