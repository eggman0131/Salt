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

  /**
   * Finalises the recipe with full history context to prevent deviation.
   * Employs standard delays (500ms) for UI feedback now that project keys are valid.
   */
  const handleFinalise = async () => {
    if (status !== 'idle' || messages.length < 2) return;
    
    try {
      setStatus('finalizing');
      const consensusResponse = await saltBackend.summarizeAgreedRecipe(messages);
      const cleanedConsensus = sanitizeJson(consensusResponse);
      const { consensusDraft } = JSON.parse(cleanedConsensus);
      
      // Minimal delay for visual feedback
      await new Promise(r => setTimeout(r, 500));

      setStatus('organizing');
      // Pass full history context to synthesis to ensure new recipe reflects the conversation accurately
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
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-160px)] flex flex-col relative animate-in fade-in duration-500 overflow-hidden">
      {isBusy && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <Card className="w-full max-sm p-10 bg-white border-0 shadow-2xl space-y-8 text-center animate-in zoom-in-95 duration-300">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-gray-900">Preparing Recipe</h4>
              <p className="text-xs text-gray-400 font-sans italic">Synthesizing consensus into service documentation...</p>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
               <div className={`h-full bg-blue-500 transition-all duration-700 ${
                 status === 'finalizing' ? 'w-1/3' : 
                 status === 'organizing' ? 'w-2/3' : 'w-full'
               }`} />
            </div>
          </Card>
        </div>
      )}

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-2xl bg-white relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-gray-50/20">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`markdown-body max-w-[95%] md:max-w-[80%] p-5 md:p-6 rounded-2xl text-[14px] md:text-[15px] font-sans leading-relaxed ${
                  m.role === 'user' 
                    ? 'user-bubble bg-[#2563eb] text-white rounded-tr-none shadow-md shadow-blue-500/10' 
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100 shadow-sm'
                }`}
                dangerouslySetInnerHTML={renderMarkdown(m.text)}
              />
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-1.5 items-center p-4">
              <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
              <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Floating Save Button */}
        {canFinalise && !isBusy && !isTyping && (
          <div className="absolute right-4 bottom-20 md:right-6 animate-in slide-in-from-bottom-2 fade-in duration-300 pointer-events-none">
            <Button 
              variant="primary" 
              onClick={handleFinalise} 
              className="h-10 px-6 text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/30 pointer-events-auto border-2 border-white"
            >
              Save Recipe
            </Button>
          </div>
        )}

        {/* Input Dock */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2 z-10 shrink-0">
          <Input 
            placeholder="Discuss ingredients, methods..."
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            className="flex-1 bg-gray-50 border-gray-100 h-10 text-sm shadow-inner"
            disabled={isTyping || isBusy}
          />
          <button type="submit" disabled={!userInput || isTyping || isBusy} className="w-10 h-10 p-0 flex items-center justify-center shrink-0 bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-500/20 active:scale-90 disabled:opacity-30">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
            </svg>
          </button>
        </form>
      </Card>
    </div>
  );
};
