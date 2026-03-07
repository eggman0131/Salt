import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, RefreshCcw, Filter, ChevronRight, CheckCircle2, XCircle, AlertCircle, X, Search, BarChart3, TrendingUp } from 'lucide-react';
import { MatchingEvent } from '../../../types/contract';
import { getMatchEvents } from '../../../modules_new/canon/api';
import { getRecipe } from '../../../modules_new/recipes/api';
import { softToast } from '@/lib/soft-toast';

/**
 * Matching Inspector - UI for exploring ingredient matching pipeline results
 * Issue #79: Matching Observability
 */
export const MatchingInspector: React.FC = () => {
  const [events, setEvents] = useState<MatchingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MatchingEvent | null>(null);
  const [recipeNames, setRecipeNames] = useState<Record<string, string>>({});
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const allEvents = await getMatchEvents({ limit: 100 }) as unknown as MatchingEvent[];
      setEvents(allEvents);
      
      // Load recipe titles for all unique recipeIds
      const uniqueRecipeIds = [...new Set(allEvents.map(e => e.recipeId))];
      const names: Record<string, string> = {};
      
      for (const recipeId of uniqueRecipeIds) {
        try {
          const recipe = await getRecipe(recipeId);
          names[recipeId] = recipe.title;
        } catch (err) {
          names[recipeId] = `Recipe ${recipeId.substring(0, 8)}...`;
        }
      }
      
      setRecipeNames(names);
    } catch (error) {
      softToast.error('Failed to load matching events', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Outcome filter
    if (outcomeFilter !== 'all') {
      filtered = filtered.filter(e => e.outcome === outcomeFilter);
    }

    // Search filter (recipe name or ingredient name)
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(e => 
        e.recipeName.toLowerCase().includes(search) ||
        e.ingredientName.toLowerCase().includes(search) ||
        e.raw.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [events, outcomeFilter, searchText]);

  // Compute analytics stats
  const analytics = useMemo(() => {
    const total = filteredEvents.length;
    
    // Stage resolution breakdown
    const fuzzyMatched = filteredEvents.filter(e => e.fuzzy?.matched).length;
    const semanticCaseA = filteredEvents.filter(e => e.semantic?.case === 'A_confident').length;
    const semanticCaseB = filteredEvents.filter(e => e.semantic?.case === 'B_ambiguous').length;
    const semanticCaseC = filteredEvents.filter(e => e.semantic?.case === 'C_weak').length;
    const semanticCaseD = filteredEvents.filter(e => e.semantic?.case === 'D_none').length;
    const arbitrationNeeded = filteredEvents.filter(e => e.arbitration?.needed).length;
    
    // Outcome breakdown
    const outcomeCounts = {
      matched_existing: filteredEvents.filter(e => e.outcome === 'matched_existing').length,
      created_from_cofid: filteredEvents.filter(e => e.outcome === 'created_from_cofid').length,
      ai_generated: filteredEvents.filter(e => e.outcome === 'ai_generated').length,
      unlinked: filteredEvents.filter(e => e.outcome === 'unlinked').length,
    };

    // Weak matches (potential tuning opportunities)
    const weakMatches = filteredEvents.filter(e => {
      const hasCloseScore = e.semantic?.topScore && e.semantic.topScore > 0.75 && e.semantic.topScore < 0.85;
      const hasSmallGap = e.semantic?.scoreGap && e.semantic.scoreGap < 0.05;
      const arbitrationOverruled = e.arbitration?.needed && e.arbitration.decision !== 'use_existing_canon';
      return hasCloseScore || hasSmallGap || arbitrationOverruled;
    });

    return {
      total,
      fuzzyMatched,
      semanticCaseA,
      semanticCaseB,
      semanticCaseC,
      semanticCaseD,
      arbitrationNeeded,
      outcomeCounts,
      weakMatches: weakMatches.length,
      weakMatchEvents: weakMatches,
    };
  }, [filteredEvents]);

  // Group events by runId
  const eventsByRun = filteredEvents.reduce((acc, event) => {
    if (!acc[event.runId]) {
      acc[event.runId] = [];
    }
    acc[event.runId].push(event);
    return acc;
  }, {} as Record<string, MatchingEvent[]>);

  const runIds = Object.keys(eventsByRun).sort((a, b) => {
    const aTime = eventsByRun[a][0]?.timestamp || '';
    const bTime = eventsByRun[b][0]?.timestamp || '';
    return bTime.localeCompare(aTime); // Most recent first
  });

  const getOutcomeBadgeVariant = (outcome: MatchingEvent['outcome']) => {
    switch (outcome) {
      case 'matched_existing':
        return 'default';
      case 'created_from_cofid':
        return 'secondary';
      case 'ai_generated':
        return 'outline';
      case 'unlinked':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getOutcomeLabel = (outcome: MatchingEvent['outcome']) => {
    switch (outcome) {
      case 'matched_existing':
        return '✓ Matched';
      case 'created_from_cofid':
        return '+ CoFID';
      case 'ai_generated':
        return '✨ AI';
      case 'unlinked':
        return '✗ Unlinked';
      default:
        return outcome;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No matching events recorded yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Events will appear here after repairing or importing recipes.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasActiveFilters = outcomeFilter !== 'all' || searchText.trim() !== '';

  const clearFilters = () => {
    setOutcomeFilter('all');
    setSearchText('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Matching Runs</h3>
          <p className="text-sm text-muted-foreground">
            {filteredEvents.length === events.length ? (
              <>{runIds.length} run{runIds.length !== 1 ? 's' : ''} · {events.length} ingredient{events.length !== 1 ? 's' : ''}</>
            ) : (
              <>{runIds.length} run{runIds.length !== 1 ? 's' : ''} · {filteredEvents.length} of {events.length} ingredient{events.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-primary' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                {(outcomeFilter !== 'all' ? 1 : 0) + (searchText.trim() ? 1 : 0)}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadEvents}
            disabled={isLoading}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-primary/20 bg-accent/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Outcome Filter */}
              <div className="space-y-2">
                <Label htmlFor="outcome-filter">Outcome</Label>
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger id="outcome-filter">
                    <SelectValue placeholder="All outcomes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="matched_existing">✓ Matched Existing</SelectItem>
                    <SelectItem value="created_from_cofid">+ Created from CoFID</SelectItem>
                    <SelectItem value="ai_generated">✨ AI Generated</SelectItem>
                    <SelectItem value="unlinked">✗ Unlinked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Filter */}
              <div className="space-y-2">
                <Label htmlFor="search-filter">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-filter"
                    placeholder="Recipe or ingredient name..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchText('')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="mt-4 flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {filteredEvents.length} result{filteredEvents.length !== 1 ? 's' : ''} found
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analytics Section */}
      {filteredEvents.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Pipeline Analytics</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAnalytics(!showAnalytics)}
              >
                {showAnalytics ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>
          {showAnalytics && (
            <CardContent className="space-y-6">
              {/* Stage Funnel */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Stage Resolution Funnel
                </h4>
                <div className="space-y-2">
                  {/* Total */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 text-sm text-muted-foreground">Total Processed</div>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                      <div className="h-full bg-blue-500 flex items-center justify-end pr-3 text-white text-sm font-semibold" style={{ width: '100%' }}>
                        {analytics.total}
                      </div>
                    </div>
                  </div>
                  
                  {/* Fuzzy Matched */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 text-sm text-muted-foreground">Fuzzy Matched</div>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 flex items-center justify-end pr-3 text-white text-sm font-semibold" 
                        style={{ width: `${analytics.total > 0 ? (analytics.fuzzyMatched / analytics.total * 100) : 0}%`, minWidth: analytics.fuzzyMatched > 0 ? '40px' : '0' }}
                      >
                        {analytics.fuzzyMatched > 0 && analytics.fuzzyMatched}
                      </div>
                    </div>
                    <div className="w-16 text-sm text-muted-foreground text-right">
                      {analytics.total > 0 ? Math.round(analytics.fuzzyMatched / analytics.total * 100) : 0}%
                    </div>
                  </div>

                  {/* Semantic Case A */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 text-sm text-muted-foreground">Semantic (A)</div>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                      <div 
                        className="h-full bg-green-500 flex items-center justify-end pr-3 text-white text-sm font-semibold" 
                        style={{ width: `${analytics.total > 0 ? (analytics.semanticCaseA / analytics.total * 100) : 0}%`, minWidth: analytics.semanticCaseA > 0 ? '40px' : '0' }}
                      >
                        {analytics.semanticCaseA > 0 && analytics.semanticCaseA}
                      </div>
                    </div>
                    <div className="w-16 text-sm text-muted-foreground text-right">
                      {analytics.total > 0 ? Math.round(analytics.semanticCaseA / analytics.total * 100) : 0}%
                    </div>
                  </div>

                  {/* Semantic Case B */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 text-sm text-muted-foreground">Semantic (B)</div>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 flex items-center justify-end pr-3 text-white text-sm font-semibold" 
                        style={{ width: `${analytics.total > 0 ? (analytics.semanticCaseB / analytics.total * 100) : 0}%`, minWidth: analytics.semanticCaseB > 0 ? '40px' : '0' }}
                      >
                        {analytics.semanticCaseB > 0 && analytics.semanticCaseB}
                      </div>
                    </div>
                    <div className="w-16 text-sm text-muted-foreground text-right">
                      {analytics.total > 0 ? Math.round(analytics.semanticCaseB / analytics.total * 100) : 0}%
                    </div>
                  </div>

                  {/* Semantic Case C */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 text-sm text-muted-foreground">Semantic (C)</div>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 flex items-center justify-end pr-3 text-white text-sm font-semibold" 
                        style={{ width: `${analytics.total > 0 ? (analytics.semanticCaseC / analytics.total * 100) : 0}%`, minWidth: analytics.semanticCaseC > 0 ? '40px' : '0' }}
                      >
                        {analytics.semanticCaseC > 0 && analytics.semanticCaseC}
                      </div>
                    </div>
                    <div className="w-16 text-sm text-muted-foreground text-right">
                      {analytics.total > 0 ? Math.round(analytics.semanticCaseC / analytics.total * 100) : 0}%
                    </div>
                  </div>

                  {/* Arbitration Needed */}
                  <div className="flex items-center gap-3">
                    <div className="w-32 text-sm text-muted-foreground">Arbitration</div>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                      <div 
                        className="h-full bg-red-500 flex items-center justify-end pr-3 text-white text-sm font-semibold" 
                        style={{ width: `${analytics.total > 0 ? (analytics.arbitrationNeeded / analytics.total * 100) : 0}%`, minWidth: analytics.arbitrationNeeded > 0 ? '40px' : '0' }}
                      >
                        {analytics.arbitrationNeeded > 0 && analytics.arbitrationNeeded}
                      </div>
                    </div>
                    <div className="w-16 text-sm text-muted-foreground text-right">
                      {analytics.total > 0 ? Math.round(analytics.arbitrationNeeded / analytics.total * 100) : 0}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Outcome Breakdown */}
              <div className="space-y-3 pt-3 border-t">
                <h4 className="font-semibold text-sm">Final Outcomes</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{analytics.outcomeCounts.matched_existing}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Matched Existing</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{analytics.outcomeCounts.created_from_cofid}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">From CoFID</div>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{analytics.outcomeCounts.ai_generated}</div>
                    <div className="text-xs text-amber-600 dark:text-amber-400">AI Generated</div>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="text-2xl font-bold text-red-700 dark:text-red-300">{analytics.outcomeCounts.unlinked}</div>
                    <div className="text-xs text-red-600 dark:text-red-400">Unlinked</div>
                  </div>
                </div>
              </div>

              {/* Weak Match Explorer */}
              {analytics.weakMatches > 0 && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      Weak Matches ({analytics.weakMatches})
                    </h4>
                    <p className="text-xs text-muted-foreground">Potential threshold tuning opportunities</p>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {analytics.weakMatchEvents.slice(0, 10).map((event) => (
                      <div
                        key={event.id}
                        className="p-2 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{event.ingredientName}</div>
                            <div className="text-xs text-muted-foreground truncate">{event.raw}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {event.semantic?.topScore && (
                              <Badge variant="outline" className="text-xs">
                                Score: {event.semantic?.topScore?.toFixed(3)}
                              </Badge>
                            )}
                            {event.semantic?.scoreGap !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                Gap: {event.semantic?.scoreGap?.toFixed(3)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {analytics.weakMatches > 10 && (
                      <p className="text-xs text-center text-muted-foreground pt-2">
                        Showing 10 of {analytics.weakMatches} weak matches
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* No Results */}
      {filteredEvents.length === 0 && hasActiveFilters && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No matching events found with current filters.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="mt-4"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Run List */}
      <div className="grid gap-3">
        {runIds.map((runId) => {
          const runEvents = eventsByRun[runId];
          const firstEvent = runEvents[0];
          const timestamp = new Date(firstEvent.timestamp);
          
          const outcomeCounts = runEvents.reduce((acc, e) => {
            acc[e.outcome] = (acc[e.outcome] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <Card
              key={runId}
              className={`cursor-pointer transition-all ${
                selectedRunId === runId
                  ? 'ring-2 ring-primary bg-accent/50'
                  : 'hover:bg-accent/30'
              }`}
              onClick={() => setSelectedRunId(selectedRunId === runId ? null : runId)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold truncate">{recipeNames[firstEvent.recipeId] || firstEvent.recipeName}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timestamp.toLocaleString('en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {outcomeCounts.matched_existing && (
                        <Badge variant="default" className="text-xs">
                          ✓ {outcomeCounts.matched_existing}
                        </Badge>
                      )}
                      {outcomeCounts.created_from_cofid && (
                        <Badge variant="secondary" className="text-xs">
                          + {outcomeCounts.created_from_cofid}
                        </Badge>
                      )}
                      {outcomeCounts.ai_generated && (
                        <Badge variant="outline" className="text-xs">
                          ✨ {outcomeCounts.ai_generated}
                        </Badge>
                      )}
                      {outcomeCounts.unlinked && (
                        <Badge variant="destructive" className="text-xs">
                          ✗ {outcomeCounts.unlinked}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {runEvents.length} item{runEvents.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Expanded detail view */}
                {selectedRunId === runId && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <h5 className="text-sm font-semibold mb-3">Ingredients</h5>
                    <div className="space-y-2">
                      {runEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start justify-between gap-4 p-2 rounded bg-muted/50 text-sm cursor-pointer hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{event.ingredientName}</div>
                            <div className="text-xs text-muted-foreground truncate">{event.raw}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={getOutcomeBadgeVariant(event.outcome)}
                              className="text-xs whitespace-nowrap"
                            >
                              {getOutcomeLabel(event.outcome)}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ItemTrace Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ingredient Matching Journey</DialogTitle>
            <DialogDescription>
              Complete trace of matching pipeline stages for this ingredient
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="space-y-2 pb-4 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedEvent.ingredientName}</h3>
                    <p className="text-sm text-muted-foreground">{selectedEvent.raw}</p>
                  </div>
                  <Badge variant={getOutcomeBadgeVariant(selectedEvent.outcome)}>
                    {getOutcomeLabel(selectedEvent.outcome)}
                  </Badge>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Recipe: {recipeNames[selectedEvent.recipeId] || selectedEvent.recipeName}</span>
                  <span>•</span>
                  <span>Duration: {selectedEvent.durationMs}ms</span>
                  <span>•</span>
                  <span>
                    {new Date(selectedEvent.timestamp).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>

              {/* Stage 1: Parsing */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">1</span>
                  </div>
                  <h4 className="font-semibold">Parsing Stage</h4>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="ml-12 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-muted-foreground">Quantity:</span>{' '}
                      <span className="font-mono">{selectedEvent.parsing.quantity || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unit:</span>{' '}
                      <span className="font-mono">{selectedEvent.parsing.unit || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Item:</span>{' '}
                      <span className="font-mono">{selectedEvent.parsing.item || '-'}</span>
                    </div>
                    {selectedEvent.parsing.qualifiers && selectedEvent.parsing.qualifiers.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Qualifiers:</span>{' '}
                        <span className="font-mono">{selectedEvent.parsing.qualifiers.join(', ')}</span>
                      </div>
                    )}
                    {selectedEvent.parsing.preparation && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Preparation:</span>{' '}
                        <span className="font-mono">{selectedEvent.parsing.preparation}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stage 2: Fuzzy Matching */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">2</span>
                  </div>
                  <h4 className="font-semibold">Fuzzy Matching Stage</h4>
                  {selectedEvent.fuzzy?.matched ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="ml-12 space-y-2 text-sm">
                  {selectedEvent.fuzzy ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                          <span className="text-muted-foreground">Matched:</span>{' '}
                          <span className={selectedEvent.fuzzy.matched ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                            {selectedEvent.fuzzy.matched ? 'Yes' : 'No'}
                          </span>
                        </div>
                        {selectedEvent.fuzzy.score !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Score:</span>{' '}
                            <span className="font-mono">{(selectedEvent.fuzzy.score * 100).toFixed(1)}%</span>
                          </div>
                        )}
                        {selectedEvent.fuzzy.matchedTo && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Matched to:</span>{' '}
                            <span className="font-semibold">{selectedEvent.fuzzy.matchedTo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No fuzzy matching data recorded</p>
                  )}
                </div>
              </div>

              {/* Stage 3: Semantic Search */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">3</span>
                  </div>
                  <h4 className="font-semibold">Semantic Search Stage</h4>
                  {selectedEvent.semantic?.topCandidateName ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="ml-12 space-y-2 text-sm">
                  {selectedEvent.semantic ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {selectedEvent.semantic.topCandidateName && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Top Candidate:</span>{' '}
                            <span className="font-semibold">{selectedEvent.semantic.topCandidateName}</span>
                          </div>
                        )}
                        {selectedEvent.semantic.topScore !== undefined && selectedEvent.semantic.topScore !== null && (
                          <div>
                            <span className="text-muted-foreground">Score:</span>{' '}
                            <span className="font-mono">{selectedEvent.semantic?.topScore?.toFixed(4)}</span>
                          </div>
                        )}
                        {selectedEvent.semantic.scoreGap !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Score Gap:</span>{' '}
                            <span className="font-mono">{selectedEvent.semantic?.scoreGap?.toFixed(4)}</span>
                          </div>
                        )}
                        {selectedEvent.semantic.case && (
                          <div>
                            <span className="text-muted-foreground">Case:</span>{' '}
                            <Badge variant="outline" className="font-mono">{selectedEvent.semantic.case}</Badge>
                          </div>
                        )}
                      </div>
                      
                      {selectedEvent.semantic.allCandidates && selectedEvent.semantic.allCandidates.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-muted-foreground">All Candidates:</span>
                          <div className="space-y-1 pl-4">
                            {selectedEvent.semantic.allCandidates.map((candidate, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                                <span>{candidate.name}</span>
                                <span className="font-mono text-muted-foreground">{candidate.score.toFixed(4)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No semantic search data recorded</p>
                  )}
                </div>
              </div>

              {/* Stage 4: Arbitration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">4</span>
                  </div>
                  <h4 className="font-semibold">Arbitration Stage</h4>
                  {selectedEvent.arbitration?.needed ? (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="ml-12 space-y-2 text-sm">
                  {selectedEvent.arbitration?.needed ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Decision:</span>{' '}
                          <span className="font-semibold">{selectedEvent.arbitration.decision}</span>
                        </div>
                        {selectedEvent.arbitration.confidence !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Confidence:</span>{' '}
                            <span className="font-mono">{selectedEvent.arbitration.confidence}</span>
                          </div>
                        )}
                        {selectedEvent.arbitration.decisionSource && (
                          <div>
                            <span className="text-muted-foreground">Source:</span>{' '}
                            <Badge variant="outline">{selectedEvent.arbitration.decisionSource}</Badge>
                          </div>
                        )}
                        {selectedEvent.arbitration.reason && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Reason:</span>{' '}
                            <p className="mt-1 p-2 bg-muted/50 rounded text-xs">{selectedEvent.arbitration.reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No arbitration needed</p>
                  )}
                </div>
              </div>

              {/* Final Outcome */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-300" />
                  </div>
                  <h4 className="font-semibold">Final Outcome</h4>
                </div>
                <div className="ml-12 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Outcome:</span>{' '}
                      <Badge variant={getOutcomeBadgeVariant(selectedEvent.outcome)}>
                        {getOutcomeLabel(selectedEvent.outcome)}
                      </Badge>
                    </div>
                    {selectedEvent.canonicalItemName && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Canonical Item:</span>{' '}
                        <span className="font-semibold">{selectedEvent.canonicalItemName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
