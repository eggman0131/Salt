
import React from 'react';
import { Button } from '../components/ui/button';

interface LandingProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-muted to-background" />
      <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-28 left-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />

      <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-8 px-4 py-12 text-center sm:px-6 lg:px-8">
        <div className="rounded-full border border-border bg-card/70 p-4 shadow-lg">
          <img src="/icons/icon.svg" alt="SALT" className="h-16 w-16 sm:h-20 sm:w-20" />
        </div>

        <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
          SALT
        </h1>

        <Button onClick={onStart} className="h-11 px-8 text-sm font-semibold uppercase tracking-widest shadow-lg">
          Enter Kitchen
        </Button>
      </main>
    </div>
  );
};
