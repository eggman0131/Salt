import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare, Link as LinkIcon, Loader2, Send, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { recipesBackend } from '../../recipes';
import { softToast } from '@/lib/soft-toast';

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
  const [messages, setMessages] = useState<Message[]>(() => {
    // Load persisted chat from localStorage
    try {
      const saved = localStorage.getItem('salt-ai-chat');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const hasSentInitial = useRef(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('salt-ai-chat', JSON.stringify(messages));
    } catch (err) {
      console.error('Failed to persist chat', err);
    }
  }, [messages]);

  // Send initial message if provided
  useEffect(() => {
    if (initialUserMessage && !hasSentInitial.current) {
      hasSentInitial.current = true;
      handleChat(initialUserMessage);
    }
  }, [initialUserMessage]);

  // Auto-scroll to bottom when messages or status change
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processStatus]);

  const handleChat = async (text?: string) => {
    const message = text || input.trim();
    if (!message || isProcessing) return;

    const userMsg: Message = { role: 'user', text: message };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    
    setIsProcessing(true);
    setProcessStatus('Thinking...');
    
    try {
      const response = await recipesBackend.chatForDraft(newMessages);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      console.error('Chat error:', err);
      softToast.error('Chat failed', { description: 'Please try again' });
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleChat();
  };

  const handleFinalise = async () => {
    if (messages.length < 2 || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      setProcessStatus('Summarising discussion...');
      const consensusResponse = await recipesBackend.summarizeAgreedRecipe(messages);
      const cleanedConsensus = sanitizeJson(consensusResponse);
      const { consensusDraft } = JSON.parse(cleanedConsensus);
      
      setProcessStatus('Building recipe...');
      const recipeData = await recipesBackend.generateRecipeFromPrompt(
        consensusDraft || "A professional recipe based on the agreed plan.",
        undefined,
        messages
      );
      
      setProcessStatus('Generating photograph...');
      const imageData = await recipesBackend.generateRecipeImage(
        recipeData.title || 'Dish',
        recipeData.description
      );
      
      setProcessStatus('Saving recipe...');
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

      softToast.success('Recipe created', { description: recipeData.title });
      onRecipeGenerated();
      
      // Clear chat and localStorage after successful creation
      setMessages([]);
      try {
        localStorage.removeItem('salt-ai-chat');
      } catch (err) {
        console.error('Failed to clear persisted chat', err);
      }
    } catch (err) {
      console.error('Finalisation error:', err);
      softToast.error('Failed to create recipe', { description: 'Please try again' });
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleImport = async () => {
    const url = urlInput.trim();
    if (!url || isProcessing) return;
    
    setShowImportDialog(false);
    setIsProcessing(true);
    setProcessStatus('Importing recipe...');
    
    try {
      const importedRecipe = await recipesBackend.importRecipeFromUrl(url);
      
      setProcessStatus('Generating photograph...');
      const imageData = await recipesBackend.generateRecipeImage(
        importedRecipe.title || 'Dish',
        importedRecipe.description
      );
      
      setProcessStatus('Saving recipe...');
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
      
      softToast.success('Recipe imported', { description: importedRecipe.title });
      setUrlInput('');
      onRecipeGenerated();
    } catch (err) {
      console.error('Import error:', err);
      softToast.error('Import failed', { description: 'Check the URL and try again' });
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const hasConversation = messages.length > 0;

  return (
    <>
      <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-160px)] flex flex-col animate-in fade-in duration-500">
        <Card className="flex-1 flex flex-col overflow-hidden shadow-md">
          <CardHeader className="px-4 py-4 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Recipe Chat
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Discuss ingredients and methods, then finalise
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowImportDialog(true)}
                disabled={isProcessing}
                className="shrink-0"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <Separator />

          {/* Messages */}
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {!hasConversation && (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Start a conversation about your recipe ideas
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
                
                {isProcessing && processStatus && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {processStatus}
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
              <div className="pt-2 pb-1">
                <Button
                  onClick={handleFinalise}
                  disabled={isProcessing}
                  size="lg"
                  className="w-full shadow-sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalise & Create Recipe
                </Button>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                placeholder="Discuss your recipe..."
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
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Recipe from URL</DialogTitle>
            <DialogDescription>
              Enter the web address of a recipe to import it into Salt
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-url">Recipe URL</Label>
              <Input
                id="import-url"
                placeholder="https://example.com/recipe"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && urlInput.trim()) {
                    handleImport();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!urlInput.trim()}
            >
              Import Recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
