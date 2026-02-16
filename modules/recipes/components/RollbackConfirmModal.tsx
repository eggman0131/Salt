import React from 'react';
import { Card } from '../../../components/UI';
import { RecipeHistoryEntry } from '../../types/contract';

interface RollbackConfirmModalProps {
  entry: RecipeHistoryEntry;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const RollbackConfirmModal: React.FC<RollbackConfirmModalProps> = ({
  entry,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
      onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      <Card className="w-full max-w-sm bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-orange-600">Rollback to this version?</h3>
          <p className="text-sm text-gray-600">Your current version will be saved as a checkpoint before restoring.</p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 h-10 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Rollback'}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 h-10 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
