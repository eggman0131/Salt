import React, { RefObject, FormEvent } from 'react';
import { Recipe } from '../../types/contract';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface RecipeChefSidebarProps {
  recipe: Recipe;
  messages: Message[];
  chatInput: string;
  isTyping: boolean;
  isUpdating: boolean;
  pendingProposals: any;
  chatScrollRef: RefObject<HTMLDivElement>;
  onSendMessage: (e: FormEvent) => void;
  onChatInputChange: (text: string) => void;
  onApplyUpdate: () => void;
  onHistoryClick: () => void;
  renderMarkdown: (text: string) => { __html: string };
  isMobile?: boolean;
}

export const RecipeChefSidebar: React.FC<RecipeChefSidebarProps> = ({
  recipe,
  messages,
  chatInput,
  isTyping,
  isUpdating,
  pendingProposals,
  chatScrollRef,
  onSendMessage,
  onChatInputChange,
  onApplyUpdate,
  onHistoryClick,
  renderMarkdown,
  isMobile = false,
}) => {
  const containerClass = isMobile
    ? "md:hidden flex-1 overflow-hidden flex flex-col min-h-0 h-full"
    : "hidden md:flex w-full md:w-1/3 flex-col overflow-hidden border-l border-gray-200 bg-gray-50 min-h-0";

  const messageContainerClass = isMobile
    ? "flex-1 overflow-y-auto p-4 md:p-6 space-y-3 pb-[120px] md:pb-6"
    : "flex-1 overflow-y-auto p-4 md:p-6 space-y-3";

  const formContainerStyle = isMobile
    ? { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', marginBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }
    : { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' };

  const formContainerClass = isMobile
    ? "border-t border-gray-200 bg-gray-50 p-3 md:p-4 space-y-2"
    : "border-t border-gray-200 bg-gray-50 p-3 md:p-4 space-y-2 mb-16 md:mb-0";

  return (
    <div className={containerClass}>
      <div className="px-4 md:px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-sm">Chef's Advice</h3>
        <button
          onClick={onHistoryClick}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="View history"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />
          </svg>
        </button>
      </div>
      <div ref={chatScrollRef} className={messageContainerClass}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`markdown-body max-w-xs px-4 py-2 rounded-lg text-sm ${
                m.role === 'user'
                  ? 'bg-orange-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
              dangerouslySetInnerHTML={renderMarkdown(m.text)}
            />
          </div>
        ))}
        {isTyping && <p className="text-xs text-gray-500 italic px-4">Thinking...</p>}
      </div>

      <div
        className={formContainerClass}
        style={formContainerStyle}
      >
        {messages.length > 0 && !pendingProposals && (
          <button
            onClick={onApplyUpdate}
            disabled={isUpdating || isTyping}
            className="w-full h-9 text-sm bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {isUpdating ? 'Processing...' : 'Process Changes'}
          </button>
        )}
        <form onSubmit={onSendMessage} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            placeholder="Ask the chef..."
            className="flex-1 h-10 px-3 rounded-lg bg-white border border-gray-300 text-sm focus:border-orange-500 focus:outline-none disabled:bg-gray-100 cursor-text"
            disabled={isTyping || isUpdating || !!pendingProposals}
          />
          <button
            type="submit"
            disabled={!chatInput || isTyping || isUpdating || !!pendingProposals}
            className="w-10 h-10 bg-orange-600 text-white rounded-lg flex items-center justify-center hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.98721575 L3.03521743,10.4282088 C3.03521743,10.5853061 3.34915502,10.7424035 3.50612381,10.7424035 L16.6915026,11.5278905 C16.6915026,11.5278905 17.1624089,11.5278905 17.1624089,12.0031827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
};
