import React from 'react';
import { Equipment, Accessory } from '../../../types/contract';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Separator } from '../../../components/ui/separator';
import { ArrowLeft, Plus, Trash2, Check, X, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

type EquipmentDetailViewProps = {
  equipment: Equipment;
  isUpdating?: boolean;
  isValidatingAccessory?: boolean;
  onBack: () => void;
  onUpdate: (updates: Partial<Equipment>) => void;
  onAddAccessory: (accessoryName: string) => void;
  onRemoveAccessory: (accessoryId: string) => void;
  onToggleAccessoryOwned: (accessoryId: string, owned: boolean) => void;
  onRefreshSpecs: () => void;
};

export const EquipmentDetailView: React.FC<EquipmentDetailViewProps> = ({
  equipment,
  isUpdating = false,
  isValidatingAccessory = false,
  onBack,
  onUpdate,
  onAddAccessory,
  onRemoveAccessory,
  onToggleAccessoryOwned,
  onRefreshSpecs,
}) => {
  const [newAccessoryName, setNewAccessoryName] = React.useState('');
  const [statusValue, setStatusValue] = React.useState(equipment.status);

  const handleStatusChange = (value: string) => {
    setStatusValue(value as any);
    onUpdate({ status: value as any });
  };

  const handleAddAccessory = () => {
    if (newAccessoryName.trim()) {
      onAddAccessory(newAccessoryName.trim());
      setNewAccessoryName('');
    }
  };

  return (
    <section className="bg-muted/30 min-h-screen py-8 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-semibold sm:text-3xl truncate">{equipment.name}</h2>
            <p className="text-sm text-muted-foreground">{equipment.brand}</p>
          </div>
        </div>

        {/* Main equipment card */}
        <Card className="border-none shadow-md">
          <CardContent className="space-y-6 p-6">
            {/* Status section */}
            <div className="space-y-3">
              <Label>Status</Label>
              <div className="flex gap-2 flex-wrap">
                {(['Available', 'In Use', 'Maintenance'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={isUpdating}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      statusValue === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Equipment details (read-only grid) */}
            <div className="space-y-4">
              <h3 className="font-semibold">Equipment Details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Brand</Label>
                  <p className="font-medium">{equipment.brand}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Model</Label>
                  <p className="font-medium">{equipment.modelName}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{equipment.type}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Class</Label>
                  <p className="font-medium">{equipment.class}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <Label className="text-muted-foreground">Description</Label>
              <p className="text-sm leading-relaxed text-foreground">{equipment.description}</p>
            </div>

            {/* Metadata timestamps */}
            {(equipment.createdAt || equipment.createdBy) && (
              <>
                <Separator />
                <div className="space-y-2 text-xs text-muted-foreground">
                  {equipment.createdBy && <p>Created by: {equipment.createdBy}</p>}
                  {equipment.createdAt && (
                    <p>Added: {new Date(equipment.createdAt).toLocaleDateString()}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Accessories section */}
        <Card className="border-none shadow-md">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Accessories</h3>
              {equipment.accessories && (
                <Badge variant="secondary">
                  {equipment.accessories.filter((a) => a.owned).length} /
                  {equipment.accessories.length}
                </Badge>
              )}
            </div>

            {/* Add accessory form */}
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <Label htmlFor="new-accessory" className="text-sm">
                Add New Accessory
              </Label>
              <div className="flex gap-2">
                <Input
                  id="new-accessory"
                  placeholder="e.g., Pasta Attachment"
                  value={newAccessoryName}
                  onChange={(e) => setNewAccessoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAccessory()}
                  disabled={isValidatingAccessory || isUpdating}
                />
                <Button
                  onClick={handleAddAccessory}
                  disabled={!newAccessoryName.trim() || isValidatingAccessory || isUpdating}
                  size="sm"
                >
                  {isValidatingAccessory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Accessories list */}
            {equipment.accessories && equipment.accessories.length > 0 ? (
              <div className="space-y-2">
                {equipment.accessories.map((accessory, idx) => (
                  <div key={accessory.id || `acc-${idx}`} className="flex items-center gap-3 rounded-lg border p-3">
                    <button
                      onClick={() => onToggleAccessoryOwned(accessory.id, !accessory.owned)}
                      disabled={isUpdating}
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                        accessory.owned
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40 hover:border-primary'
                      )}
                    >
                      {accessory.owned && <Check className="h-3 w-3" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'font-medium text-sm',
                          accessory.owned && 'text-muted-foreground line-through'
                        )}
                      >
                        {accessory.name}
                      </p>
                      {accessory.description && (
                        <p className="text-xs text-muted-foreground">{accessory.description}</p>
                      )}
                      <Badge variant="outline" className="mt-1 text-xs">
                        {accessory.type}
                      </Badge>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onRemoveAccessory(accessory.id)}
                      disabled={isUpdating}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">
                No accessories yet. Add one above.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
