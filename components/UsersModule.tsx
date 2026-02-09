
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Label } from './UI';
import { User } from '../types/contract';
import { saltBackend } from '../backend/api';

interface UsersModuleProps {
  users: User[];
  onRefresh: () => void;
}

export const UsersModule: React.FC<UsersModuleProps> = ({ users, onRefresh }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [activeConfirmId, setActiveConfirmId] = useState<string | null>(null);

  // Auto-reset confirmation state after 3 seconds
  useEffect(() => {
    if (activeConfirmId) {
      const timer = setTimeout(() => setActiveConfirmId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [activeConfirmId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    await saltBackend.createUser({ displayName: name, email });
    setName('');
    setEmail('');
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (activeConfirmId === id) {
      await saltBackend.deleteUser(id);
      setActiveConfirmId(null);
      onRefresh();
    } else {
      setActiveConfirmId(id);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="p-6 md:p-8 space-y-8 flex flex-col h-full min-h-0">
        {/* Header Section */}
        <div className="space-y-1 shrink-0">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Access Control</p>
          <h3 className="text-xl md:text-2xl font-semibold text-gray-900 leading-tight">Authorised Users</h3>
        </div>

        {/* List Section - Now Scrollable */}
        <div className="flex-1 min-h-0 flex flex-col space-y-3">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Current Access List ({users.length})</Label>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-3 pb-4">
              {users.map((u) => (
                <div 
                  key={u.id} 
                  className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl group hover:border-orange-200 hover:bg-white transition-all shadow-sm"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                      {u.displayName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{u.displayName}</p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{u.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center shrink-0 ml-4">
                    {activeConfirmId === u.id ? (
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 h-8 rounded-md text-[10px] font-bold uppercase tracking-wide animate-in slide-in-from-right-1 shadow-sm"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-all"
                        title="Remove User"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-bold italic">No authorised users found.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Onboarding Section - Fixed at Bottom */}
        <div className="pt-6 border-t border-gray-100 shrink-0">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-name" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Full Name</Label>
                <Input 
                  id="user-name"
                  placeholder="e.g. John Doe" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="h-10 bg-gray-50 border-gray-200 focus:border-orange-500 focus:ring-orange-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Email Address</Label>
                <Input 
                  id="user-email"
                  type="email"
                  placeholder="john@example.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  className="h-10 bg-gray-50 border-gray-200 focus:border-orange-500 focus:ring-orange-50"
                />
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 flex gap-2 items-center text-[11px] text-orange-700 bg-orange-50/50 p-2 rounded-lg border border-orange-100/50">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
                <span>Full read/write permissions for catalog and schedule.</span>
              </div>
              <button 
                type="submit" 
                disabled={!name || !email}
                className="w-full md:w-auto inline-flex items-center justify-center rounded-md bg-orange-600 text-white px-6 py-2 h-10 font-bold text-sm hover:bg-orange-700 transition shadow-sm disabled:opacity-30 gap-2 shrink-0"
              >
                Grant Access
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
