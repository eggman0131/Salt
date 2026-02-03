
import React from 'react';
import { UsersModule } from './UsersModule';
import { Card, Button } from './UI';
import { User } from '../types/contract';
import { getActiveBackendMode } from '../backend/api';

interface AdminModuleProps {
  users: User[];
  onRefresh: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  isImporting: boolean;
}

export const AdminModule: React.FC<AdminModuleProps> = ({ 
  users, 
  onRefresh, 
  onImport, 
  onExport, 
  isImporting 
}) => {
  const mode = getActiveBackendMode();

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <header className="border-b border-gray-100 pb-6">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Admin Console</h2>
        <p className="text-sm text-gray-500 font-medium font-sans mt-1">System configuration and kitchen authority.</p>
      </header>

      {/* Manifest & System Section */}
      <section className="space-y-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 px-1">System Manifests</h3>
        <Card className="p-8 border-l-4 border-l-[#2563eb] bg-white shadow-xl shadow-blue-500/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex-1 space-y-2">
              <h4 className="text-lg font-bold text-gray-900">State Persistence</h4>
              <p className="text-sm text-gray-500 leading-relaxed font-medium font-sans">
                The manifest contains the complete state of your kitchen: users, recipes, equipment, and plans. 
                Use these tools to transfer data between simulation and production nodes.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Active Node:</span>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                  mode === 'firebase' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {mode}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
              <input 
                type="file" 
                id="admin-import" 
                className="hidden" 
                accept=".json" 
                onChange={onImport} 
              />
              <Button 
                onClick={() => document.getElementById('admin-import')?.click()}
                disabled={isImporting}
                className="h-12 px-8 uppercase tracking-widest text-[10px] font-black"
              >
                {isImporting ? 'Restoring Manifest...' : 'Restore State'}
              </Button>
              <Button 
                variant="secondary" 
                onClick={onExport}
                className="h-12 px-8 uppercase tracking-widest text-[10px] font-black"
              >
                Export Backup
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Kitchen Registry Section (Users) */}
      <section className="space-y-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 px-1">Kitchen Registry</h3>
        <UsersModule users={users} onRefresh={onRefresh} />
      </section>
    </div>
  );
};
