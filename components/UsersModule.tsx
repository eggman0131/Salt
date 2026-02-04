
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
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        {/* User Form */}
        <section className="lg:col-span-5">
          <Card className="p-6 md:p-8 sticky top-24 shadow-xl shadow-blue-500/5">
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900">Add User</h3>
            </div>
            
            <form onSubmit={handleAdd} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user-name">Full Name</Label>
                  <Input 
                    id="user-name"
                    placeholder="e.g. John Doe" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                  />
                </div>
                <div>
                  <Label htmlFor="user-email">Email Address</Label>
                  <Input 
                    id="user-email"
                    type="email"
                    placeholder="john@example.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  disabled={!name || !email}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-30"
                  title="Save User"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </button>
              </div>
            </form>
          </Card>
        </section>

        {/* Member List */}
        <section className="lg:col-span-7">
          <div className="mb-6 flex justify-between items-center px-1">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Staff List ({users.length})</h4>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {users.map(u => (
              <div 
                key={u.id} 
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gray-900 flex items-center justify-center text-white font-black text-xs md:text-sm shadow-sm">
                    {u.displayName[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm md:text-base leading-tight">{u.displayName}</p>
                    <p className="text-[11px] md:text-xs text-gray-400 font-sans mt-0.5">{u.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                   {activeConfirmId === u.id ? (
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-right-1"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 hover:text-red-500 transition-all"
                        title="Remove User"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
          
          {users.length === 0 && (
            <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 font-medium italic">No users found.</p>
            </div>
          )}
        </section>
      </div>

      <Card className="p-6 bg-blue-50 border-blue-100 shadow-sm">
        <div className="flex gap-4">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 shadow-sm">i</div>
          <div>
            <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Notice</h5>
            <p className="text-[11px] md:text-xs text-blue-700 font-medium leading-relaxed">
              Users share access to all recipes and equipment.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
