
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Input, Label } from '../../../components/UI';
import { recipesBackend } from '../../recipes';
import { marked } from 'marked';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface AIModuleProps {
  onRecipeGenerated: () => void;
  initialUserMessage?: string;
}

const sanitizeJson = (text: string): string => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1) {
    const startArr = text.indexOf('[');
    const endArr = text.lastIndexOf(']');
    return startArr !== -1 && endArr !== -1 ? text.substring(startArr, endArr + 1) : text.trim();
  }
  return start !== -1 && end !== -1 ? text.substring(start, end + 1) : text.trim();
};

export const AIModule: React.FC<AIModuleProps> = ({ onRecipeGenerated, initialUserMessage }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Welcome to Salt. What are we planning for the kitchen today?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<'idle' | 'finalising' | 'organising' | 'imaging' | 'categorising' | 'processing'>('idle');
  const [progressMessage, setProgressMessage] = useState('');

  const hasSentInitial = useRef(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialUserMessage && !hasSentInitial.current) {
      hasSentInitial.current = true;
      handleSendSilent(initialUserMessage);
    }
  }, [initialUserMessage]);

  const handleSendSilent = async (text: string) => {
    const userMsg = text;
    const newHistory = [...messages, { role: 'user', text: userMsg } as Message];
    setMessages(newHistory);
    
    setIsTyping(true);
    try {
      const response = await recipesBackend.chatForDraft(newHistory);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      console.error("Salt AI Module Error:", err);
      setMessages(prev => [...prev, { role: 'ai', text: 'I encountered an issue. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

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
      const response = await recipesBackend.chatForDraft(newHistory);
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
      setStatus('finalising');
      setProgressMessage('Summarising your discussion...');
      const consensusResponse = await recipesBackend.summarizeAgreedRecipe(messages);
      const cleanedConsensus = sanitizeJson(consensusResponse);
      const { consensusDraft } = JSON.parse(cleanedConsensus);
      
      await new Promise(r => setTimeout(r, 500));

      setStatus('organising');
      setProgressMessage('Building your recipe...');
      const recipeData = await recipesBackend.generateRecipeFromPrompt(
        consensusDraft || "A professional recipe based on the agreed plan.",
        undefined,
        messages
      );
      
      await new Promise(r => setTimeout(r, 500));

      setStatus('imaging');
      setProgressMessage('Generating photograph...');
      const imageData = await recipesBackend.generateRecipeImage(
        recipeData.title || 'Dish',
        recipeData.description
      );
      
      setStatus('categorising');
      setProgressMessage('Categorising recipe...');
      await new Promise(r => setTimeout(r, 100)); // Brief pause for visual feedback
      
      setStatus('processing');
      setProgressMessage('Processing ingredients...');
      await recipesBackend.createRecipe({
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
      console.error("Salt Finalisation Error:", err);
      alert("Encountered an issue finalising the recipe. Please try again in a moment.");
    } finally {
      setStatus('idle');
      setProgressMessage('');
    }
  };

  const handleImportUrl = async () => {
    if (!recipeUrl.trim() || isTyping || status !== 'idle') return;
    
    setIsTyping(true);
    setStatus('organising');
    setProgressMessage('Importing recipe...');
    
    try {
      // Import recipe from URL
      const importedRecipe = await recipesBackend.importRecipeFromUrl(recipeUrl);
      
      // Add to conversation as context
      const importSummary = `Imported recipe: ${importedRecipe.title}\n\nIngredients:\n${(importedRecipe.ingredients || []).join('\n')}\n\nMethod:\n${(importedRecipe.instructions || []).join('\n')}`;
      setMessages(prev => [
        ...prev,
        { role: 'user', text: `Import recipe from: ${recipeUrl}` },
        { role: 'ai', text: importSummary }
      ]);
      
      // Generate image
      setStatus('imaging');
      setProgressMessage('Generating photograph...');
      const imageData = await recipesBackend.generateRecipeImage(
        importedRecipe.title || 'Dish',
        importedRecipe.description
      );
      
      // Save to recipes with post-processing
      setStatus('categorising');
      setProgressMessage('Categorising recipe...');
      await new Promise(r => setTimeout(r, 100)); // Brief pause for visual feedback
      
      setStatus('processing');
      setProgressMessage('Processing ingredients...');
      await recipesBackend.createRecipe({
        ...importedRecipe,
        ingredients: importedRecipe.ingredients || [],
        instructions: importedRecipe.instructions || [],
        equipmentNeeded: importedRecipe.equipmentNeeded || [],
        title: importedRecipe.title || 'Imported Recipe',
        description: importedRecipe.description || 'Imported from external source.',
        prepTime: importedRecipe.prepTime || '---',
        cookTime: importedRecipe.cookTime || '---',
        totalTime: importedRecipe.totalTime || '---',
        servings: importedRecipe.servings || '---',
        complexity: (importedRecipe.complexity as any) || 'Intermediate',
      } as any, imageData);
      
      setRecipeUrl('');
      onRecipeGenerated();
    } catch (err) {
      console.error("URL Import Error:", err);
      setMessages(prev => [
        ...prev,
        { role: 'user', text: `Import recipe from: ${recipeUrl}` },
        { role: 'ai', text: 'Unable to retrieve that recipe. Please check the link and try again.' }
      ]);
    } finally {
      setIsTyping(false);
      setStatus('idle');
      setProgressMessage('');
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-100lex items-center justify-center p-6">
          <Card className="w-full max-w-md p-8 bg-white border border-gray-200 shadow-md space-y-6 text-center animate-in zoom-in-95 duration-300">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900">Finalising Recipe</h4>
              <div className="space-y-2.5">
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-sm font-medium transition-all duration-300 ${
                    status === 'finalising' 
                      ? 'text-orange-600 animate-pulse scale-105' 
                      : status === 'organising' || status === 'imaging' || status === 'categorising' || status === 'processing'
                        ? 'text-gray-900'
                        : 'text-gray-400'
                  }`}>
                    Summarising discussion
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-sm font-medium transition-all duration-300 ${
                    status === 'organising' 
                      ? 'text-orange-600 animate-pulse scale-105' 
                      : status === 'imaging' || status === 'categorising' || status === 'processing'
                        ? 'text-gray-900'
                        : 'text-gray-400'
                  }`}>
                    Building recipe
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-sm font-medium transition-all duration-300 ${
                    status === 'imaging' 
                      ? 'text-orange-600 animate-pulse scale-105' 
                      : status === 'categorising' || status === 'processing'
                        ? 'text-gray-900'
                        : 'text-gray-400'
                  }`}>
                    Generating photograph
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-sm font-medium transition-all duration-300 ${
                    status === 'categorising' 
                      ? 'text-orange-600 animate-pulse scale-105' 
                      : status === 'processing'
                        ? 'text-gray-900'
                        : 'text-gray-400'
                  }`}>
                    Categorising recipe
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-sm font-medium transition-all duration-300 ${
                    status === 'processing' 
                      ? 'text-orange-600 animate-pulse scale-105' 
                      : 'text-gray-400'
                  }`}>
                    Processing ingredients
                  </span>
                </div>
              </div>
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
          <div className="absolute right-4 bottom-48 md:right-6 md:bottom-40 animate-in slide-in-from-bottom-2 fade-in duration-300 pointer-events-none">
            <button 
              onClick={handleFinalise} 
              className="w-12 h-12 flex items-center justify-center bg-orange-600 text-white rounded-xl shadow-md shadow-orange-500/30 pointer-events-auto border-2 border-white active:scale-95 transition-all hover:bg-orange-700"
              title="Save Final Recipe"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="p-3 md:p-4 bg-white border-t border-gray-200 space-y-2 z-10 shrink-0">
          <div className="flex gap-2">
            <Input 
              placeholder="Recipe web address"
              value={recipeUrl}
              onChange={e => setRecipeUrl(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg bg-white border border-gray-300 text-sm focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
              disabled={isTyping || isBusy}
            />
            <button 
              type="button"
              onClick={handleImportUrl}
              disabled={!recipeUrl.trim() || isTyping || isBusy} 
              className="px-4 h-10 flex items-center justify-center shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm active:scale-95 disabled:opacity-40 transition"
            >
              Import
            </button>
          </div>
          <div className="flex gap-2">
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
          </div>
        </form>
      </Card>
    </div>
  );
};
