
import React from 'react';
import { Button } from '../components/UI';

interface LandingProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingProps> = ({ onStart }) => {
  const handleStart = () => {
    // Guidelines: Removed mandatory openSelectKey() check as we are prioritising 
    // standard Flash models which utilise the provided environment key.
    onStart();
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl text-center space-y-12">
        <div className="space-y-3">
          <h1 className="text-6xl font-bold tracking-tighter text-gray-900">SALT</h1>
          <p className="text-xl text-gray-400 font-medium tracking-tight">Home Kitchen Management, simplified.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 text-lg">Recipe Collection</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">Organise ingredients, methods, and shared family notes with minimalist domestic precision.</p>
          </div>
          <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 text-lg">Equipment Inventory</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">Track your appliances and their verified accessories in one shared, intelligent manifest.</p>
          </div>
        </div>

        <div className="pt-6 flex justify-center">
          <Button onClick={handleStart} className="px-16 py-5 text-lg uppercase tracking-widest font-bold">
            Enter Kitchen
          </Button>
        </div>

        <p className="text-[10px] text-gray-300 uppercase tracking-[0.4em] font-black pt-16">
          Powered by Gemini AI
        </p>
      </div>
    </div>
  );
};
