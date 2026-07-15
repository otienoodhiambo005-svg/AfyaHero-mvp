'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  Loader2,
  AlertCircle,
  ChevronDown,
  Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { speechService, VoiceLanguage, SpeechRecognitionResult } from '@/lib/speech-service';
import SpeechService from '@/lib/speech-service';

export interface VoiceTextInputProps {
  /** Placeholder text for input */
  placeholder?: string;
  
  /** Callback when text is submitted */
  onSubmit: (text: string) => void | Promise<void>;
  
  /** Callback for voice results */
  onVoiceResult?: (text: string) => void;
  
  /** Callback for errors */
  onError?: (error: string) => void;
  
  /** Custom className */
  className?: string;
  
  /** Allow voice input */
  allowVoice?: boolean;
  
  /** Allow text-to-speech output */
  allowSpeechOutput?: boolean;
  
  /** Default language */
  language?: VoiceLanguage;
  
  /** Max characters */
  maxLength?: number;
  
  /** Is disabled */
  disabled?: boolean;
  
  /** Initial text */
  initialText?: string;
  
  /** Show character count */
  showCharCount?: boolean;
  
  /** Variant: 'compact' or 'full' */
  variant?: 'compact' | 'full';
  
  /** Suggestion pills */
  suggestions?: string[];
  
  /** On suggestion click */
  onSuggestionClick?: (suggestion: string) => void;
}

export default function VoiceTextInput({
  placeholder = 'Type or speak...',
  onSubmit,
  onVoiceResult,
  onError,
  className,
  allowVoice = true,
  allowSpeechOutput = false,
  language = 'en-US',
  maxLength = 500,
  disabled = false,
  initialText = '',
  showCharCount = true,
  variant = 'full',
  suggestions = [],
  onSuggestionClick
}: VoiceTextInputProps) {
  const [text, setText] = useState(initialText);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [showLanguages, setShowLanguages] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);

  // Request microphone permission on mount
  useEffect(() => {
    if (allowVoice && navigator.permissions) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .catch(() => {
          // Permission API not available
        });
    }
  }, [allowVoice]);

  /**
   * Start voice input
   */
  const handleStartListening = async () => {
    setError(null);
    setInterim('');

    try {
      setIsListening(true);

      await speechService.startListening(
        selectedLanguage,
        (result: SpeechRecognitionResult) => {
          setInterim(result.text);

          if (result.isFinal) {
            const newText = text + (text ? ' ' : '') + result.text;
            setText(newText);
            if (onVoiceResult) {
              onVoiceResult(result.text);
            }
            setIsListening(false);
          }
        },
        (error: any) => {
          setError(error.message);
          setIsListening(false);
          if (onError) {
            onError(error.message);
          }
        }
      );
    } catch (error) {
      const errorMsg = String(error);
      setError(errorMsg);
      setIsListening(false);
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  /**
   * Stop voice input
   */
  const handleStopListening = () => {
    speechService.stopListening();
    setIsListening(false);
    setInterim('');
  };

  /**
   * Handle text submission
   */
  const handleSubmit = async () => {
    if (!text.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(text);
      setText('');
      setInterim('');
    } catch (error) {
      const errorMsg = String(error);
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle text-to-speech
   */
  const handleSpeak = async () => {
    if (!text.trim()) return;

    setIsSpeaking(true);
    setError(null);

    try {
      await speechService.textToSpeech(text, {
        language: selectedLanguage
      });
    } catch (error) {
      const errorMsg = String(error);
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setIsSpeaking(false);
    }
  };

  /**
   * Handle suggestion click
   */
  const handleSuggestion = (suggestion: string) => {
    setText(suggestion);
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    }
    textInputRef.current?.focus();
  };

  /**
   * Toggle language dropdown
   */
  const handleLanguageChange = (lang: VoiceLanguage) => {
    setSelectedLanguage(lang);
    setShowLanguages(false);
  };

  const isVoiceSupported = typeof window !== 'undefined' && SpeechService.isSupported();
  const isSpeechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canVoice = allowVoice && isVoiceSupported && !disabled;
  const canSpeak = allowSpeechOutput && isSpeechSynthesisSupported && text.trim().length > 0 && !disabled;

  const displayText = text + interim;
  const charCount = displayText.length;
  const isOverLimit = charCount > maxLength;

  const languages = [
    { code: 'en-US' as VoiceLanguage, name: 'English (US)' },
    { code: 'en-GB' as VoiceLanguage, name: 'English (UK)' },
    { code: 'es-ES' as VoiceLanguage, name: 'Spanish' },
    { code: 'fr-FR' as VoiceLanguage, name: 'French' },
    { code: 'de-DE' as VoiceLanguage, name: 'German' },
    { code: 'ja-JP' as VoiceLanguage, name: 'Japanese' }
  ];

  return (
    <div className={cn('space-y-3', className)}>
      {/* Language Selector */}
      {canVoice && (
        <div className="relative">
          <button
            onClick={() => setShowLanguages(!showLanguages)}
            className="px-3 py-1 text-xs bg-forest/40 border border-white/5 rounded-lg text-mist hover:text-white hover:border-white/10 transition flex items-center gap-2"
          >
            <span>{selectedLanguage}</span>
            <ChevronDown className={cn('w-3 h-3 transition', showLanguages && 'rotate-180')} />
          </button>

          {showLanguages && (
            <div className="absolute top-full left-0 mt-2 bg-forest border border-white/10 rounded-lg shadow-lg z-10 w-full max-w-xs">
              {languages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    'w-full text-left px-4 py-2 hover:bg-content-bg/5 transition text-sm',
                    selectedLanguage === lang.code ? 'bg-emerald/20 text-emerald' : 'text-mist'
                  )}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Input Area */}
      <div className={cn(
        'border rounded-card transition',
        error ? 'border-rose-500/50 bg-rose-500/5' :
        isListening ? 'border-emerald/50 bg-emerald/5' :
        'border-white/10 bg-forest/40 hover:border-white/20'
      )}>
        {/* Textarea */}
        <textarea
          ref={textInputRef}
          value={displayText}
          onChange={(e) => {
            const newText = e.target.value.slice(0, maxLength);
            setText(newText);
            setInterim('');
          }}
          placeholder={placeholder}
          disabled={disabled || isListening}
          className={cn(
            'w-full p-4 bg-transparent text-white placeholder:text-sage resize-none focus:outline-none',
            variant === 'compact' ? 'min-h-[50px] max-h-[100px]' : 'min-h-[120px] max-h-[300px]'
          )}
        />

        {/* Interim Text Indicator */}
        {interim && (
          <div className="px-4 pb-2 text-sm text-emerald/60 italic">
            {interim}
          </div>
        )}

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            {/* Mic Button */}
            {canVoice ? (
              <button
                ref={micButtonRef}
                onClick={isListening ? handleStopListening : handleStartListening}
                disabled={disabled || isSubmitting}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  isListening
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-sage hover:text-white hover:bg-content-bg/5 border border-white/5'
                )}
                title={isListening ? 'Stop listening' : 'Start listening'}
              >
                {isListening ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            ) : (
              <button
                disabled
                className="p-2 rounded-lg text-sage/40 opacity-50"
                title="Voice input not supported"
              >
                <MicOff className="w-5 h-5" />
              </button>
            )}

            {/* Speaker Button */}
            {canSpeak ? (
              <button
                onClick={handleSpeak}
                disabled={isSpeaking || disabled}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  isSpeaking
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-sage hover:text-white hover:bg-content-bg/5 border border-white/5'
                )}
                title="Speak text"
              >
                {isSpeaking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
            ) : null}

            {/* Character Count */}
            {showCharCount && (
              <span className={cn(
                'text-xs ml-2',
                isOverLimit ? 'text-rose-400' : 'text-sage'
              )}>
                {charCount}/{maxLength}
              </span>
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || disabled || isSubmitting || isOverLimit}
            className={cn(
              'p-2 rounded-lg transition-all',
              text.trim() && !isOverLimit && !disabled
                ? 'bg-emerald text-white hover:bg-emerald/90'
                : 'bg-content-bg/5 text-sage/40'
            )}
            title="Submit"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && !text.trim() && (
        <div className="space-y-2">
          <p className="text-xs text-sage font-bold uppercase tracking-wide">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestion(suggestion)}
                disabled={disabled}
                className="px-3 py-1.5 text-sm bg-emerald/10 border border-emerald/20 text-emerald rounded-lg hover:bg-emerald/20 hover:border-emerald/30 transition disabled:opacity-50"
              >
                <Wand2 className="w-3 h-3 inline mr-1" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Text */}
      <p className="text-xs text-sage/60">
        {canVoice ? '🎤 Click mic to speak or type your message' : 'Type your message below'}
        {canSpeak && ' • 🔊 Click speaker to hear the text'}
      </p>
    </div>
  );
}
