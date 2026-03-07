import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { seedCofidGroupAisleMappings } from '../../../modules_new/canon/api';
import { softToast } from '@/lib/soft-toast';
import cofidMappingData from '../../../scripts/cofid-aisle-mapping.json';

export const ImportCoFIDGroupMappings: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      // Convert mapping data to the format expected by the backend
      const mappings = Object.entries(cofidMappingData).map(([code, data]: [string, any]) => ({
        cofidGroup: code,
        cofidGroupName: data.name,
        aisle: data.aisle,
      }));

      softToast.info('Importing CoFID group mappings', {
        description: `Setting up ${mappings.length} group-to-aisle mappings...`,
      });

      await seedCofidGroupAisleMappings(Object.fromEntries(mappings.map(m => [m.cofidGroup, m])));

      softToast.success('CoFID group mappings imported', {
        description: `${mappings.length} group-to-aisle mappings are now available for item approval`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to import mappings';
      console.error('CoFID mapping import failed:', err);
      softToast.error('Import failed', {
        description: errorMsg,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-4 md:p-6">
        <div className="space-y-1">
          <CardTitle className="text-xl md:text-2xl">CoFID Group Mappings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Import CoFID food group ↔ aisle mappings for ingredient auto-creation
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          CoFID groups are classified by food type (e.g., "Cereals", "Meat", "Dairy"). 
          These mappings link each group to an aisle in your kitchen for automatic ingredient placement.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Available mappings: {Object.keys(cofidMappingData).length} groups</p>
          <div className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-y-auto p-2 border rounded bg-muted/30">
            {Object.entries(cofidMappingData).slice(0, 5).map(([code, data]: [string, any]) => (
              <div key={code}>
                <span className="font-mono text-xs">{code}</span>
                {' → '}
                <span>{data.aisle}</span>
              </div>
            ))}
            {Object.keys(cofidMappingData).length > 5 && (
              <div className="text-xs italic">
                ... and {Object.keys(cofidMappingData).length - 5} more
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={handleImport}
          disabled={isImporting}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isImporting ? 'Importing...' : 'Import CoFID Group Mappings'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Once imported, you can optionally link aisles to specific groups on the Aisles management page. 
          All groups will be available for auto-created items from imported CoFID data.
        </p>
      </CardContent>
    </Card>
  );
};
