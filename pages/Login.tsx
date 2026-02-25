
import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { systemBackend } from '../shared/backend/system-backend';
import { User } from '../types/contract';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
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
      await systemBackend.login(email);
      
      // If we are still here, we might be in simulation mode.
      // Check if we have a user now.
      const user = await systemBackend.getCurrentUser();
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
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-muted to-background" />
      <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-28 left-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />

      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full space-y-8 rounded-2xl border border-border bg-card/80 p-8 shadow-lg backdrop-blur">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-black tracking-tight">SALT</h1>
            <p className="text-sm text-muted-foreground">Kitchen Management</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest">
                Email Address
              </Label>
              <Input 
                id="email"
                type="email" 
                placeholder="chef@kitchen.local" 
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                  if (info) setInfo(null);
                }}
                required
                autoFocus
                className="h-11"
              />
              {error && (
                <p className="text-xs font-semibold text-destructive">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-xs font-semibold text-primary">
                  {info}
                </p>
              )}
            </div>
            
            <Button type="submit" disabled={loading} className="w-full h-11 font-semibold uppercase tracking-widest shadow-lg">
              {loading ? 'Sending Link...' : 'Send Sign-In Link'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
