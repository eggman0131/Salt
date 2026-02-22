import React from 'react';

export const Content: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="overflow-auto p-4 lg:p-6">
    <div className="mx-auto max-w-6xl">{children}</div>
  </main>
);
