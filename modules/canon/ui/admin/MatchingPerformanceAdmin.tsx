/**
 * Matching Performance Admin
 *
 * Three views:
 * 1. Sessions — batch operations grouped by batchId, per-ingredient outcomes
 * 2. Item History — timeline of all decisions for a searched ingredient
 * 3. Performance — aggregate stats and confidence distribution
 *
 * Architecture: all data via api.ts only. Salt design primitives throughout.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getMatchEvents } from '../../api';
import type { CanonMatchEvent } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Download,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  PlusCircle,
  XCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { softToast } from '@/lib/soft-toast';
import { useAdminRefresh } from '@/shared/providers';

// ── Types ──────────────────────────────────────────────────────────────────────

type DateRange = '24h' | '7d' | '30d' | 'all';

interface SessionSummary {
  batchId: string;
  label: string;
  timestamp: string;
  totalIngredients: number;
  matched: number;
  created: number;
  unmatched: number;
  avgConfidence: number;
  totalDurationMs: number;
  decisions: MatchDecision[];
}

interface MatchDecision {
  entityId: string;
  entityName: string;
  batchIndex: number;
  decision: 'use_existing_canon' | 'create_new_canon' | 'no_match';
  topMatchName?: string;
  topScore?: number;
  scoreGap?: number;
  stage?: string;
  reason?: string;
  candidates?: Array<{ id: string; name: string; score: number; method: string; reason?: string }>;
  stageEvents: CanonMatchEvent[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateBounds(range: DateRange): { startDate: Date; endDate: Date } {
  const end = new Date();
  const start = new Date();
  if (range === '24h') start.setHours(start.getHours() - 24);
  else if (range === '7d') start.setDate(start.getDate() - 7);
  else if (range === '30d') start.setDate(start.getDate() - 30);
  else start.setFullYear(2020);
  return { startDate: start, endDate: end };
}

function buildSessions(events: CanonMatchEvent[]): SessionSummary[] {
  const byBatch = new Map<string, CanonMatchEvent[]>();

  for (const e of events) {
    const bid = e.metrics.batchId;
    if (!bid) continue;
    if (!byBatch.has(bid)) byBatch.set(bid, []);
    byBatch.get(bid)!.push(e);
  }

  const sessions: SessionSummary[] = [];

  for (const [batchId, batchEvents] of byBatch) {
    const labelEvent = batchEvents.find(e => e.metrics.sessionLabel);
    const label =
      labelEvent?.metrics.sessionLabel ??
      batchEvents.find(e => e.eventType === 'parse-validation')?.entityName ??
      `Batch ${batchId.slice(-8)}`;

    const timestamp = [...batchEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0].timestamp;

    const byEntity = new Map<string, CanonMatchEvent[]>();
    for (const e of batchEvents) {
      if (!byEntity.has(e.entityId)) byEntity.set(e.entityId, []);
      byEntity.get(e.entityId)!.push(e);
    }

    const decisions: MatchDecision[] = [];
    for (const [entityId, entityEvents] of byEntity) {
      const decisionEvent = entityEvents.find(e => e.eventType === 'match-decision');
      if (!decisionEvent) continue;
      const out = decisionEvent.output as any;
      decisions.push({
        entityId,
        entityName: decisionEvent.entityName,
        batchIndex: decisionEvent.metrics.batchIndex ?? 0,
        decision: out.decision ?? 'no_match',
        topMatchName: out.topMatchName ?? out.canonItemId,
        topScore: out.topScore,
        scoreGap: out.scoreGap,
        stage: out.stage,
        reason: out.reason,
        candidates: out.candidates,
        stageEvents: entityEvents.filter(e =>
          ['lexical-match', 'semantic-match', 'candidate-merge'].includes(e.eventType)
        ),
      });
    }

    decisions.sort((a, b) => a.batchIndex - b.batchIndex);

    const matched = decisions.filter(d => d.decision === 'use_existing_canon').length;
    const created = decisions.filter(d => d.decision === 'create_new_canon').length;
    const unmatched = decisions.filter(d => d.decision === 'no_match').length;
    const scores = decisions.filter(d => d.topScore != null).map(d => d.topScore!);
    const avgConfidence = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const totalDurationMs = batchEvents.reduce((s, e) => s + e.metrics.durationMs, 0);

    sessions.push({
      batchId, label, timestamp,
      totalIngredients: decisions.length,
      matched, created, unmatched, avgConfidence, totalDurationMs,
      decisions,
    });
  }

  return sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function scoreColor(score: number): string {
  if (score >= 0.85) return 'text-green-600 dark:text-green-400';
  if (score >= 0.70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500';
}

function decisionIcon(d: MatchDecision['decision']) {
  if (d === 'use_existing_canon') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />;
  if (d === 'create_new_canon') return <PlusCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
}

const STAGE_ABBREV: Record<string, string> = {
  'lexical-match': 'L',
  'semantic-match': 'S',
  'candidate-merge': 'M',
};

// ── Main Component ─────────────────────────────────────────────────────────────

export const MatchingPerformanceAdmin: React.FC = () => {
  const { refreshTrigger } = useAdminRefresh();
  const [events, setEvents] = useState<CanonMatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = getDateBounds(dateRange);
      const data = await getMatchEvents({ startDate, endDate, limit: 2000 });
      setEvents(data);
    } catch {
      softToast.error('Failed to load match events');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData, refreshTrigger]);

  const sessions = useMemo(() => buildSessions(events), [events]);

  const handleExportCSV = () => {
    const decisions = events.filter(e => e.eventType === 'match-decision');
    const rows = decisions.map(e => {
      const out = e.output as any;
      const cands = (out.candidates ?? []).slice(0, 3)
        .map((c: any) => `${c.name}(${(c.score * 100).toFixed(0)}%)`)
        .join(' | ');
      return [
        e.timestamp, e.entityName, out.decision ?? '',
        out.topMatchName ?? '', out.topScore?.toFixed(3) ?? '',
        out.scoreGap?.toFixed(3) ?? '', out.stage ?? '',
        e.metrics.sessionLabel ?? '', e.metrics.batchId ?? '',
        e.metrics.durationMs.toString(), cands,
      ].map(v => `"${v}"`).join(',');
    });

    const header = [
      'Timestamp','Ingredient','Decision','Matched To','Score','Score Gap',
      'Stage','Session','Batch ID','Duration ms','Near Misses (top 3)',
    ].map(v => `"${v}"`).join(',');

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `match-decisions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    softToast.success('Exported decisions CSV');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Matching Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-session ingredient matching results and pipeline analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions">
              Sessions
              {sessions.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">{sessions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Item History</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-6">
            <SessionsView sessions={sessions} />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <ItemHistoryView events={events} />
          </TabsContent>
          <TabsContent value="performance" className="mt-6">
            <PerformanceView events={events} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

// ── Sessions View ─────────────────────────────────────────────────────────────

const SessionsView: React.FC<{ sessions: SessionSummary[] }> = ({ sessions }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">No batch sessions in this time range.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Sessions appear when recipes are imported or ingredients are matched in bulk.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map(s => (
        <div key={s.batchId} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === s.batchId ? null : s.batchId)}
            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
          >
            {expandedId === s.batchId
              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            }

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{s.label}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(s.timestamp).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {/* Match quality bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden w-28 bg-muted">
                  {s.matched > 0 && (
                    <div className="bg-green-500" style={{ width: `${(s.matched / s.totalIngredients) * 100}%` }} />
                  )}
                  {s.created > 0 && (
                    <div className="bg-amber-400" style={{ width: `${(s.created / s.totalIngredients) * 100}%` }} />
                  )}
                  {s.unmatched > 0 && (
                    <div className="bg-red-400" style={{ width: `${(s.unmatched / s.totalIngredients) * 100}%` }} />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.matched}✓{s.created > 0 ? ` ${s.created}+` : ''}{s.unmatched > 0 ? ` ${s.unmatched}✗` : ''} of {s.totalIngredients}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {s.avgConfidence > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-muted-foreground">Avg confidence</p>
                  <p className={`text-sm font-mono font-medium ${scoreColor(s.avgConfidence)}`}>
                    {(s.avgConfidence * 100).toFixed(0)}%
                  </p>
                </div>
              )}
              <div className="text-right hidden md:block">
                <p className="text-[10px] text-muted-foreground">Duration</p>
                <p className="text-sm font-mono">{(s.totalDurationMs / 1000).toFixed(1)}s</p>
              </div>
            </div>
          </button>

          {expandedId === s.batchId && (
            <div className="border-t divide-y bg-muted/20">
              {s.decisions.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">No ingredient decisions recorded.</p>
              ) : (
                s.decisions.map(d => <IngredientRow key={d.entityId} decision={d} />)
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Ingredient Row ─────────────────────────────────────────────────────────────

const IngredientRow: React.FC<{ decision: MatchDecision }> = ({ decision: d }) => {
  const [expanded, setExpanded] = useState(false);
  const hasCandidates = (d.candidates?.length ?? 0) > 0;

  const lexicalEvent = d.stageEvents.find(e => e.eventType === 'lexical-match');
  const semanticEvent = d.stageEvents.find(e => e.eventType === 'semantic-match');
  const lexicalCandidates: any[] = (lexicalEvent?.output as any)?.candidates ?? [];
  const semanticCandidates: any[] = (semanticEvent?.output as any)?.candidates ?? [];
  const hasStageDetail = hasCandidates || lexicalCandidates.length > 0 || semanticCandidates.length > 0 || !!d.reason;

  return (
    <div className="px-6 py-3 bg-background">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{decisionIcon(d.decision)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{d.entityName}</span>
            {d.decision === 'use_existing_canon' && d.topMatchName && (
              <span className="text-xs text-muted-foreground">
                → <span className="font-medium text-foreground">{d.topMatchName}</span>
              </span>
            )}
            {d.decision === 'create_new_canon' && (
              <span className="text-xs text-amber-600 dark:text-amber-400">new canon item</span>
            )}
            {d.decision === 'no_match' && (
              <span className="text-xs text-red-500">unmatched</span>
            )}
            {d.topScore != null && (
              <span className={`text-xs font-mono ${scoreColor(d.topScore)}`}>
                {(d.topScore * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* Pipeline stage timing chips */}
          {d.stageEvents.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {d.stageEvents.map((e, i) => {
                const abbrev = STAGE_ABBREV[e.eventType] ?? e.eventType[0].toUpperCase();
                const isSlow = e.metrics.durationMs > 200;
                return (
                  <span
                    key={i}
                    title={`${e.eventType}: ${e.metrics.durationMs}ms`}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                      isSlow
                        ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {abbrev} {e.metrics.durationMs}ms
                  </span>
                );
              })}
            </div>
          )}

          {/* Reason for borderline or failed matches */}
          {!expanded && d.reason && (d.decision !== 'use_existing_canon' || (d.topScore ?? 1) < 0.85) && (
            <p className="text-xs text-muted-foreground mt-0.5 italic">{d.reason}</p>
          )}
        </div>

        {hasStageDetail && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground shrink-0 mt-0.5 flex items-center gap-0.5"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? 'Hide' : 'Detail'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 ml-7 space-y-2 border-l-2 border-muted pl-3">
          {/* Lexical stage */}
          <StageRow
            label="Lexical"
            durationMs={lexicalEvent?.metrics.durationMs}
            poolCount={(lexicalEvent?.input as any)?.candidateCount}
            candidates={lexicalCandidates}
            emptyLabel="No candidates above 75%"
          />

          {/* Semantic stage */}
          <StageRow
            label="Semantic"
            durationMs={semanticEvent?.metrics.durationMs}
            poolCount={(semanticEvent?.input as any)?.candidateCount}
            candidates={semanticCandidates}
            emptyLabel={
              (semanticEvent?.input as any)?.embeddingDim
                ? 'No candidates above 70%'
                : 'No embedding available'
            }
          />

          {/* Merged decision candidates */}
          {hasCandidates && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Merged (decision input)</p>
              {d.candidates!.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`font-mono w-8 text-right ${scoreColor(c.score)}`}>{(c.score * 100).toFixed(0)}%</span>
                  <span className="font-medium text-foreground">{c.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{c.method}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Reason */}
          {d.reason && (
            <p className="text-xs text-muted-foreground italic">{d.reason}</p>
          )}
        </div>
      )}
    </div>
  );
};

const StageRow: React.FC<{
  label: string;
  durationMs?: number;
  poolCount?: number;
  candidates: Array<{ name: string; score: number; method: string }>;
  emptyLabel: string;
}> = ({ label, durationMs, poolCount, candidates, emptyLabel }) => (
  <div className="space-y-0.5">
    <div className="flex items-center gap-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {poolCount != null && (
        <span className="text-[10px] text-muted-foreground">pool: {poolCount.toLocaleString()}</span>
      )}
      {durationMs != null && (
        <span className="text-[10px] font-mono text-muted-foreground">{durationMs}ms</span>
      )}
    </div>
    {candidates.length === 0 ? (
      <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>
    ) : (
      candidates.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className={`font-mono w-8 text-right ${scoreColor(c.score)}`}>{(c.score * 100).toFixed(0)}%</span>
          <span className="text-foreground">{c.name}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0">{c.method}</Badge>
        </div>
      ))
    )}
  </div>
);

// ── Item History View ─────────────────────────────────────────────────────────

const ItemHistoryView: React.FC<{ events: CanonMatchEvent[] }> = ({ events }) => {
  const [query, setQuery] = useState('');

  const decisionEvents = useMemo(
    () => events.filter(e => e.eventType === 'match-decision'),
    [events]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return decisionEvents
      .filter(e =>
        e.entityName.toLowerCase().includes(lower) ||
        ((e.output as any).topMatchName ?? '').toLowerCase().includes(lower)
      )
      .slice(0, 100);
  }, [decisionEvents, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ingredient name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      {query && results.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No decisions found for "{query}".</p>
      )}

      {!query && (
        <p className="text-sm text-muted-foreground">
          Search to see every time an ingredient was processed — useful for spotting regressions.
        </p>
      )}

      {results.length > 0 && (
        <div className="border rounded-lg divide-y">
          {results.map(e => {
            const out = e.output as any;
            const dec: MatchDecision['decision'] = out.decision ?? 'no_match';
            const cands: any[] = out.candidates ?? [];

            return (
              <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                <div className="mt-0.5">{decisionIcon(dec)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{e.entityName}</span>
                    {dec === 'use_existing_canon' && out.topMatchName && (
                      <span className="text-xs text-muted-foreground">→ {out.topMatchName}</span>
                    )}
                    {out.topScore != null && (
                      <span className={`text-xs font-mono ${scoreColor(out.topScore)}`}>
                        {(out.topScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>
                      {new Date(e.timestamp).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {e.metrics.sessionLabel && <span>{e.metrics.sessionLabel}</span>}
                    {!e.metrics.sessionLabel && e.metrics.batchId && (
                      <span className="font-mono">{e.metrics.batchId.slice(-8)}</span>
                    )}
                  </div>
                  {cands.length > 0 && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {cands.slice(0, 4).map((c, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground">
                          {c.name}{' '}
                          <span className={`font-mono ${scoreColor(c.score)}`}>
                            {(c.score * 100).toFixed(0)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Performance View ──────────────────────────────────────────────────────────

const PerformanceView: React.FC<{ events: CanonMatchEvent[] }> = ({ events }) => {
  const decisions = events.filter(e => e.eventType === 'match-decision');
  const total = decisions.length;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">No match decisions in this time range.</p>
      </div>
    );
  }

  const matched = decisions.filter(e => (e.output as any).decision === 'use_existing_canon').length;
  const created = decisions.filter(e => (e.output as any).decision === 'create_new_canon').length;
  const unmatched = decisions.filter(e => (e.output as any).decision === 'no_match').length;

  const scores = decisions
    .map(e => (e.output as any).topScore as number | undefined)
    .filter((s): s is number => s != null);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const buckets = [
    { label: '≥ 90%', min: 0.90, color: 'bg-green-500' },
    { label: '80–90%', min: 0.80, color: 'bg-green-400' },
    { label: '70–80%', min: 0.70, color: 'bg-amber-400' },
    { label: '< 70%', min: 0.00, color: 'bg-red-400' },
  ].map((b, i, arr) => ({
    ...b,
    count: scores.filter(s => s >= b.min && s < (arr[i - 1]?.min ?? 1.01)).length,
  }));
  const maxBucket = Math.max(...buckets.map(b => b.count), 1);

  const stageTypes = ['lexical-match', 'semantic-match', 'candidate-merge'] as const;
  const stageTiming = stageTypes.map(type => {
    const evts = events.filter(e => e.eventType === type);
    const avg = evts.length ? evts.reduce((s, e) => s + e.metrics.durationMs, 0) / evts.length : 0;
    return { type, avg: Math.round(avg), count: evts.length };
  });

  const borderline = decisions.filter(e => {
    const out = e.output as any;
    return out.decision === 'use_existing_canon' && (out.scoreGap ?? 1) < 0.10;
  });

  return (
    <div className="space-y-8">
      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Total decisions" value={total.toLocaleString()} />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
          label="Match rate"
          value={`${total > 0 ? ((matched / total) * 100).toFixed(1) : 0}%`}
          sub={`${matched} matched`}
        />
        <StatCard
          icon={<PlusCircle className="h-4 w-4 text-amber-500" />}
          label="New items"
          value={created.toString()}
          sub={`${total > 0 ? ((created / total) * 100).toFixed(1) : 0}% of total`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          label="Avg confidence"
          value={`${(avgScore * 100).toFixed(1)}%`}
          sub={`${unmatched} unmatched`}
        />
      </div>

      {/* Confidence distribution */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Confidence Distribution</h2>
        <div className="space-y-1.5">
          {buckets.map(b => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-xs font-mono w-16 text-right text-muted-foreground shrink-0">{b.label}</span>
              <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${b.color}`}
                  style={{ width: `${(b.count / maxBucket) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono w-8 text-muted-foreground shrink-0">{b.count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stage timing */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pipeline Stage Timing</h2>
        {stageTiming.map(s => (
          <div key={s.type} className="flex items-center justify-between py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {s.type === 'lexical-match' ? 'Lexical (Levenshtein)'
                  : s.type === 'semantic-match' ? 'Semantic (embeddings)'
                  : 'Candidate merge'}
              </span>
              <span className="text-xs text-muted-foreground">{s.count.toLocaleString()} events</span>
            </div>
            <span className={`text-sm font-mono ${s.avg > 200 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {s.avg}ms avg
            </span>
          </div>
        ))}
      </section>

      {/* Borderline decisions */}
      {borderline.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Borderline Decisions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Matched but score gap &lt; 10% — could easily have gone the other way
            </p>
          </div>
          <div className="border rounded-lg divide-y">
            {borderline.slice(0, 20).map(e => {
              const out = e.output as any;
              return (
                <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{e.entityName}</span>
                      <span className="text-xs text-muted-foreground">→ {out.topMatchName ?? out.canonItemId}</span>
                    </div>
                    {e.metrics.sessionLabel && (
                      <p className="text-xs text-muted-foreground">{e.metrics.sessionLabel}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-mono ${scoreColor(out.topScore ?? 0)}`}>
                      {((out.topScore ?? 0) * 100).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      gap {((out.scoreGap ?? 0) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}> = ({ icon, label, value, sub }) => (
  <div className="p-4 border rounded-lg space-y-1">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);
