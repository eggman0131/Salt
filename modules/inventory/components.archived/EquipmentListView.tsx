import React from 'react';
import { Equipment } from '../../../types/contract';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { Plus, Wrench, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

type EquipmentListViewProps = {
  equipment: Equipment[];
  onAddNew: () => void;
  onSelectEquipment: (equipment: Equipment) => void;
  onDeleteEquipment: (equipment: Equipment) => void;
  isLoading?: boolean;
};

const statusConfig = {
  Available: { badge: 'bg-green-100 text-green-800', icon: '✓' },
  'In Use': { badge: 'bg-blue-100 text-blue-800', icon: '⚡' },
  Maintenance: { badge: 'bg-amber-100 text-amber-800', icon: '⚠' },
  Archived: { badge: 'bg-slate-100 text-slate-800', icon: '📦' },
};

export const EquipmentListView: React.FC<EquipmentListViewProps> = ({
  equipment,
  onAddNew,
  onSelectEquipment,
  onDeleteEquipment,
  isLoading = false,
}) => {
  return (
    <section className="bg-muted/30 min-h-screen py-8 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold sm:text-3xl lg:text-4xl">Kitchen Equipment</h2>
            <p className="text-sm text-muted-foreground">Manage your equipment inventory</p>
          </div>
          <Button onClick={onAddNew} size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Equipment
          </Button>
        </div>

        {isLoading ? (
          <Card className="border-none shadow-sm">
            <CardContent className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </CardContent>
          </Card>
        ) : equipment.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Wrench className="mb-4 h-16 w-16 text-muted-foreground/50" />
              <h3 className="mb-2 text-xl font-semibold">No equipment yet</h3>
              <p className="mb-6 text-muted-foreground">
                Start building your kitchen inventory by adding your first piece of equipment
              </p>
              <Button onClick={onAddNew} size="lg" variant="default" className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Equipment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.map((item) => {
              const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.Available;
              return (
                <Card
                  key={item.id}
                  onClick={() => onSelectEquipment(item)}
                  className="cursor-pointer border-none shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardContent className="space-y-3 p-4 sm:p-5">
                    {/* Header with status badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{item.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{item.brand}</p>
                      </div>
                      <Badge className={cn('shrink-0', config.badge)}>
                        {config.icon} {item.status}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Equipment details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium text-right">{item.type}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Class:</span>
                        <span className="font-medium text-right">{item.class}</span>
                      </div>
                      {item.modelName && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Model:</span>
                          <span className="font-medium text-right truncate">{item.modelName}</span>
                        </div>
                      )}
                    </div>

                    {/* Accessories count */}
                    {item.accessories && item.accessories.length > 0 && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {item.accessories.length} accessory
                            {item.accessories.length !== 1 ? 'ies' : ''}
                          </span>
                          <span className="text-muted-foreground">
                            {item.accessories.filter((a) => a.owned).length} owned
                          </span>
                        </div>
                      </>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEquipment(item);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span className="hidden xs:inline">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEquipment(item);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
