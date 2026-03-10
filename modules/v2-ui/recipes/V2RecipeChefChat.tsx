import React, { useState, useRef, useEffect } from 'react';
import { Recipe } from '../../../types/contract';
import { chatWithRecipe, type RecipeConversationTurn } from '../../recipes/api';
import { Button } from '../design-system/components/Button';
import { Input } from '../design-system/components/Input';
import { ScrollArea } from '../design-system/components/ScrollArea';
import { Loader2, ChefHat, Send, Sparkles } from 'lucide-react';
import { softToast } from '@/lib/soft-toast';
import { systemBackend } from '../../../shared/backend/system-backend';

interface V2RecipeChefChatProps {
  recipe: Recipe;
  onRecipeUpdate: (id: string, updates: Partial<Recipe>) => Promise<void>;
}

// Convert legacy recipe history (which contains system edits) to a simple chat history
const extractChatHistory = (recipe: Recipe): RecipeConversationTurn[] => {
   if (!recipe.history) return [];
   return recipe.history
     .filter(h => h.userName) // Basic heuristic to guess if it's a chat or an edit
     .map(h => ({
       role: h.userName === 'AI Chef' ? 'ai' : 'user',
       text: h.changeDescription
     }));
};

export const V2RecipeChefChat: React.FC<V2RecipeChefChatProps> = ({ recipe, onRecipeUpdate }) => {
  const [messages, setMessages] = useState<RecipeConversationTurn[]>(() => extractChatHistory(recipe));
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('User');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    systemBackend.getCurrentUser()
      .then(user => { if (user?.displayName) setCurrentUserName(user.displayName); })
      .catch(() => null);
  }, []);

  // Removed direct sync with recipe.history to prevent parsing system histories mid-chat
  // Chat state represents the active session. The output gets dumped into the recipe's history log.

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    setInputValue('');
    setIsTyping(true);

    const newUserMsg: RecipeConversationTurn = {
      role: 'user',
      text: text,
    };

    const optimMessages = [...messages, newUserMsg];
    setMessages(optimMessages);
    scrollToBottom();

    let assistantResponseStr = '';
    
    // Create a temporary streaming message
    const assistantMsgIndex = optimMessages.length;
    const streamingMessages = [...optimMessages, {
      role: 'ai' as const,
      text: '',
    }];
    setMessages(streamingMessages);

    try {
      const finalResponse = await chatWithRecipe(
        recipe,
        text,
        optimMessages,
        (chunk) => {
          assistantResponseStr += chunk;
          setMessages(prev => {
            const next = [...prev];
            next[assistantMsgIndex] = {
               ...next[assistantMsgIndex],
               text: assistantResponseStr
            };
            return next;
          });
          scrollToBottom();
        }
      );

      // Save to persistence
      const newHistoryEntry = {
        timestamp: new Date().toISOString(),
        changeDescription: text,
        snapshot: recipe,
        userName: currentUserName,
      };
      const aiHistoryEntry = {
        timestamp: new Date().toISOString(),
        changeDescription: finalResponse,
        snapshot: recipe,
        userName: 'AI Chef',
      };

      await onRecipeUpdate(recipe.id, { 
         history: [...(recipe.history || []), newHistoryEntry, aiHistoryEntry] 
      });
    } catch (error) {
       console.error(error);
       softToast.error('The Chef ran into an issue');
       // Remove the failed assistant msg
       setMessages(optimMessages);
    } finally {
       setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-v2-background)] relative">
      
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-6 pb-4">
          
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center p-8 mt-12 space-y-4">
               <div className="w-16 h-16 rounded-full bg-[var(--color-v2-primary)]/10 text-[var(--color-v2-primary)] flex items-center justify-center mb-2">
                 <ChefHat className="w-8 h-8" />
               </div>
               <h3 className="font-bold text-xl">How can I help with this recipe?</h3>
               <p className="text-[var(--color-v2-muted-foreground)] text-sm max-w-[250px] leading-relaxed">
                 I can scale portions, substitute ingredients, answer cooking questions, or rewrite the instructions.
               </p>
               
               <div className="flex flex-col gap-2 w-full mt-4">
                 {['Can you make this vegan?', 'Scale this up to 8 servings', 'What can I use instead of milk?'].map(starter => (
                    <button 
                      key={starter}
                      onClick={() => setInputValue(starter)}
                      className="text-sm bg-[var(--color-v2-card)] hover:bg-[var(--color-v2-secondary)] border border-[var(--color-v2-border)] rounded-xl py-3 px-4 transition-colors text-left"
                    >
                      "{starter}"
                    </button>
                 ))}
               </div>
            </div>
          )}

          {messages.map((msg, i) => {
             const isUser = msg.role === 'user';
             if (msg.role !== 'user' && msg.role !== 'ai') return null;
             
             return (
               <div key={i} className={`flex flex-col max-w-[85%] ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                 <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-v2-muted-foreground)] mb-1 px-1">
                   {isUser ? currentUserName : 'Chef'}
                 </span>
                 <div className={`
                    p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm
                    ${isUser 
                      ? 'bg-gradient-to-br from-[var(--color-v2-primary)] to-[var(--color-v2-accent)] text-white rounded-tr-sm' 
                      : 'bg-[var(--color-v2-card)] border border-[var(--color-v2-border)] text-[var(--color-v2-foreground)] rounded-tl-sm'}
                 `}>
                   {msg.text}
                 </div>
               </div>
             )
          })}
          
          {isTyping && messages[messages.length - 1]?.role === 'user' && (
             <div className="flex flex-col max-w-[85%] mr-auto items-start">
                 <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-v2-muted-foreground)] mb-1 px-1">Chef</span>
                 <div className="p-4 rounded-2xl text-sm bg-[var(--color-v2-card)] border border-[var(--color-v2-border)] rounded-tl-sm text-[var(--color-v2-muted-foreground)] flex items-center gap-2">
                   <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                 </div>
             </div>
          )}

        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-[var(--color-v2-card)]/80 backdrop-blur-xl border-t border-[var(--color-v2-border)] relative z-20">
        <div className="relative">
          <Input 
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Ask the Chef to edit..."
            className="pr-12 pl-4 py-6 bg-[var(--color-v2-background)] border-[var(--color-v2-border)] rounded-2xl shadow-inner focus-visible:ring-[var(--color-v2-primary)]"
            disabled={isTyping}
          />
          <Button 
            size="icon"
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || isTyping}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl transition-all duration-300 ${inputValue.trim() ? 'bg-[var(--color-v2-primary)] hover:bg-[var(--color-v2-primary)] hover:scale-105' : 'bg-transparent text-[var(--color-v2-muted-foreground)] hover:bg-[var(--color-v2-secondary)]'}`}
          >
             <Send className={`w-4 h-4 ${inputValue.trim() ? 'text-white' : ''} ${inputValue.trim() && !isTyping ? 'translate-x-0.5 -translate-y-0.5' : ''} transition-transform`} />
          </Button>
        </div>
        <p className="text-[10px] text-center mt-3 text-[var(--color-v2-muted-foreground)] uppercase tracking-widest font-bold">
          <Sparkles className="w-3 h-3 inline pb-0.5 mr-1" />
          Powered by Salt AI
        </p>
      </div>

    </div>
  );
};
