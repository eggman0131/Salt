import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  ChevronRight, 
  Loader2, 
  Eye, 
  Copy,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { softToast } from '@/lib/soft-toast';
import {
  listCollections,
  getCollectionInfo,
  getCollectionDocuments,
  exportCollectionAsJson,
  downloadCollectionJson,
  FirestoreCollection,
  FirestoreDocument,
} from '../backend/admin-backend';

interface BrowserState {
  selectedCollection: string | null;
  documents: FirestoreDocument[];
  selectedDocument: FirestoreDocument | null;
  isLoading: boolean;
  collections: string[];
  searchQuery: string;
}

export const FirestoreBrowser: React.FC = () => {
  const [state, setState] = useState<BrowserState>({
    selectedCollection: null,
    documents: [],
    selectedDocument: null,
    isLoading: false,
    collections: [],
    searchQuery: '',
  });

  const [showDocViewer, setShowDocViewer] = useState(false);
  const [collectionInfo, setCollectionInfo] = useState<FirestoreCollection | null>(null);

  // Load collections on mount
  useEffect(() => {
    const loadCollections = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        const collections = await listCollections();
        setState(prev => ({
          ...prev,
          collections: collections.sort(),
          isLoading: false,
        }));
      } catch (error) {
        softToast.error('Failed to load collections', {
          description: error instanceof Error ? error.message : 'Please try again',
        });
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    loadCollections();
  }, []);

  // Load documents when collection is selected
  useEffect(() => {
    if (!state.selectedCollection) return;

    const loadDocuments = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        const docs = await getCollectionDocuments(state.selectedCollection!);
        const info = await getCollectionInfo(state.selectedCollection!);
        setState(prev => ({
          ...prev,
          documents: docs,
          selectedDocument: null,
          searchQuery: '',
          isLoading: false,
        }));
        setCollectionInfo(info);
      } catch (error) {
        softToast.error('Failed to load documents', {
          description: error instanceof Error ? error.message : 'Please try again',
        });
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadDocuments();
  }, [state.selectedCollection]);

  const handleSelectDocument = (doc: FirestoreDocument) => {
    setState(prev => ({ ...prev, selectedDocument: doc }));
    setShowDocViewer(true);
  };

  const handleExportCollection = async () => {
    if (!state.selectedCollection) return;

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const jsonData = await exportCollectionAsJson(state.selectedCollection);
      downloadCollectionJson(state.selectedCollection, jsonData);
      softToast.success('Collection exported', {
        description: `Downloaded ${state.documents.length} documents as JSON`,
      });
    } catch (error) {
      softToast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleCopyDocToClipboard = (doc: FirestoreDocument) => {
    const jsonStr = JSON.stringify(doc.data, null, 2);
    navigator.clipboard.writeText(jsonStr);
    softToast.success('Copied to clipboard');
  };

  const filteredDocuments = state.documents.filter(doc =>
    doc.id.toLowerCase().includes(state.searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      {/* Collections Panel */}
      <Card className="lg:col-span-1 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="p-4 md:p-6 border-b">
          <CardTitle className="text-lg md:text-xl">Collections</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {state.collections.length} collections found
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-100">
            <div className="p-4 space-y-2">
              {state.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : state.collections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No collections found
                </p>
              ) : (
                state.collections.map(collName => (
                  <button
                    key={collName}
                    onClick={() =>
                      setState(prev => ({
                        ...prev,
                        selectedCollection:
                          prev.selectedCollection === collName ? null : collName,
                      }))
                    }
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center gap-2 ${
                      state.selectedCollection === collName
                        ? 'bg-primary/10 text-primary hover:bg-primary/15'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        state.selectedCollection === collName
                          ? 'rotate-90'
                          : ''
                      }`}
                    />
                    <span className="truncate">{collName}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Documents Panel */}
      <Card className="lg:col-span-2 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="p-4 md:p-6 border-b">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg md:text-xl">
                  {state.selectedCollection ? `${state.selectedCollection}` : 'Select a collection'}
                </CardTitle>
                {state.selectedCollection && collectionInfo && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {collectionInfo.docCount} documents
                  </p>
                )}
              </div>
              {state.selectedCollection && (
                <Button
                  size="sm"
                  onClick={handleExportCollection}
                  disabled={state.isLoading || state.documents.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export JSON</span>
                </Button>
              )}
            </div>

            {state.selectedCollection && (
              <div className="relative">
                <Label htmlFor="search" className="sr-only">
                  Search documents
                </Label>
                <Input
                  id="search"
                  placeholder="Search by document ID..."
                  value={state.searchQuery}
                  onChange={e =>
                    setState(prev => ({ ...prev, searchQuery: e.target.value }))
                  }
                  className="text-sm"
                />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!state.selectedCollection ? (
            <div className="h-100 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Select a collection to view documents</p>
            </div>
          ) : state.isLoading ? (
            <div className="h-100 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="h-100 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">
                {state.documents.length === 0
                  ? 'No documents in this collection'
                  : 'No documents match your search'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-100">
              <div className="p-4 space-y-2">
                {filteredDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 p-3 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate text-foreground">
                        {doc.id}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {Object.keys(doc.data).length} fields
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSelectDocument(doc)}
                        className="h-8 w-8 p-0"
                        title="View document"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyDocToClipboard(doc)}
                        className="h-8 w-8 p-0"
                        title="Copy to clipboard"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Document Viewer Dialog */}
      <Dialog open={showDocViewer} onOpenChange={setShowDocViewer}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate text-lg">
              {state.selectedDocument?.id}
            </DialogTitle>
            <DialogDescription>
              {state.selectedCollection} collection
            </DialogDescription>
          </DialogHeader>

          {state.selectedDocument && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    state.selectedDocument &&
                    handleCopyDocToClipboard(state.selectedDocument)
                  }
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy JSON
                </Button>
              </div>
              <div className="bg-muted p-4 rounded-md overflow-x-auto max-h-100 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">
                  {JSON.stringify(state.selectedDocument.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
