'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, RefreshCw, Trash2, UploadCloud, FileSearch } from 'lucide-react';
import {
  getCanonItems as fetchCanonItems,
  getEmbeddingsFromLookup as fetchEmbeddingsFromLookup,
  deleteEmbeddings,
  upsertCanonItemEmbeddingById,
  publishLocalToMaster,
} from '../../api';

interface AnalysisReport {
  missingLocal: string[]; // Canon Item IDs that have no local 'canon' embedding
  orphanedLocal: string[]; // Local 'canon' embeddings that have no Canon Item
  validCount: number;
}

export function EmbeddingSyncUtility() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage('Fetching remote canon items and local embeddings...');
    
    try {
      const canonItems = await fetchCanonItems();
      const localEmbeddings = await fetchEmbeddingsFromLookup();
      
      const canonKindEmbeddings = localEmbeddings.filter(e => e.kind === 'canon');

      const itemIds = new Set(canonItems.map(item => item.id));
      const embeddingRefIds = new Set(canonKindEmbeddings.map(e => e.refId));

      const missingLocal: string[] = [];
      const orphanedLocal: string[] = [];
      let validCount = 0;

      // Find missing local embeddings (Item exists, embedding doesn't)
      for (const item of canonItems) {
        if (!embeddingRefIds.has(item.id)) {
          missingLocal.push(item.id);
        } else {
          validCount++;
        }
      }

      // Find orphaned local embeddings (Embedding exists, item doesn't)
      // Also grab the actual embedding document 'id' which we need for deletion
      const orphanedIdsToDelete: string[] = [];
      for (const embedding of canonKindEmbeddings) {
        if (!itemIds.has(embedding.refId)) {
          orphanedLocal.push(embedding.refId);
          orphanedIdsToDelete.push(embedding.id);
        }
      }

      setReport({ missingLocal, orphanedLocal: orphanedIdsToDelete, validCount });
      setStatusMessage(null);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze embeddings.');
    } finally {
      setLoading(false);
    }
  };

  const handleFixMissing = async () => {
    if (!report || report.missingLocal.length === 0) return;
    setLoading(true);
    setError(null);
    setStatusMessage(`Fixing ${report.missingLocal.length} missing embeddings...`);

    try {
      let successCount = 0;
      for (const itemId of report.missingLocal) {
        const result = await upsertCanonItemEmbeddingById(itemId);
        if (result.success) successCount++;
      }
      setStatusMessage(`Successfully generated ${successCount} missing embeddings.`);
      // Re-run analysis
      await handleAnalyze();
    } catch (err: any) {
      setError(err.message || 'Failed to fix missing embeddings.');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanOrphans = async () => {
    if (!report || report.orphanedLocal.length === 0) return;
    setLoading(true);
    setError(null);
    setStatusMessage(`Cleaning ${report.orphanedLocal.length} orphaned embeddings...`);

    try {
      await deleteEmbeddings(report.orphanedLocal);
      setStatusMessage('Successfully cleaned orphaned embeddings.');
      // Re-run analysis
      await handleAnalyze();
    } catch (err: any) {
      setError(err.message || 'Failed to clean orphaned embeddings.');
    } finally {
      setLoading(false);
    }
  };

  const handlePushToStorage = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage('Publishing local IndexedDB state to Firebase Storage Master...');

    try {
      await publishLocalToMaster();
      setStatusMessage('Successfully published state to Master.');
    } catch (err: any) {
      setError(err.message || 'Failed to publish to master.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Embedding Sync Utility</h2>
          <p className="text-muted-foreground">
            Reconcile local IndexedDB embeddings with Firestore Canon Items and publish to Master.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analysis & Actions</CardTitle>
          <CardDescription>
            Scan your local datastore for inconsistencies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-40"
            >
              <FileSearch className="mr-2 h-4 w-4" />
              Analyze
            </Button>
            
            <Button 
              onClick={handlePushToStorage} 
              disabled={loading} 
              variant="default"
              className="bg-green-600 hover:bg-green-700 w-48"
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Push DB to Storage
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {statusMessage && (
             <Alert className="bg-muted">
             <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
             <AlertTitle>Status</AlertTitle>
             <AlertDescription>{statusMessage}</AlertDescription>
           </Alert>
          )}

          {report && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
               <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{report.validCount}</div>
                  <div className="text-sm font-medium text-green-600 dark:text-green-500">Valid Embeddings</div>
               </div>

               <div className={`p-4 rounded-lg flex flex-col items-center justify-center text-center border ${report.missingLocal.length > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-muted border-border'}`}>
                  <AlertCircle className={`h-8 w-8 mb-2 ${report.missingLocal.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <div className={`text-2xl font-bold ${report.missingLocal.length > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>{report.missingLocal.length}</div>
                  <div className={`text-sm font-medium ${report.missingLocal.length > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>Missing Embeddings</div>
                  {report.missingLocal.length > 0 && (
                     <Button variant="outline" size="sm" className="mt-3 w-full border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10" onClick={handleFixMissing} disabled={loading}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Fix Missing
                     </Button>
                  )}
               </div>

               <div className={`p-4 rounded-lg flex flex-col items-center justify-center text-center border ${report.orphanedLocal.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-muted border-border'}`}>
                  <Trash2 className={`h-8 w-8 mb-2 ${report.orphanedLocal.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <div className={`text-2xl font-bold ${report.orphanedLocal.length > 0 ? 'text-red-700 dark:text-red-400' : ''}`}>{report.orphanedLocal.length}</div>
                  <div className={`text-sm font-medium ${report.orphanedLocal.length > 0 ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>Orphaned Embeddings</div>
                  {report.orphanedLocal.length > 0 && (
                     <Button variant="outline" size="sm" className="mt-3 w-full border-red-500/50 text-red-700 dark:text-red-400 hover:bg-red-500/10" onClick={handleCleanOrphans} disabled={loading}>
                        <Trash2 className="mr-2 h-4 w-4" /> Clean Orphans
                     </Button>
                  )}
               </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
