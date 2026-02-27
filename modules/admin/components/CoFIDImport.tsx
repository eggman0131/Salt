import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { canonBackend } from '../../canon';
import { softToast } from '@/lib/soft-toast';

export const CoFIDImport: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    if (!file.name.endsWith('.json')) {
      softToast.error('Invalid file type', {
        description: 'Please select a JSON file',
      });
      return;
    }

    setIsUploading(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('JSON file must contain an array of items');
      }

      softToast.info('Importing CoFID data', {
        description: `Processing ${data.length} items...`,
      });

      const result = await canonBackend.importCoFIDData(data);

      if (result.errors.length > 0) {
        softToast.warning('Import completed with errors', {
          description: `${result.itemsImported} items imported, ${result.errors.length} errors occurred`,
        });
        console.error('CoFID import errors:', result.errors);
      } else {
        softToast.success('CoFID data imported', {
          description: `Successfully imported ${result.itemsImported} items`,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to import CoFID data';
      console.error('CoFID import failed:', err);
      softToast.error('Import failed', {
        description: errorMsg,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-4 md:p-6">
        <div className="space-y-1">
          <CardTitle className="text-xl md:text-2xl">CoFID Data Import</CardTitle>
          <p className="text-sm text-muted-foreground">
            Import UK food composition database for ingredient enrichment
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          Upload a JSON file containing CoFID (Composition of Foods Integrated Dataset) entries. 
          This will replace all existing CoFID data in the system.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Importing...' : 'Select CoFID File'}
        </Button>
      </CardContent>
    </Card>
  );
};
