
import React from 'react';
import { Button } from '../components/UI';

interface LandingProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[500px] h-[500px] bg-blue-50/40 rounded-full blur-3xl opacity-60" />
      <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-[500px] h-[500px] bg-gray-100/50 rounded-full blur-3xl opacity-60" />

      <main className="z-10 text-center space-y-8 max-w-lg animate-in fade-in zoom-in-95 duration-1000">
        <div className="space-y-2">
          <h1 className="text-8xl md:text-9xl font-black tracking-tighter text-gray-900 leading-none">
            SALT
          </h1>
          <p className="text-lg md:text-xl text-gray-400 font-medium tracking-tight">
            Your Kitchen Assistant
          </p>
        </div>
        
        <div className="pt-4 flex justify-center">
          <Button 
            onClick={onStart} 
            className="px-12 py-6 text-base uppercase tracking-[0.3em] font-black shadow-2xl shadow-blue-500/20 hover:-translate-y-1 transition-all active:scale-95 h-auto rounded-2xl"
          >
            Enter Kitchen
          </Button>
        </div>
      </main>

      <footer className="absolute bottom-10 left-0 right-0 flex justify-center">
        <div className="flex items-center gap-2 opacity-30">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <p className="text-[10px] text-gray-400 uppercase tracking-[0.4em] font-black">
            Gemini Core
          </p>
        </div>
      </footer>
    </div>
  );
};
