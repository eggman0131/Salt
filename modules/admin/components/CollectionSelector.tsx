import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { COLLECTION_REGISTRY, CollectionName } from '../../../types/contract';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../shared/backend/firebase';

interface CollectionInfo {
  name: CollectionName;
  count: number;
  displayName: string;
}

interface CollectionSelectorProps {
  selectedCollections: Set<CollectionName>;
  onSelectionChange: (selected: Set<CollectionName>) => void;
  isLoading?: boolean;
}

export const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  selectedCollections,
  onSelectionChange,
  isLoading = false,
}) => {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCollectionCounts = async () => {
      setLoading(true);
      try {
        const collectionInfos: CollectionInfo[] = [];

        for (const [collectionName, config] of Object.entries(COLLECTION_REGISTRY)) {
          let count = 0;
          const displayName = collectionName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          try {
            if (config.isSingleton) {
              // Check if singleton document exists
              const docRef = doc(db, collectionName, config.documentId!);
              const snapshot = await getDoc(docRef);
              count = snapshot.exists() ? 1 : 0;
            } else {
              // Get count of documents in collection
              const snapshot = await getDocs(collection(db, collectionName));
              count = snapshot.size;
            }
          } catch (error) {
            console.error(`Failed to fetch count for ${collectionName}:`, error);
            count = 0;
          }

          collectionInfos.push({
            name: collectionName as CollectionName,
            count,
            displayName,
          });
        }

        // Sort by display name
        collectionInfos.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setCollections(collectionInfos);
      } catch (error) {
        console.error('Failed to fetch collections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCollectionCounts();
  }, []);

  const handleToggleCollection = (collectionName: CollectionName) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(collectionName)) {
      newSelected.delete(collectionName);
    } else {
      newSelected.add(collectionName);
    }
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    const allNames = new Set(collections.map(c => c.name));
    onSelectionChange(allNames);
  };

  const handleDeselectAll = () => {
    onSelectionChange(new Set());
  };

  const totalItems = collections.reduce((sum, c) => sum + c.count, 0);
  const selectedCount = selectedCollections.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Select Collections</h3>
          <p className="text-xs text-muted-foreground">
            {selectedCount} of {collections.length} selected • {totalItems} total items
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="h-8 px-3 text-xs"
          >
            All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            className="h-8 px-3 text-xs"
          >
            None
          </Button>
        </div>
      </div>

      {loading || isLoading ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Loading collections...</p>
        </div>
      ) : (
        <div className="rounded-lg border p-4">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {collections.map((collectionInfo) => (
              <div
                key={collectionInfo.name}
                className="flex items-center gap-3 rounded p-2 hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={`collection-${collectionInfo.name}`}
                  checked={selectedCollections.has(collectionInfo.name)}
                  onCheckedChange={() => handleToggleCollection(collectionInfo.name)}
                  disabled={isLoading}
                />
                <Label
                  htmlFor={`collection-${collectionInfo.name}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span>{collectionInfo.displayName}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {collectionInfo.count} item{collectionInfo.count !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
