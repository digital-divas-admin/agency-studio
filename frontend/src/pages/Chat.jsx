/**
 * AI Chat Page
 * Chat with AI for captioning and image Q&A
 * REST-only — no Socket.IO
 */

import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Send,
  ImagePlus,
  X,
  Zap,
  Bot,
  User,
  Loader2,
} from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary' : 'bg-surface-elevated'
      }`}>
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'text-right' : ''}`}>
        {/* Attached images */}
        {message.images?.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap justify-end">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt=""
                className="h-24 w-24 object-cover rounded-lg border border-border"
              />
            ))}
          </div>
        )}
        <div className={`inline-block rounded-xl px-4 py-2.5 ${
          isUser
            ? 'bg-primary text-white'
            : 'bg-surface-elevated text-text'
        }`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.creditsUsed && (
          <p className="text-xs text-text-muted mt-1">
            {message.creditsUsed} credits used
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function ChatPage() {
  const { credits, refreshCredits } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Handle incoming image from SendToMenu via location.state
  useEffect(() => {
    if (location.state?.image) {
      setAttachedImages((prev) => [...prev, location.state.image].slice(0, 4));
      // Clear location state so refreshing doesn't re-trigger
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleImageAttach = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (attachedImages.length >= 4) break;
      const dataUrl = await fileToDataUrl(file);
      setAttachedImages((prev) => [...prev, dataUrl].slice(0, 4));
    }
    e.target.value = '';
  };

  const removeImage = (index) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && attachedImages.length === 0) return;
    if (loading) return;

    const userMessage = {
      role: 'user',
      content: text || '(image attached)',
      images: [...attachedImages],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setAttachedImages([]);
    setLoading(true);

    try {
      // Build conversation history for context (last 20 messages, text only)
      const history = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const data = await api.sendChat({
        message: text || 'Describe this image',
        images: userMessage.images,
        conversationHistory: history,
      });

      const aiMessage = {
        role: 'assistant',
        content: data.response,
        creditsUsed: data.creditsUsed,
      };

      setMessages((prev) => [...prev, aiMessage]);
      refreshCredits();
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout>
      <PageHeader
        title="AI Chat"
        description="Chat with AI about images, get captions, and creative assistance"
        actions={
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Zap className="h-4 w-4 text-primary" />
            <span>2 credits per message</span>
          </div>
        }
      />

      <Card className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-16 w-16 text-text-muted mb-4" />
              <h3 className="text-lg font-semibold text-text mb-2">AI Assistant</h3>
              <p className="text-text-muted max-w-md">
                Ask questions, get image captions, or chat about creative ideas.
                Attach images for visual analysis and captioning.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-surface-elevated rounded-xl px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Attached Images Preview */}
        {attachedImages.length > 0 && (
          <div className="px-4 pb-2 flex gap-2">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt="" className="h-16 w-16 object-cover rounded-lg border border-border" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-elevated transition-colors flex-shrink-0"
              title="Attach image"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageAttach}
              className="hidden"
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Shift+Enter for new line)"
              rows={1}
              className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-text text-sm resize-none placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ minHeight: '42px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = '42px';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && attachedImages.length === 0)}
              className="p-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Card>
    </Layout>
  );
}
