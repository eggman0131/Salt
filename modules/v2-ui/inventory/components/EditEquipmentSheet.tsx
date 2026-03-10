import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../design-system/components/Dialog';
import { Button } from '../../design-system/components/Button';
import { Input } from '../../design-system/components/Input';
import { Badge } from '../../design-system/components/Badge';
import { Checkbox } from '../../design-system/components/Checkbox';
import { ScrollArea } from '../../design-system/components/ScrollArea';
import { Label } from '../../design-system/components/Label';
import { Loader2, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { updateEquipment, validateAccessory } from '../../../inventory/api';
import { softToast } from '@/lib/soft-toast';
import { Equipment } from '../../../../types/contract';

interface EditEquipmentSheetProps {
  equipment: Equipment;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
}

export const EditEquipmentSheet: React.FC<EditEquipmentSheetProps> = ({ equipment, onOpenChange, onRefresh }) => {
  const [status, setStatus] = useState<Equipment['status']>(equipment.status);
  const [accessories, setAccessories] = useState<Equipment['accessories']>(equipment.accessories || []);
  const [newAccessoryName, setNewAccessoryName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddAccessory = async () => {
    if (!newAccessoryName.trim() || isValidating) return;
    setIsValidating(true);
    try {
      const validated = await validateAccessory(
        equipment.name || equipment.brand || 'Equipment',
        newAccessoryName.trim()
      );
      setAccessories([...accessories, { ...validated, id: uuidv4() }]);
      setNewAccessoryName('');
      softToast.success('Accessory added');
    } catch (err) {
      console.error('Failed to validate accessory', err);
      softToast.error('Failed to add accessory');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveAccessory = (accessoryId: string) => {
    setAccessories(accessories.filter((a) => a.id !== accessoryId));
  };

  const handleToggleAccessoryOwned = (accessoryId: string) => {
    setAccessories(accessories.map((a) => (a.id === accessoryId ? { ...a, owned: !a.owned } : a)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateEquipment(equipment.id, { status, accessories });
      await onRefresh();
      softToast.success('Equipment updated', { description: equipment.name });
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update equipment', err);
      softToast.error('Failed to update equipment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-[var(--color-v2-border)] p-0 overflow-hidden bg-[var(--color-v2-card)] text-[var(--color-v2-foreground)]">
        <div className="p-6 pb-4 bg-gradient-to-b from-[var(--color-v2-secondary)]/50 to-transparent border-b border-[var(--color-v2-border)] flex flex-col items-start gap-2">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <span className="bg-gradient-to-r from-[var(--color-v2-primary)] to-[var(--color-v2-accent)] bg-clip-text text-transparent">
                {equipment.name}
              </span>
            </DialogTitle>
            <DialogDescription className="text-[var(--color-v2-muted-foreground)] text-base">
              {equipment.brand} • {equipment.modelName}
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[60vh] h-[600px]">
          <div className="p-6 space-y-8">
            
            <div className="space-y-3">
              <Label className="uppercase text-xs tracking-wider text-[var(--color-v2-muted-foreground)]">Current Status</Label>
              <div className="flex gap-2 p-1 bg-[var(--color-v2-secondary)] rounded-[var(--radius-v2-lg)] border border-[var(--color-v2-border)] w-fit">
                {(['Available', 'In Use', 'Maintenance'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`px-4 py-2 text-sm rounded-md font-medium transition-all duration-300 ${
                      status === s 
                        ? 'bg-[var(--color-v2-primary)] text-[var(--color-v2-primary-foreground)] shadow-md' 
                        : 'text-[var(--color-v2-muted-foreground)] hover:text-[var(--color-v2-foreground)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="uppercase text-xs tracking-wider text-[var(--color-v2-muted-foreground)]">Equipment Details</Label>
              </div>
              <div className="grid grid-cols-2 gap-4 p-5 rounded-xl border border-[var(--color-v2-border)] bg-[var(--color-v2-secondary)]/30 backdrop-blur-md">
                <div>
                  <span className="block text-xs text-[var(--color-v2-muted-foreground)] mb-1">Type</span>
                  <p className="font-medium text-[var(--color-v2-foreground)]">{equipment.type || 'N/A'}</p>
                </div>
                <div>
                  <span className="block text-xs text-[var(--color-v2-muted-foreground)] mb-1">Class</span>
                  <p className="font-medium text-[var(--color-v2-foreground)]">{equipment.class || 'N/A'}</p>
                </div>
                {equipment.description && (
                  <div className="col-span-2">
                    <span className="block text-xs text-[var(--color-v2-muted-foreground)] mb-1">Description</span>
                    <p className="font-medium text-sm leading-relaxed text-[var(--color-v2-foreground)]">{equipment.description}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-t border-[var(--color-v2-border)] pt-6">
                <Label className="uppercase text-xs tracking-wider text-[var(--color-v2-muted-foreground)]">Manage Accessories</Label>
                <Badge variant="outline" className="bg-[var(--color-v2-background)] text-[var(--color-v2-foreground)]">
                  {accessories.filter((a) => a.owned).length} / {accessories.length} owned
                </Badge>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl border border-[var(--color-v2-border)] bg-[var(--color-v2-background)] focus-within:ring-1 focus-within:ring-[var(--color-v2-ring)] transition-all">
                <Input
                  className="border-none bg-transparent shadow-none focus-visible:ring-0 h-10 px-3 text-[var(--color-v2-foreground)]"
                  placeholder="E.g., Pasta Roller Attachment"
                  value={newAccessoryName}
                  onChange={(e) => setNewAccessoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAccessory(); } }}
                  disabled={isValidating}
                />
                <Button 
                  onClick={handleAddAccessory} 
                  disabled={!newAccessoryName.trim() || isValidating} 
                  className="shrink-0 rounded-lg text-[var(--color-v2-primary-foreground)]"
                >
                  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add
                </Button>
              </div>

              {accessories && accessories.length > 0 ? (
                <div className="space-y-2 mt-4">
                  {accessories.map((accessory) => (
                    <div 
                      key={accessory.id} 
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                        accessory.owned ? 'bg-[var(--color-v2-primary)]/10 border-[var(--color-v2-primary)]/30' : 'bg-[var(--color-v2-secondary)] border-[var(--color-v2-border)] hover:border-[var(--color-v2-muted-foreground)]/50'
                      }`}
                    >
                      <Checkbox 
                        checked={accessory.owned} 
                        onCheckedChange={() => handleToggleAccessoryOwned(accessory.id)} 
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-base ${accessory.owned ? 'text-[var(--color-v2-primary)]' : 'text-[var(--color-v2-foreground)]'}`}>
                            {accessory.name}
                          </p>
                          {accessory.type === 'standard' && <ShieldCheck className="h-4 w-4 text-[var(--color-v2-accent)]" />}
                        </div>
                        {accessory.description && (
                          <p className="text-sm text-[var(--color-v2-muted-foreground)] mt-1">{accessory.description}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveAccessory(accessory.id)} className="text-[var(--color-v2-muted-foreground)] hover:text-[var(--color-v2-destructive)] hover:bg-[var(--color-v2-destructive)]/10 shrink-0 h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-[var(--color-v2-muted-foreground)]/60">
                  <p className="text-sm">No accessories linked to this equipment.</p>
                </div>
              )}
            </div>

          </div>
        </ScrollArea>

        <div className="p-4 border-t border-[var(--color-v2-border)] bg-[var(--color-v2-secondary)]/50 flex justify-end gap-3 backdrop-blur-lg">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="hover:bg-[var(--color-v2-background)] text-[var(--color-v2-foreground)]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="min-w-32 shadow-lg shadow-[var(--color-v2-primary)]/20 text-[var(--color-v2-primary-foreground)]">
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
