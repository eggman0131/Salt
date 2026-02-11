import React, { useEffect, useState } from 'react';
import { setDebug, isDebugEnabled } from '../lib/logger';

export default function AdminModule() {
  const [debugOn, setDebugOn] = useState<boolean>(false);

  useEffect(() => {
    setDebugOn(isDebugEnabled());
  }, []);

  const toggle = () => {
    const next = !debugOn;
    setDebug(next);
    setDebugOn(next);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Admin</h2>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className={`px-3 py-1 rounded ${debugOn ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
          Debug Logs: {debugOn ? 'ON' : 'OFF'}
        </button>
        <span className="text-sm text-gray-500">Toggle runtime debug logging</span>
      </div>
    </div>
  );
}
