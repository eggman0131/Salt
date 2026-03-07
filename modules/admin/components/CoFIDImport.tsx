import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download } from 'lucide-react';
import { seedCofidItems } from '../../../modules_new/canon/api';
import { softToast } from '@/lib/soft-toast';
import { exportCofidBackup, importCofidBackup, CofidBackupData } from '../backend';

type CofidBackupPayload = {
  backupType: 'cofid';
  version: 1;
  exportedAt: string;
  itemCount?: number;
  items?: any[];
  documents?: Array<{ id: string; data: Record<string, any> }>;
};

const isCofidBackupPayload = (raw: unknown): raw is CofidBackupData => {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  return obj.backupType === 'cofid' && Array.isArray(obj.documents);
};

const parseCofidImportPayload = (raw: unknown): any[] => {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON format');
  }

  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.items)) {
    return obj.items;
  }

  if (Array.isArray(obj.cofid)) {
    return obj.cofid;
  }

  // Support the Firestore Browser export format
  if (Array.isArray(obj.documents)) {
    return obj.documents
      .map((d) => (d && typeof d === 'object' ? (d as Record<string, unknown>).data : null))
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object');
  }

  throw new Error('JSON must contain an array of CoFID items');
};

const downloadJson = (filename: string, payload: unknown): void => {
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const CoFIDImport: React.FC = () => {
  const [isRawImporting, setIsRawImporting] = useState(false);
  const [isBackupRestoring, setIsBackupRestoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const rawFileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const payload = await exportCofidBackup();

      const datePart = new Date().toISOString().slice(0, 10);
      downloadJson(`cofid-backup-${datePart}.json`, payload);

      softToast.success('CoFID backup exported', {
        description: `${payload.itemCount} CoFID records downloaded`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to export CoFID data';
      console.error('CoFID export failed:', err);
      softToast.error('Backup export failed', {
        description: errorMsg,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRawImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsRawImporting(true);

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as CofidBackupPayload;

      if (isCofidBackupPayload(payload)) {
        throw new Error('This file is a CoFID backup. Use "Restore From CoFID Backup".');
      }

      const data = parseCofidImportPayload(payload);

      softToast.info('Importing CoFID data', {
        description: `Processing ${data.length} items with embedding...`,
      });

      const result = await seedCofidItems(data);

      if (result.errors.length > 0) {
        softToast.warning('Import completed with errors', {
          description: `${result.imported} items imported, ${result.errors.length} errors occurred`,
        });
        console.error('CoFID import errors:', result.errors);
      } else {
        softToast.success('CoFID data imported', {
          description: `Successfully imported and embedded ${result.imported} items`,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to import CoFID data';
      console.error('CoFID import failed:', err);
      softToast.error('Import failed', {
        description: errorMsg,
      });
    } finally {
      setIsRawImporting(false);
    }
  };

  const handleBackupRestoreFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsBackupRestoring(true);

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as CofidBackupPayload;

      if (!isCofidBackupPayload(payload)) {
        throw new Error('Invalid CoFID backup file. Use an exported CoFID backup JSON.');
      }

      softToast.info('Restoring CoFID backup', {
        description: `Restoring ${payload.documents.length} records...`,
      });

      const result = await importCofidBackup(payload);
      softToast.success('CoFID backup restored', {
        description: `${result.itemsImported} records restored`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to restore CoFID backup';
      console.error('CoFID backup restore failed:', err);
      softToast.error('Backup restore failed', {
        description: errorMsg,
      });
    } finally {
      setIsBackupRestoring(false);
    }
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-4 md:p-6">
        <div className="space-y-1">
          <CardTitle className="text-xl md:text-2xl">CoFID Backup & Import</CardTitle>
          <p className="text-sm text-muted-foreground">
            Dedicated backup and restore for the CoFID dataset only
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          CoFID has a dedicated workflow separate from the main kitchen backup.
          Use raw import for initial data + embedding, then use backup export/restore for routine refresh.
        </p>

        <input
          ref={rawFileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleRawImportFileSelect}
          disabled={isRawImporting || isBackupRestoring || isExporting}
        />

        <input
          ref={backupFileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleBackupRestoreFileSelect}
          disabled={isRawImporting || isBackupRestoring || isExporting}
        />

        <Button
          onClick={() => rawFileInputRef.current?.click()}
          disabled={isRawImporting || isBackupRestoring || isExporting}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isRawImporting ? 'Importing Raw CoFID...' : 'Import Raw CoFID (with embedding)'}
        </Button>

        <Button
          onClick={() => backupFileInputRef.current?.click()}
          disabled={isRawImporting || isBackupRestoring || isExporting}
          variant="outline"
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isBackupRestoring ? 'Restoring Backup...' : 'Restore From CoFID Backup'}
        </Button>

        <Button
          onClick={handleExport}
          disabled={isRawImporting || isBackupRestoring || isExporting}
          variant="outline"
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting...' : 'Download CoFID Backup'}
        </Button>
      </CardContent>
    </Card>
  );
};
