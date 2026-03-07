import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Clock, MessageSquare, Loader2, Send, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Recipe } from '../../../types/contract';
import { chatWithRecipe, generateRecipeFromPrompt, summarizeAgreedRecipe } from '../../../modules_new/recipes/api';
import { softToast } from '@/lib/soft-toast';
import { createHistoryEntry } from '../backend/recipe-updates';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface RecipeChefChatProps {
  recipe: Recipe;
  onRecipeUpdate?: (id: string, updates: Partial<Recipe>) => Promise<void>;
  currentUserName?: string;
}

export const RecipeChefChat: React.FC<RecipeChefChatProps> = ({ 
  recipe,
  onRecipeUpdate,
  currentUserName = 'Chef',
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingProposals, setPendingProposals] = useState<Proposal[] | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleChat = async () => {
    const message = input.trim();
    if (!message || isProcessing || isUpdating || pendingProposals) return;

    const userMsg: Message = { role: 'user', text: message };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    
    setIsProcessing(true);
    
    try {
      // Use the recipe-specific chat method with streaming support
      const response = await chatWithRecipe(
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

  const handleReviewChanges = async () => {
    if (!hasConversation || isProcessing || isUpdating) return;

    setIsUpdating(true);
    try {
      const summaryResponse = await summarizeAgreedRecipe(messages, recipe);
      const parsed = JSON.parse(sanitizeJson(summaryResponse || '{}'));
      const proposals = (parsed.proposals || []).map((proposal: Proposal) => ({
        ...proposal,
        selected: true,
      }));

      if (proposals.length === 0) {
        softToast.info('No changes suggested yet');
        return;
      }

      setPendingProposals(proposals);
    } catch (err) {
      console.error('Review changes failed:', err);
      softToast.error('Could not review changes');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!pendingProposals || !onRecipeUpdate) return;
    const selected = pendingProposals.filter(p => p.selected);
    if (selected.length === 0) {
      setPendingProposals(null);
      return;
    }

    setIsUpdating(true);
    try {
      const consolidated = selected.map(p => p.technicalInstruction).join('\n');
      const updatedData = await generateRecipeFromPrompt(consolidated, {
        currentRecipe: recipe,
        history: messages,
      });
      const summaryStr = selected.map(p => p.description).join('; ');
      const summaryText = summaryStr || 'Applied agreed changes';
      const historyEntry = createHistoryEntry(
        recipe,
        summaryText,
        currentUserName
      );

      await onRecipeUpdate(recipe.id, {
        ...updatedData,
        history: [...(recipe.history || []), historyEntry],
      });

      setMessages(prev => [...prev, { role: 'ai', text: `Changes applied: ${summaryText}` }]);
      setPendingProposals(null);
    } catch (err) {
      console.error('Apply changes failed:', err);
      softToast.error('Could not apply changes');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <Card className="flex flex-col h-full overflow-hidden shadow-md">
      <CardHeader className="px-4 py-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Chef
          </CardTitle>
        </div>
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
      <CardContent className="p-4 space-y-3">
        {hasConversation && (
          <Button
            type="button"
            variant="outline"
            onClick={handleReviewChanges}
            disabled={isProcessing || isUpdating}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Review changes
          </Button>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Ask about this recipe..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isProcessing || isUpdating || !!pendingProposals}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!input.trim() || isProcessing || isUpdating || !!pendingProposals}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
      </Card>
      <Dialog open={!!pendingProposals} onOpenChange={(open) => !open && setPendingProposals(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review changes</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {(pendingProposals || []).map((proposal) => (
            <label
              key={proposal.id}
              className={`flex items-start gap-3 rounded-lg border p-4 text-sm transition-colors cursor-pointer ${
                proposal.selected ? 'bg-secondary/20 border-secondary/50' : 'bg-background hover:bg-muted/50'
              }`}
            >
              <div className="pt-0.5">
                <Checkbox
                  checked={proposal.selected}
                  onCheckedChange={() => {
                    setPendingProposals(prev =>
                      prev?.map(item =>
                        item.id === proposal.id
                          ? { ...item, selected: !item.selected }
                          : item
                      ) || null
                    );
                  }}
                />
              </div>
              <div className="space-y-1">
                <span className="font-medium leading-none block">{proposal.description}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{proposal.technicalInstruction}</span>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPendingProposals(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApplyChanges}
            disabled={isUpdating || (pendingProposals || []).every(p => !p.selected)}
            className="font-semibold"
          >
            {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
};

interface Proposal {
  id: string;
  description: string;
  technicalInstruction: string;
  selected: boolean;
}
