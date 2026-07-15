'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import NextImage from 'next/image';
import {
  Loader2,
  MessageCircle,
  Sparkles,
  Volume2,
  Volume,
  RotateCcw,
  Paperclip,
  Image,
  File,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import VoiceTextInput from '@/components/shared/VoiceTextInput';
import logger from '@/lib/logger';

// File attachment types
export interface FileAttachment {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  preview?: string; // For images
  base64?: string; // For sending to API
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  spoken?: boolean;
  attachments?: FileAttachment[];
}

interface AIConversationPanelProps {
  title?: string;
  subtitle?: string;
  onAnalyze?: (prompt: string, files?: FileAttachment[]) => Promise<string>;
  allowVoice?: boolean;
  allowSpeechOutput?: boolean;
  allowFileUpload?: boolean;
  systemPrompt?: string;
  suggestionTemplates?: string[];
  className?: string;
  maxFileSizeMB?: number;
  allowedFileTypes?: string[];
}

export default function AIConversationPanel({
  title = 'AI Assistant',
  subtitle = 'Ask questions or request analysis',
  onAnalyze,
  allowVoice = true,
  allowSpeechOutput = true,
  allowFileUpload = true,
  systemPrompt,
  suggestionTemplates = [
    'Analyze current inventory',
    'Generate cost report',
    'Identify expired items',
    'Optimize stock levels'
  ],
  className,
  maxFileSizeMB = 10,
  allowedFileTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
}: AIConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Scroll to bottom of messages
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Process uploaded files
   */
  const processFiles = useCallback(async (files: File[]) => {
    setUploadError(null);
    const maxSizeBytes = maxFileSizeMB * 1024 * 1024;
    const newAttachments: FileAttachment[] = [];

    for (const file of files) {
      // Check file size
      if (file.size > maxSizeBytes) {
        setUploadError(`${file.name} is too large (max ${maxFileSizeMB}MB)`);
        continue;
      }

      // Check file type
      if (!allowedFileTypes.includes(file.type) && !allowedFileTypes.includes('*')) {
        setUploadError(`${file.name} is not a supported file type`);
        continue;
      }

      const attachment: FileAttachment = {
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        type: file.type,
        size: file.size,
      };

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        try {
          const preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          attachment.preview = preview;
          // Also get base64 for API
          attachment.base64 = preview.split(',')[1];
        } catch {
          // No preview available
        }
      } else if (file.type === 'application/pdf' || file.type === 'text/plain') {
        // Get text content for documents
        try {
          const text = await file.text();
          attachment.base64 = btoa(text);
        } catch {
          // No content available
        }
      }

      newAttachments.push(attachment);
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  }, [maxFileSizeMB, allowedFileTypes]);

  /**
   * Handle file input change
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input
    }
  }, [processFiles]);

  /**
   * Handle drag and drop
   */
   const _handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

  const _handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Remove attachment
   */
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  /**
   * Clear all attachments
   */
  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  /**
   * Handle message submission with attachments
   */
  const handleSubmit = async (text: string) => {
    if (!text.trim() && attachments.length === 0) return;

    // Add user message with attachments
    const userMessage: Message = {
      id: Math.random().toString(36),
      role: 'user',
      content: text,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Store attachments for API call and then clear
    const currentAttachments = [...attachments];
    setAttachments([]);
    setUploadError(null);

    try {
      let response = '';

      if (onAnalyze) {
        response = await onAnalyze(text, currentAttachments);
      } else {
        // Use multipart form data if we have files
        if (currentAttachments.length > 0) {
          const formData = new FormData();
          formData.append('message', text);
          if (systemPrompt) formData.append('systemPrompt', systemPrompt);
          formData.append('conversationHistory', JSON.stringify(messages));
          
          // Append files
          for (const attachment of currentAttachments) {
            formData.append('files', attachment.file);
          }

          const result = await fetch('/api/ai/chat', {
            method: 'POST',
            body: formData,
          });

          if (!result.ok) {
            const errorData = await result.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to get response (${result.status})`);
          }
          const data = await result.json();
          response = data.message || data.response || 'No response generated';
        } else {
          // JSON request for text-only
          const result = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
              systemPrompt,
              conversationHistory: messages
            })
          });

          if (!result.ok) {
            const errorData = await result.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to get response (${result.status})`);
          }
          const data = await result.json();
          response = data.message || data.response || 'No response generated';
        }
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: Math.random().toString(36),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-speak response if enabled
      if (allowSpeechOutput) {
        await speakMessage(assistantMessage);
      }
    } catch (error) {
      // Add error message
      const errorMessage: Message = {
        id: Math.random().toString(36),
        role: 'assistant',
        content: `❌ Error: ${String(error)}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Speak a message
   */
  const speakMessage = async (message: Message) => {
    setSpeakingMessageId(message.id);

    try {
      const response = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'synthesize',
          text: message.content,
          language: 'en-US'
        })
      });

      if (!response.ok) throw new Error('Failed to generate speech');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setSpeakingMessageId(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.play();

      setMessages(prev =>
        prev.map(msg =>
          msg.id === message.id ? { ...msg, spoken: true } : msg
        )
      );
    } catch (error) {
      logger.error('Speech error', { error, messageId: message.id });
      setSpeakingMessageId(null);
    }
  };

  /**
   * Clear conversation
   */
  const handleClear = () => {
    if (confirm('Clear conversation history?')) {
      setMessages([]);
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-forest/40 border border-white/10 rounded-card overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-forest/60 border-b border-white/5 px-6 py-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald" />
          {title}
        </h3>
        <p className="text-sm text-sage mt-1">{subtitle}</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-12 h-12 text-sage/40 mb-4" />
            <p className="text-sage font-medium">Start a conversation</p>
            <p className="text-xs text-sage/60 mt-2">Ask questions or request analysis</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3 animate-fadeIn',
                message.role === 'assistant' ? 'justify-start' : 'justify-end'
              )}
            >
              <div
                className={cn(
                  'max-w-xs lg:max-w-md px-4 py-3 rounded-lg',
                  message.role === 'assistant'
                    ? 'bg-forest border border-white/10'
                    : 'bg-emerald/20 border border-emerald/30'
                )}
              >
                <p className="text-sm text-white whitespace-pre-wrap break-words">
                  {message.content}
                </p>

                {message.role === 'assistant' && allowSpeechOutput && (
                  <button
                    onClick={() => speakMessage(message)}
                    disabled={speakingMessageId !== null}
                    className={cn(
                      'mt-2 p-1 rounded transition',
                      speakingMessageId === message.id
                        ? 'bg-emerald/30 text-emerald'
                        : 'bg-content-bg/5 text-sage hover:bg-content-bg/10 hover:text-white'
                    )}
                    title="Speak message"
                  >
                    {speakingMessageId === message.id ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <Volume className="w-4 h-4" />
                    )}
                  </button>
                )}

                <span className="text-xs text-sage/60 mt-2 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="bg-forest border border-white/10 px-4 py-3 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-emerald" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-white/5 p-6 space-y-4">
        {/* Suggestions */}
        {messages.length === 0 && suggestionTemplates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-sage font-bold uppercase tracking-wide">Try asking:</p>
            <div className="grid grid-cols-2 gap-2">
              {suggestionTemplates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    // Trigger input focusing would be ideal here
                    handleSubmit(template);
                  }}
                  disabled={isLoading}
                  className="px-3 py-2 text-xs bg-emerald/10 border border-emerald/20 text-emerald rounded-lg hover:bg-emerald/20 hover:border-emerald/30 transition disabled:opacity-50"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upload Error */}
        {uploadError && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p className="text-sm text-rose-200">{uploadError}</p>
            <button
              onClick={() => setUploadError(null)}
              className="ml-auto text-rose-400 hover:text-rose-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attached Files Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group flex items-center gap-2 bg-forest/60 border border-white/10 rounded-lg px-3 py-2 max-w-xs"
              >
                {attachment.preview ? (
                  <NextImage
                    src={attachment.preview}
                    alt={attachment.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-10 bg-content-bg/5 rounded flex items-center justify-center">
                    {attachment.type.startsWith('image/') ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image className="w-5 h-5 text-sage" aria-hidden="true" />
                    ) : (
                      <File className="w-5 h-5 text-sage" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">
                    {attachment.name}
                  </p>
                  <p className="text-[10px] text-sage/60">
                    {(attachment.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="text-sage/60 hover:text-rose-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={clearAttachments}
              className="text-xs text-sage/60 hover:text-rose-400 transition-colors px-2"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Voice + Text Input with File Upload */}
        <div className="relative">
          {/* File Upload Button */}
          {allowFileUpload && (
            <div className="relative inline-block">
              <button
                onClick={() => setShowUploadMenu(!showUploadMenu)}
                disabled={isLoading}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-lg text-sage hover:text-white hover:bg-content-bg/5 border border-white/5 transition disabled:opacity-50"
                title="Attach files"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Upload Menu */}
              {showUploadMenu && (
                <div className="absolute left-0 bottom-full mb-2 bg-forest border border-white/10 rounded-card shadow-xl z-20 w-full max-w-xs overflow-hidden">
                  <div className="p-2">
                    <p className="text-xs text-sage font-bold uppercase tracking-wide px-2 py-1">
                      Attach Files
                    </p>
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowUploadMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-content-bg/5 rounded-lg transition"
                    >
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image className="w-4 h-4 text-sage" aria-hidden="true" />
                      <span>Images</span>
                    </button>
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowUploadMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-content-bg/5 rounded-lg transition"
                    >
                      <File className="w-4 h-4 text-sage" />
                      <span>Documents</span>
                    </button>
                  </div>
                  <div className="border-t border-white/5 p-2">
                    <p className="text-[10px] text-sage/60 px-2">
                      Max {maxFileSizeMB}MB per file
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedFileTypes.join(',')}
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Voice Text Input - adjusted for file button */}
          <div className={allowFileUpload ? 'pl-14' : ''}>
            <VoiceTextInput
              placeholder="Ask a question or describe what you need..."
              onSubmit={handleSubmit}
              onError={(error) => logger.error('Input error', { error })}
              allowVoice={allowVoice}
              allowSpeechOutput={false}
              variant="compact"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Clear Button */}
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="w-full px-4 py-2 text-sm bg-content-bg/5 text-sage hover:bg-content-bg/10 hover:text-white border border-white/5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Clear Conversation
          </button>
        )}
      </div>
    </div>
  );
}
