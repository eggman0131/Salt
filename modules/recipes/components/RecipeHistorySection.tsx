import React from 'react';
import { RecipeHistoryEntry } from '../../types/contract';

interface RecipeHistorySectionProps {
  history?: RecipeHistoryEntry[];
}

export const RecipeHistorySection: React.FC<RecipeHistorySectionProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">History</h3>
      <div className="space-y-3">
        {history.map((entry, idx) => (
          <div key={idx} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-900 font-semibold">{entry.changeDescription}</p>
            <p className="text-xs text-gray-500">{entry.userName || 'Unknown'} • {new Date(entry.timestamp).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
