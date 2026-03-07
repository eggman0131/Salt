/**
 * Canon Module — CofID Group Aisle Mappings Admin UI
 *
 * Full CRUD interface for managing CofID group → aisle mappings.
 * Combines mapping management with validation reporting.
 *
 * Phase 4 of Issue #105
 */

import React, { useState, useEffect } from 'react';
import { Page, Section, Stack } from '@/shared/components/primitives';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileDown,
  FileUp,
} from 'lucide-react';
import * as canonApi from '../../api';
import type { CoFIDGroupAisleMapping, Aisle, CofIDItem } from '@/types/contract';
import cofidMappingsData from '@/scripts/cofid-aisle-mapping.json';

export const CofidMappingsAdmin: React.FC = () => {
  const [mappings, setMappings] = useState<CoFIDGroupAisleMapping[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // CRUD state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentMapping, setCurrentMapping] = useState<CoFIDGroupAisleMapping | null>(null);
  const [mappingToDelete, setMappingToDelete] = useState<CoFIDGroupAisleMapping | null>(null);

  // Form state
  const [formGroup, setFormGroup] = useState('');
  const [formGroupName, setFormGroupName] = useState('');
  const [formAisleId, setFormAisleId] = useState('');
  const [formAisleName, setFormAisleName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Validation report state
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mappingsData, aislesData] = await Promise.all([
        canonApi.getCofidMappings(),
        canonApi.getCanonAisles(),
      ]);
      setMappings(mappingsData);
      setAisles(aislesData);
    } catch (err) {
      console.error('Failed to load CofID mappings:', err);
      toast.error('Failed to load mappings');
    } finally {
      setLoading(false);
    }
  };

  const generateValidationReport = async () => {
    try {
      setIsGeneratingReport(true);

      // Fetch CofID items
      const cofidItems = await canonApi.getCanonCofidItems();

      // Use actual mapping from seed data file
      const cofidMapping = cofidMappingsData;

      // Generate report using Canon API
      const importReport = canonApi.generateCofidImportReport(
        cofidItems,
        cofidMapping,
        aisles as any,
      );

      setReport(importReport);
      setShowReport(true);
    } catch (err) {
      console.error('Failed to generate validation report:', err);
      toast.error('Failed to generate validation report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCreateClick = () => {
    setFormGroup('');
    setFormGroupName('');
    setFormAisleId('');
    setFormAisleName('');
    setIsCreateOpen(true);
  };

  const handleEditClick = (mapping: CoFIDGroupAisleMapping) => {
    setCurrentMapping(mapping);
    setFormGroup(mapping.cofidGroup);
    setFormGroupName(mapping.cofidGroupName);
    setFormAisleId(mapping.aisleId);
    setFormAisleName(mapping.aisleName);
    setIsEditOpen(true);
  };

  const handleAisleChange = (aisleId: string) => {
    setFormAisleId(aisleId);
    const aisle = aisles.find(a => a.id === aisleId);
    if (aisle) {
      setFormAisleName(aisle.name);
    }
  };

  const handleCreateSave = async () => {
    if (!formGroup.trim() || !formGroupName.trim() || !formAisleId) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setIsSaving(true);
      await canonApi.addCofidMapping({
        cofidGroup: formGroup.trim(),
        cofidGroupName: formGroupName.trim(),
        aisleId: formAisleId,
        aisleName: formAisleName,
      });
      await loadData();
      setIsCreateOpen(false);
      toast.success('CofID mapping created', {
        description: `${formGroup} → ${formAisleName}`,
      });
    } catch (err) {
      console.error('Failed to create mapping:', err);
      toast.error('Failed to create mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!currentMapping || !formGroup.trim() || !formGroupName.trim() || !formAisleId) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setIsSaving(true);
      await canonApi.editCofidMapping(currentMapping.id, {
        cofidGroup: formGroup.trim(),
        cofidGroupName: formGroupName.trim(),
        aisleId: formAisleId,
        aisleName: formAisleName,
      });
      await loadData();
      setIsEditOpen(false);
      toast.success('CofID mapping updated', {
        description: `${formGroup} → ${formAisleName}`,
      });
    } catch (err) {
      console.error('Failed to update mapping:', err);
      toast.error('Failed to update mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!mappingToDelete) return;

    try {
      setIsDeleting(true);
      await canonApi.removeCofidMapping(mappingToDelete.id);
      await loadData();
      setMappingToDelete(null);
      toast.success('CofID mapping deleted', {
        description: `${mappingToDelete.cofidGroup} mapping removed`,
      });
    } catch (err) {
      console.error('Failed to delete mapping:', err);
      toast.error('Failed to delete mapping');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkImport = async () => {
    try {
      setIsSaving(true);
      toast.info('Starting bulk import...', {
        description: `Importing ${Object.keys(cofidMappingsData).length} mappings`,
      });

      // Build mapping data with aisle IDs
      const aisleNameToId: Record<string, string> = {};
      for (const aisle of aisles) {
        aisleNameToId[aisle.name] = aisle.id;
      }

      const transformedMappings: Record<string, any> = {};
      let missingAisles = 0;

      Object.entries(cofidMappingsData).forEach(([groupCode, mapping]: [string, any]) => {
        const aisleName = mapping.aisle;
        const aisleId = aisleNameToId[aisleName];

        if (!aisleId) {
          console.warn(`No aisle ID found for aisle name: "${aisleName}"`);
          missingAisles++;
          return;
        }

        transformedMappings[groupCode] = {
          id: groupCode,
          cofidGroup: groupCode,
          cofidGroupName: mapping.name,
          aisleId,
          aisleName,
        };
      });

      if (missingAisles > 0) {
        toast.warning(`Skipped ${missingAisles} mappings with missing aisle names`);
      }

      await canonApi.seedCofidGroupAisleMappings(transformedMappings);
      await loadData();
      toast.success('Bulk import complete', {
        description: `Imported ${Object.keys(transformedMappings).length} mappings`,
      });
    } catch (err) {
      console.error('Failed to import mappings:', err);
      toast.error('Bulk import failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportMappings = () => {
    try {
      const exportData: Record<string, any> = {};
      mappings.forEach(m => {
        exportData[m.cofidGroup] = {
          name: m.cofidGroupName,
          aisle: m.aisleName,
        };
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cofid-aisle-mapping-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Mappings exported', {
        description: `${mappings.length} mappings exported to JSON`,
      });
    } catch (err) {
      console.error('Failed to export mappings:', err);
      toast.error('Export failed');
    }
  };

  // Filter mappings by search term
  const filteredMappings = mappings.filter(
    m =>
      m.cofidGroup.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.cofidGroupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.aisleName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Page>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span>Loading CofID mappings...</span>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <Stack className="gap-6">
        {/* Header */}
        <Section>
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">CofID Group Aisle Mappings</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage mappings from CofID food groups to kitchen aisles for ingredient auto-creation
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreateClick} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Mapping
              </Button>
              <Button onClick={handleBulkImport} variant="outline" size="sm" disabled={isSaving}>
                <FileUp className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
              <Button onClick={handleExportMappings} variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={generateValidationReport}
                variant="outline"
                size="sm"
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Validation Report
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Mappings:</span>{' '}
                <span className="font-semibold">{mappings.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Available Groups:</span>{' '}
                <span className="font-semibold">{Object.keys(cofidMappingsData).length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Coverage:</span>{' '}
                <span className="font-semibold">
                  {Math.round((mappings.length / Object.keys(cofidMappingsData).length) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </Section>

        {/* Search */}
        <Section>
          <Input
            placeholder="Search by group code, name, or aisle..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </Section>

        {/* Mappings List */}
        <Section>
          {filteredMappings.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <p className="text-muted-foreground">
                {searchTerm ? 'No mappings match your search' : 'No CofID mappings found'}
              </p>
              {!searchTerm && (
                <Button onClick={handleCreateClick} variant="outline" className="mt-4" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Mapping
                </Button>
              )}
            </div>
          ) : (
            <Stack className="gap-2">
              {filteredMappings.map(mapping => (
                <Card
                  key={mapping.id}
                  className="p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono">
                          {mapping.cofidGroup}
                        </Badge>
                        <span className="font-medium text-foreground truncate">
                          {mapping.cofidGroupName}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Maps to: <span className="font-medium">{mapping.aisleName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        onClick={() => handleEditClick(mapping)}
                        variant="ghost"
                        size="sm"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => setMappingToDelete(mapping)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </Stack>
          )}
        </Section>

        {/* Validation Report */}
        {showReport && report && (
          <Section>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Validation Report</h2>
                <Button onClick={() => setShowReport(false)} variant="ghost" size="sm">
                  Hide Report
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Generated at {new Date(report.generatedAt).toLocaleString()}
              </p>

              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Total Items</div>
                  <div className="text-2xl font-bold">{report.totalItems}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Imported</div>
                  <div className="text-2xl font-bold text-green-600">{report.importedItems}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">Failed</div>
                  <div className="text-2xl font-bold text-red-600">{report.failedItems}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Embedding Errors
                  </div>
                  <div className="text-2xl font-bold">
                    {report.embeddingValidationErrors?.length ?? 0}
                  </div>
                </Card>
              </div>

              {/* Mapping Results */}
              {report.mappingResults && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-4">Mapping Results</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Mapped</div>
                      <div className="text-xl font-bold text-green-600">
                        {report.mappingResults.mapped}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Unmapped</div>
                      <div className="text-xl font-bold text-amber-600">
                        {report.mappingResults.unmapped}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Forced to Uncategorised</div>
                      <div className="text-xl font-bold text-orange-600">
                        {report.mappingResults.forced_to_uncategorised}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Mapping Failures */}
              {report.mappingFailures && report.mappingFailures.length > 0 && (
                <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4" />
                    Unmapped Groups (will use Uncategorised)
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {report.mappingFailures.map((failure: any) => (
                      <div
                        key={failure.group}
                        className="text-sm p-2 bg-white dark:bg-gray-900 rounded border border-amber-200 dark:border-amber-800"
                      >
                        <div className="font-semibold text-amber-900 dark:text-amber-100">
                          {failure.group} — {failure.groupName}
                        </div>
                        <div className="text-amber-800 dark:text-amber-200">
                          {failure.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Success State */}
              {report.mappingFailures?.length === 0 &&
                report.embeddingValidationErrors?.length === 0 && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-900 dark:text-green-100">
                      All CofID items validated successfully!
                    </AlertDescription>
                  </Alert>
                )}
            </div>
          </Section>
        )}
      </Stack>

      {/* Create Mapping Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create CofID Mapping</DialogTitle>
            <DialogDescription>
              Create a new mapping from a CofID food group to a kitchen aisle
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-group">CofID Group Code *</Label>
              <Input
                id="create-group"
                placeholder="e.g., AA, AB, BA"
                value={formGroup}
                onChange={e => setFormGroup(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-group-name">CofID Group Name *</Label>
              <Input
                id="create-group-name"
                placeholder="e.g., Flours, grains and starches"
                value={formGroupName}
                onChange={e => setFormGroupName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-aisle">Aisle *</Label>
              <Select value={formAisleId} onValueChange={handleAisleChange}>
                <SelectTrigger id="create-aisle">
                  <SelectValue placeholder="Select aisle..." />
                </SelectTrigger>
                <SelectContent>
                  {aisles.map(aisle => (
                    <SelectItem key={aisle.id} value={aisle.id}>
                      {aisle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Mapping Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit CofID Mapping</DialogTitle>
            <DialogDescription>
              Update the CofID group → aisle mapping
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group">CofID Group Code *</Label>
              <Input
                id="edit-group"
                placeholder="e.g., AA, AB, BA"
                value={formGroup}
                onChange={e => setFormGroup(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-group-name">CofID Group Name *</Label>
              <Input
                id="edit-group-name"
                placeholder="e.g., Flours, grains and starches"
                value={formGroupName}
                onChange={e => setFormGroupName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-aisle">Aisle *</Label>
              <Select value={formAisleId} onValueChange={handleAisleChange}>
                <SelectTrigger id="edit-aisle">
                  <SelectValue placeholder="Select aisle..." />
                </SelectTrigger>
                <SelectContent>
                  {aisles.map(aisle => (
                    <SelectItem key={aisle.id} value={aisle.id}>
                      {aisle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!mappingToDelete} onOpenChange={() => setMappingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CofID Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this mapping?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {mappingToDelete && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="font-semibold">
                {mappingToDelete.cofidGroup} — {mappingToDelete.cofidGroupName}
              </div>
              <div className="text-muted-foreground">
                Maps to: {mappingToDelete.aisleName}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
};
