import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Recipe } from '../../../types/contract';
import { recipesBackend } from '../backend';
import { softToast } from '@/lib/soft-toast';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface RecipeChefChatProps {
  recipe: Recipe;
  onRecipeUpdate?: (id: string, updates: Partial<Recipe>) => Promise<void>;
}

export const RecipeChefChat: React.FC<RecipeChefChatProps> = ({ 
  recipe,
  onRecipeUpdate
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleChat = async () => {
    const message = input.trim();
    if (!message || isProcessing) return;

    const userMsg: Message = { role: 'user', text: message };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    
    setIsProcessing(true);
    
    try {
      // Use the recipe-specific chat method with streaming support
      const response = await recipesBackend.chatWithRecipe(
        recipe,
        message,
        messages,
        undefined // Could add onChunk callback for streaming later
      );
      
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      console.error('Chat error:', err);
      softToast.error('Chat failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleChat();
  };

  const hasConversation = messages.length > 0;

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Chef
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ask questions or request changes
        </p>
      </CardHeader>

      <Separator />

      {/* Messages */}
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {!hasConversation && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Ask about ingredients, methods, or request modifications
                </p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {msg.role === 'ai' ? (
                    <div className="markdown-content">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="leading-relaxed mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          code: ({ children }) => <code className="bg-background/50 px-1 py-0.5 rounded text-xs">{children}</code>,
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            )}
            
            {/* Scroll anchor */}
            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <Separator />

      {/* Input */}
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Ask about this recipe..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isProcessing}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!input.trim() || isProcessing}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
