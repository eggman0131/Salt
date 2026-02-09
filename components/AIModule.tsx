
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Input, Label } from './UI';
import { saltBackend, sanitizeJson } from '../backend/api';
import { marked } from 'marked';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface AIModuleProps {
  onRecipeGenerated: () => void;
}

export const AIModule: React.FC<AIModuleProps> = ({ onRecipeGenerated }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Welcome to Salt. What are we planning for the kitchen today?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<'idle' | 'finalizing' | 'organizing' | 'imaging'>('idle');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || isTyping || status !== 'idle') return;

    const userMsg = userInput;
    setUserInput('');
    const newHistory = [...messages, { role: 'user', text: userMsg } as Message];
    setMessages(newHistory);
    
    setIsTyping(true);
    try {
      const response = await saltBackend.chatForDraft(newHistory);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      console.error("Salt AI Module Error:", err);
      setMessages(prev => [...prev, { role: 'ai', text: 'I encountered an issue. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFinalise = async () => {
    if (status !== 'idle' || messages.length < 2) return;
    
    try {
      setStatus('finalizing');
      const consensusResponse = await saltBackend.summarizeAgreedRecipe(messages);
      const cleanedConsensus = sanitizeJson(consensusResponse);
      const { consensusDraft } = JSON.parse(cleanedConsensus);
      
      await new Promise(r => setTimeout(r, 500));

      setStatus('organizing');
      const recipeData = await saltBackend.generateRecipeFromPrompt(
        consensusDraft || "A professional recipe based on the agreed plan.",
        undefined,
        messages
      );
      
      await new Promise(r => setTimeout(r, 500));

      setStatus('imaging');
      const imageData = await saltBackend.generateRecipeImage(recipeData.title || 'Dish');
      
      await saltBackend.createRecipe({
        ...recipeData,
        ingredients: recipeData.ingredients || [],
        instructions: recipeData.instructions || [],
        equipmentNeeded: recipeData.equipmentNeeded || [],
        title: recipeData.title || 'Untitled Recipe',
        description: recipeData.description || 'No description.',
        prepTime: recipeData.prepTime || '---',
        cookTime: recipeData.cookTime || '---',
        totalTime: recipeData.totalTime || '---',
        servings: recipeData.servings || '---',
        complexity: (recipeData.complexity as any) || 'Intermediate',
      } as any, imageData);

      onRecipeGenerated();
    } catch (err) {
      console.error("Salt Finalization Error:", err);
      alert("Encountered an issue finalizing the recipe. Please try again in a moment.");
    } finally {
      setStatus('idle');
    }
  };

  const isBusy = status !== 'idle';
  const canFinalise = messages.length > 1;

  const renderMarkdown = (text: string) => {
    try {
      return { __html: marked.parse(text) };
    } catch (e) {
      return { __html: text };
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-160px)] flex flex-col relative animate-in fade-in duration-500 overflow-hidden bg-gray-50">
      {isBusy && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <Card className="w-full max-w-md p-8 bg-white border border-gray-200 shadow-md space-y-4 text-center animate-in zoom-in-95 duration-300">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-semibold text-gray-900">Preparing Recipe</h4>
              <p className="text-sm text-gray-500">Finalizing your recipe. Please wait.</p>
            </div>
          </Card>
        </div>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden border border-gray-200 shadow-md bg-white relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`markdown-body max-w-[95%] md:max-w-[80%] p-4 md:p-5 rounded-2xl text-[14px] md:text-[15px] leading-relaxed border ${
                  m.role === 'user' 
                    ? 'bg-orange-600 text-white border-orange-600 shadow-sm' 
                    : 'bg-white text-gray-900 border-gray-200 shadow-sm'
                } ${m.role === 'user' ? 'rounded-tr-none' : 'rounded-bl-none'}`}
                dangerouslySetInnerHTML={renderMarkdown(m.text)}
              />
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-1.5 items-center p-4">
              <div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
              <div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {canFinalise && !isBusy && !isTyping && (
          <div className="absolute right-4 bottom-20 md:right-6 animate-in slide-in-from-bottom-2 fade-in duration-300 pointer-events-none">
            <button 
              onClick={handleFinalise} 
              className="w-12 h-12 flex items-center justify-center bg-orange-600 text-white rounded-xl shadow-md shadow-orange-500/30 pointer-events-auto border-2 border-white active:scale-95 transition-all hover:bg-orange-700"
              title="Save Final Recipe"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="p-3 md:p-4 bg-white border-t border-gray-200 flex gap-2 z-10 shrink-0">
          <Input 
            placeholder="Discuss ingredients, methods..."
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            className="flex-1 h-11 px-3 rounded-lg bg-white border border-gray-300 text-sm focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
            disabled={isTyping || isBusy}
          />
          <button type="submit" disabled={!userInput || isTyping || isBusy} className="w-11 h-11 p-0 flex items-center justify-center shrink-0 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-md shadow-orange-500/20 active:scale-95 disabled:opacity-40 transition">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.98721575 L3.03521743,10.4282088 C3.03521743,10.5853061 3.34915502,10.7424035 3.50612381,10.7424035 L16.6915026,11.5278905 C16.6915026,11.5278905 17.1624089,11.5278905 17.1624089,12.0031827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/></svg>
          </button>
        </form>
      </Card>
    </div>
  );
};
