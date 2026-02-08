
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
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      // Sends a passwordless sign-in link or performs instant simulated login
      await saltBackend.login(email);
      
      // If we are still here, we might be in simulation mode.
      // Check if we have a user now.
      const user = await saltBackend.getCurrentUser();
      if (user) {
        onLoginSuccess(user);
        return;
      }
      setInfo('Check your email for a sign-in link to finish logging in.');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Login failed.");
      setLoading(false);
    } 
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
      <Card className="w-full max-sm p-10 border-0 shadow-2xl">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Salt Login</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email"
              type="email" 
              placeholder="chef@salt.kitchen" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
                if (info) setInfo(null);
              }}
              required
              className={error ? 'border-red-200 focus:ring-red-50' : ''}
              autoFocus
            />
            {error && (
              <p className="text-[11px] font-bold text-red-500 mt-2 text-center">
                {error}
              </p>
            )}
            {info && (
              <p className="text-[11px] font-bold text-blue-600 mt-2 text-center">
                {info}
              </p>
            )}
          </div>
          
          <div className="space-y-4">
            <Button type="submit" fullWidth disabled={loading} className="py-4 shadow-xl shadow-blue-500/20">
              {loading ? 'Sending Link...' : 'Send Sign-In Link'}
            </Button>
          </div>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-50 text-center">
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
            SALT
          </p>
        </div>
      </Card>
    </div>
  );
};
