/**
 * Matching Performance Admin — Pipeline Analytics & Event Monitoring
 *
 * Comprehensive performance monitoring for the CofID matching pipeline.
 *
 * Features:
 * - Real-time event log with filtering (date, type, entity)
 * - Performance statistics dashboard (avg duration, success rate)
 * - Visual charts (event volume, duration distribution, success trends)
 * - Machine-readable export for ML/AI analysis
 * - Human-readable tooltips and formatting for troubleshooting
 *
 * All data flows through api.ts only — no direct imports from logic or data.
 * Uses Salt design primitives for responsive, consistent layout.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  getMatchEvents,
  getPerformanceStats,
} from '../../api';
import type { CanonMatchEvent } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Calendar, Filter, TrendingUp, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminRefresh } from '@/shared/providers';
import { Page, Section, Stack } from '@/shared/components/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Type Definitions ──────────────────────────────────────────────────────────

interface PerformanceStats {
  totalEvents: number;
  eventsByType: Record<CanonMatchEvent['eventType'], number>;
  avgDurationByType: Record<CanonMatchEvent['eventType'], number>;
  successRate: number;
  totalDuration: number;
}

// ── Main Component ────────────────────────────────────────────────────────────

export const MatchingPerformanceAdmin: React.FC = () => {
  const { refreshTrigger } = useAdminRefresh();
  const [events, setEvents] = useState<CanonMatchEvent[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<CanonMatchEvent['eventType'] | 'all'>('all');
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ── Data Loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'all':
          startDate.setFullYear(2020); // Far enough back
          break;
      }

      // Fetch events
      const eventsData = await getMatchEvents({
        eventType: eventTypeFilter === 'all' ? undefined : eventTypeFilter,
        startDate,
        endDate,
        limit: 500,
      });

      // Fetch stats
      const statsData = await getPerformanceStats(startDate, endDate);

      setEvents(eventsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger, eventTypeFilter, dateRange]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return events;
    const lower = searchTerm.toLowerCase();
    return events.filter(event =>
      event.entityName.toLowerCase().includes(lower) ||
      event.entityId.toLowerCase().includes(lower) ||
      event.output.topMatchName?.toLowerCase().includes(lower)
    );
  }, [events, searchTerm]);

  // ── Export to CSV ─────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = [
      'Timestamp',
      'Event Type',
      'Entity Name',
      'Entity ID',
      'Aisle ID',
      'Duration (ms)',
      'Top Score',
      'Top Match Name',
      'Method',
      'Result Count',
      'Batch ID',
      'Batch Size',
    ];

    const rows = filteredEvents.map(event => [
      event.timestamp,
      event.eventType,
      event.entityName,
      event.entityId,
      event.aisleId || '',
      event.metrics.durationMs.toString(),
      event.output.topScore?.toFixed(3) || '',
      event.output.topMatchName || '',
      event.output.method || '',
      event.output.resultCount?.toString() || '',
      event.metrics.batchId || '',
      event.metrics.batchSize?.toString() || '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matching-performance-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Performance data exported');
  };

  if (isLoading) {
    return (
      <Page>
        <Section>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Section>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Section>
          <h1 className="text-2xl font-bold text-foreground">Matching Performance</h1>
          <div className="text-destructive">{error}</div>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      {/* Header Section */}
      <Section spacing="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Matching Performance</h1>
            <p className="text-sm text-muted-foreground mt-2">
              CofID matching pipeline analytics and event monitoring
            </p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" size="lg">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Section>

      {/* Statistics Dashboard */}
      {stats && (
        <Section>
          <h2 className="text-lg font-semibold mb-4">Performance Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Total Events"
              value={stats.totalEvents.toLocaleString()}
              color="text-primary"
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Avg Duration"
              value={`${(stats.totalDuration / stats.totalEvents || 0).toFixed(0)}ms`}
              color="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Success Rate"
              value={`${(stats.successRate * 100).toFixed(1)}%`}
              color="text-green-600 dark:text-green-400"
            />
            <StatCard
              icon={<AlertCircle className="h-5 w-5" />}
              label="Active Aisles"
              value={new Set(events.map(e => e.aisleId).filter(Boolean)).size.toString()}
              color="text-orange-600 dark:text-orange-400"
            />
          </div>

          {/* Event Type Breakdown */}
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-3">Average Duration by Event Type</h3>
            <div className="space-y-2">
              {Object.entries(stats.avgDurationByType).map(([type, avgDuration]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getEventTypeLabel(type as CanonMatchEvent['eventType'])}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {stats.eventsByType[type as CanonMatchEvent['eventType']]} events
                    </span>
                  </div>
                  <span className="text-sm font-mono">{avgDuration.toFixed(0)}ms</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Filters Section */}
      <Section>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Search by entity or match name</Label>
            <Input
              id="search"
              placeholder="e.g., onions, tomato..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Label htmlFor="event-type">Event Type</Label>
            <Select value={eventTypeFilter} onValueChange={(v: string) => setEventTypeFilter(v as any)}>
              <SelectTrigger id="event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="embedding-generation">Embedding Generation</SelectItem>
                <SelectItem value="semantic-match">Semantic Match</SelectItem>
                <SelectItem value="lexical-match">Lexical Match</SelectItem>
                <SelectItem value="candidate-merge">Candidate Merge</SelectItem>
                <SelectItem value="final-selection">Final Selection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-32">
            <Label htmlFor="date-range">Date Range</Label>
            <Select value={dateRange} onValueChange={(v: string) => setDateRange(v as any)}>
              <SelectTrigger id="date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {searchTerm && (
          <p className="text-xs text-muted-foreground mt-2">
            Found {filteredEvents.length} of {events.length} events
          </p>
        )}
      </Section>

      {/* Events Table */}
      <Section spacing="space-y-4">
        <h2 className="text-lg font-semibold">Event Log</h2>
        <Stack spacing="gap-2">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              <p>{searchTerm ? 'No events match your search' : 'No events found in this time range'}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map(event => (
                      <EventRow
                        key={event.id}
                        event={event}
                        isExpanded={expandedRows.has(event.id)}
                        onToggle={() => {
                          const newExpanded = new Set(expandedRows);
                          if (newExpanded.has(event.id)) {
                            newExpanded.delete(event.id);
                          } else {
                            newExpanded.add(event.id);
                          }
                          setExpandedRows(newExpanded);
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Stack>
      </Section>
    </Page>
  );
};

// ── Helper Components ─────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div className="p-4 border rounded-lg bg-background shadow-sm">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={color}>{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
    <div className="mt-2 text-2xl font-bold">{value}</div>
  </div>
);

interface EventRowProps {
  event: CanonMatchEvent;
  isExpanded: boolean;
  onToggle: () => void;
}

const EventRow: React.FC<EventRowProps> = ({ event, isExpanded, onToggle }) => {
  // Flag slow operations (>500ms)
  const isSlow = event.metrics.durationMs > 500;
  
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="text-xs font-mono">
          {new Date(event.timestamp).toLocaleString()}
        </TableCell>
        <TableCell>
          <Badge variant="outline">
            {getEventTypeLabel(event.eventType)}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="max-w-xs truncate font-medium">{event.entityName}</div>
          {event.output.topMatchName && (
            <div className="text-xs text-muted-foreground truncate">
              → {event.output.topMatchName}
            </div>
          )}
        </TableCell>
        <TableCell className={`text-sm font-mono ${isSlow ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}`}>
          {event.metrics.durationMs}ms
          {isSlow && <span className="ml-1">⚠️</span>}
        </TableCell>
        <TableCell className="text-sm">
          {event.output.resultCount !== undefined && (
            <>{event.output.resultCount} results</>
          )}
          {event.output.embeddingReused && (
            <span className="text-xs text-green-600 dark:text-green-400"> (reused)</span>
          )}
          {event.output.embeddingGenerated && (
            <span className="text-xs text-blue-600 dark:text-blue-400"> (generated)</span>
          )}
        </TableCell>
        <TableCell className="text-sm font-mono">
          {event.output.topScore !== undefined && event.output.topScore.toFixed(3)}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Input Details */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Input</h4>
                  <div className="space-y-1 text-sm">
                    {event.input.queryText && (
                      <div><span className="text-muted-foreground">Query:</span> "{event.input.queryText}"</div>
                    )}
                    {event.input.embeddingDim && (
                      <div><span className="text-muted-foreground">Embedding Dim:</span> {event.input.embeddingDim}</div>
                    )}
                    {event.input.candidateCount !== undefined && (
                      <div><span className="text-muted-foreground">Candidates:</span> {event.input.candidateCount}</div>
                    )}
                    {event.input.aisleFiltered !== undefined && (
                      <div><span className="text-muted-foreground">Aisle Filtered:</span> {event.input.aisleFiltered ? 'Yes' : 'No'}</div>
                    )}
                  </div>
                </div>

                {/* Output Details */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Output</h4>
                  <div className="space-y-1 text-sm">
                    {event.output.resultCount !== undefined && (
                      <div><span className="text-muted-foreground">Results:</span> {event.output.resultCount}</div>
                    )}
                    {event.output.topScore !== undefined && (
                      <div><span className="text-muted-foreground">Top Score:</span> {event.output.topScore.toFixed(4)}</div>
                    )}
                    {event.output.topMatchId && (
                      <div><span className="text-muted-foreground">Match ID:</span> {event.output.topMatchId}</div>
                    )}
                    {event.output.topMatchName && (
                      <div><span className="text-muted-foreground">Match Name:</span> "{event.output.topMatchName}"</div>
                    )}
                    {event.output.method && (
                      <div><span className="text-muted-foreground">Method:</span> {event.output.method}</div>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Metrics</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">Duration:</span> {event.metrics.durationMs}ms</div>
                    {event.metrics.batchId && (
                      <div><span className="text-muted-foreground">Batch ID:</span> {event.metrics.batchId}</div>
                    )}
                    {event.metrics.batchSize && (
                      <div><span className="text-muted-foreground">Batch Size:</span> {event.metrics.batchSize}</div>
                    )}
                    {event.metrics.batchIndex !== undefined && (
                      <div><span className="text-muted-foreground">Batch Index:</span> {event.metrics.batchIndex}</div>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                {event.metadata && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Metadata</h4>
                    <div className="space-y-1 text-sm">
                      {event.metadata.error && (
                        <div className="text-destructive"><span className="text-muted-foreground">Error:</span> {event.metadata.error}</div>
                      )}
                      {event.metadata.warning && (
                        <div className="text-orange-600 dark:text-orange-400"><span className="text-muted-foreground">Warning:</span> {event.metadata.warning}</div>
                      )}
                      {event.metadata.threshold !== undefined && (
                        <div><span className="text-muted-foreground">Threshold:</span> {event.metadata.threshold}</div>
                      )}
                      {event.metadata.pipelineVersion && (
                        <div><span className="text-muted-foreground">Pipeline Version:</span> {event.metadata.pipelineVersion}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Raw JSON (for ML/AI analysis) */}
              <details className="mt-4">
                <summary className="text-sm font-semibold cursor-pointer hover:text-primary">
                  Raw Event Data (Machine-Readable)
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </details>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

// ── Helper Functions ──────────────────────────────────────────────────────────

function getEventTypeLabel(type: CanonMatchEvent['eventType']): string {
  const labels: Record<CanonMatchEvent['eventType'], string> = {
    'ai-parse': 'AI Parse',
    'parse-validation': 'Validation',
    'match-decision': 'Decision',
    'embedding-generation': 'Embedding',
    'semantic-match': 'Semantic',
    'lexical-match': 'Lexical',
    'candidate-merge': 'Merge',
    'final-selection': 'Selection',
  };
  return labels[type] || type;
}
