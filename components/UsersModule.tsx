
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
      <header className="border-b border-gray-100 pb-6 md:pb-8">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Kitchen Members</h2>
        <p className="text-sm text-gray-500 font-medium font-sans mt-1">Authorised residents and invited guests.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        {/* Invite Form */}
        <section className="lg:col-span-5">
          <Card className="p-6 md:p-8 sticky top-24 shadow-xl shadow-blue-500/5">
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900">Invite New Member</h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">Add a family member to the shared system.</p>
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
              <Button fullWidth type="submit" className="h-12 shadow-lg shadow-blue-500/10">
                Grant Kitchen Access
              </Button>
            </form>
          </Card>
        </section>

        {/* Member List */}
        <section className="lg:col-span-7">
          <div className="mb-6 flex justify-between items-center px-1">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Current Members ({users.length})</h4>
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
                  <Button 
                    variant={activeConfirmId === u.id ? 'primary' : 'ghost'} 
                    className={`text-[10px] md:text-[11px] uppercase font-black tracking-widest px-4 h-10 md:h-11 transition-all ${
                      activeConfirmId === u.id 
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20' 
                        : 'text-gray-400 hover:text-red-500'
                    }`}
                    onClick={() => handleDelete(u.id)}
                  >
                    {activeConfirmId === u.id ? 'Confirm Revoke' : 'Revoke'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {users.length === 0 && (
            <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 font-medium italic">No members found.</p>
            </div>
          )}
        </section>
      </div>

      <Card className="p-6 bg-blue-50 border-blue-100 shadow-sm">
        <div className="flex gap-4">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 shadow-sm">i</div>
          <div>
            <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Authorisation Notice</h5>
            <p className="text-[11px] md:text-xs text-blue-700 font-medium leading-relaxed">
              Kitchen members shared access to all indexed recipes and inventory units. Removing a member immediately revokes their session and ability to contribute to the shared manifest.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
