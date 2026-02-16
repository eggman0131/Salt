import React from 'react';
import { Card } from '../UI';

interface Proposal {
  id: string;
  description: string;
  technicalInstruction: string;
  selected: boolean;
}

interface ProposalModalProps {
  proposals: Proposal[];
  onToggle: (id: string) => void;
  onApply: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ProposalModal: React.FC<ProposalModalProps> = ({
  proposals,
  onToggle,
  onApply,
  onCancel,
  isLoading = false,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
      onWheel={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      <Card className="w-full max-w-md bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900">Review Changes</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {proposals.map(p => (
              <label key={p.id} className={`flex gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                p.selected ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'
              }`}>
                <input
                  type="checkbox"
                  checked={p.selected}
                  onChange={() => onToggle(p.id)}
                  className="mt-1 w-4 h-4 text-orange-600"
                />
                <span className="text-sm font-medium text-gray-900">{p.description}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onApply}
              disabled={isLoading || proposals.every(p => !p.selected)}
              className="flex-1 h-10 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Apply'}
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
