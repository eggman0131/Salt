
import React, { useState } from 'react';
import { Button, Input, Card, Label } from '../components/UI';
import { saltBackend } from '../backend/api';
import { User } from '../types/contract';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('daniel@salt.uk');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const user = await saltBackend.login(email);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "No authorised kitchen member found with this address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
      <Card className="w-full max-sm p-10 border-0 shadow-2xl">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Kitchen Access</h2>
          <p className="text-sm text-gray-400 mt-2 font-medium">Authenticate to join the shared system.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="email">Kitchen ID (Email)</Label>
            <Input 
              id="email"
              type="email" 
              placeholder="chef@salt.kitchen" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              required
              className={error ? 'border-red-200 focus:ring-red-50' : ''}
              autoFocus
            />
            {error && (
              <p className="text-[11px] font-bold text-red-500 mt-2 text-center animate-bounce">
                {error}
              </p>
            )}
          </div>
          
          <div className="space-y-4">
            <Button type="submit" fullWidth disabled={loading} className="py-4 shadow-xl shadow-blue-500/20">
              {loading ? 'Verifying Identity...' : 'Sign In'}
            </Button>
          </div>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-50 text-center">
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
            Authorised Family Only
          </p>
        </div>
      </Card>
    </div>
  );
};
