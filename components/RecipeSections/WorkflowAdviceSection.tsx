import React from 'react';

interface WorkflowAdvice {
  parallelTracks?: string[];
  technicalWarnings?: string[];
  optimumToolLogic?: string;
}

interface WorkflowAdviceSectionProps {
  workflowAdvice?: WorkflowAdvice;
}

export const WorkflowAdviceSection: React.FC<WorkflowAdviceSectionProps> = ({ workflowAdvice }) => {
  if (!workflowAdvice?.parallelTracks && !workflowAdvice?.optimumToolLogic) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">Workflow Overview</h3>
      {workflowAdvice?.parallelTracks && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 font-semibold">Parallel Tracks</p>
          <ul className="space-y-1">
            {workflowAdvice.parallelTracks.map((track, idx) => (
              <li key={idx} className="text-base text-gray-700">• {track}</li>
            ))}
          </ul>
        </div>
      )}
      {workflowAdvice?.optimumToolLogic && (
        <div className="space-y-1">
          <p className="text-sm text-gray-600 font-semibold">Optimum Tool Logic</p>
          <p className="text-base text-gray-700">{workflowAdvice.optimumToolLogic}</p>
        </div>
      )}
    </div>
  );
};
