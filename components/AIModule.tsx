
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Input, Label } from './UI';
import { saltBackend } from '../backend/api';
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
    { role: 'ai', text: 'Welcome to Salt. What are we planning for the kitchen today? Tell me what you have in mind, and I will lead the process.' }
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
    if (status !== 'idle') return;
    
    try {
      setStatus('finalizing');
      const consensusDraft = await saltBackend.summarizeAgreedRecipe(messages);
      
      setStatus('organizing');
      const recipeData = await saltBackend.generateRecipeFromPrompt(consensusDraft);
      
      setStatus('imaging');
      const imageUrl = await saltBackend.generateRecipeImage(recipeData.title || 'Dish');
      
      await saltBackend.createRecipe({
        ...recipeData,
        imageUrl,
        ingredients: recipeData.ingredients || [],
        instructions: recipeData.instructions || [],
        equipmentNeeded: recipeData.equipmentNeeded || [],
        title: recipeData.title || 'Untitled Recipe',
        description: recipeData.description || 'No description.',
        createdAt: new Date().toISOString()
      } as any);

      onRecipeGenerated();
    } catch (err) {
      console.error("Salt Finalization Error:", err);
      alert("Something went wrong during saving. Please try simplifying your request.");
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
    <div className="space-y-6 md:space-y-10 relative">
      {isBusy && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <Card className="w-full max-w-sm p-10 bg-white border-0 shadow-2xl space-y-8 text-center animate-in zoom-in-95 duration-300">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-gray-900">Updating System State</h4>
              <p className="text-xs text-gray-500 font-sans leading-relaxed">
                {status === 'finalizing' && "Refining the kitchen plan..."}
                {status === 'organizing' && "Writing the method..."}
                {status === 'imaging' && "Visualising the dish..."}
              </p>
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

      <header className="border-b border-gray-100 pb-6">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Recipe Studio</h2>
        <p className="text-sm text-gray-500 font-medium font-sans mt-1">Chat with your Sous-Chef to plan the perfect dish.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-[calc(100vh-280px)] md:h-[600px]">
        <Card className="lg:col-span-8 flex flex-col overflow-hidden border-0 shadow-xl bg-white">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-gray-50/20">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`markdown-body max-w-[95%] md:max-w-[85%] p-6 md:p-8 rounded-2xl text-[14px] md:text-[15px] font-sans leading-relaxed ${
                    m.role === 'user' 
                      ? 'user-bubble bg-[#2563eb] text-white rounded-tr-none shadow-lg shadow-blue-500/10' 
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

          <form onSubmit={handleSend} className="p-4 md:p-6 bg-white border-t border-gray-100 flex gap-3">
            <Input 
              placeholder="Discuss ingredients, methods, or equipment..."
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              className="flex-1 bg-gray-50 border-gray-100 h-12"
              disabled={isTyping || isBusy}
            />
            <Button type="submit" disabled={!userInput || isTyping || isBusy} className="w-12 h-12 p-0 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
            </Button>
          </form>
        </Card>

        <section className="lg:col-span-4 flex flex-col gap-6">
          <Card className="p-8 bg-blue-50/50 border-blue-100/50 space-y-6">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#2563eb] mb-2">Sous-Chef Status</h4>
              <p className="text-xs text-blue-900 font-sans leading-relaxed">
                {status === 'idle' && "Discuss options freely before we save the final recipe."}
                {status !== 'idle' && "Processing..."}
              </p>
            </div>

            <div className="pt-4 border-t border-blue-100/30">
              <Button 
                fullWidth 
                variant="primary" 
                onClick={handleFinalise} 
                disabled={!canFinalise || isBusy || isTyping}
                className="h-14 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20"
              >
                {status === 'idle' ? 'Save Recipe' : 'Processing...'}
              </Button>
              {!canFinalise && status === 'idle' && (
                <p className="mt-3 text-[10px] text-blue-300 text-center font-bold uppercase tracking-widest">
                  Chat more to proceed
                </p>
              )}
            </div>
          </Card>

          <Card className="p-8 bg-white space-y-4 flex-1">
             <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Equipment Awareness</h4>
             <p className="text-[11px] text-gray-500 font-sans leading-relaxed italic">
               The chef is monitoring your equipment to ensure suggested methods are compatible with your current inventory.
             </p>
          </Card>
        </section>
      </div>
    </div>
  );
};
