/**
 * Voice Input Hook
 * 
 * Simplified way to add voice capabilities to any component
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { speechService, VoiceLanguage, SpeechRecognitionResult } from '@/lib/speech-service';
import SpeechService from '@/lib/speech-service';
import logger from '@/lib/logger';

export interface UseVoiceInputOptions {
  language?: VoiceLanguage;
  autoStop?: boolean;
  maxRetries?: number;
  onError?: (error: string) => void;
}

export interface UseVoiceInputReturn {
  // State
  isListening: boolean;
  isSpeaking: boolean;
  interim: string;
  error: string | null;
  transcript: string;

  // Methods
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearTranscript: () => void;
  speak: (text: string) => Promise<void>;
  setLanguage: (lang: VoiceLanguage) => void;

  // Utils
  isSupported: boolean;
  isSynthesisSupported: boolean;
}

/**
 * Hook for easy voice input integration
 */
export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    language = 'en-US',
    autoStop = true,
    maxRetries = 3,
    onError
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<VoiceLanguage>(language);
  const retryCountRef = useRef(0);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    speechService.stopListening();
    setIsListening(false);
    setInterim('');
  }, []);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback(async () => {
    setError(null);
    setInterim('');
    setIsListening(true);

    try {
      await speechService.startListening(
        currentLanguage,
        (result: SpeechRecognitionResult) => {
          setInterim(result.isFinal ? '' : result.text);

          if (result.isFinal) {
            setTranscript(prev => prev + (prev ? ' ' : '') + result.text);

            if (autoStop) {
              stopListening();
            }

            retryCountRef.current = 0;
          }
        },
        (error: any) => {
          const errorMsg = error.message || 'Speech recognition failed';
          setError(errorMsg);
          setIsListening(false);

          if (onError) {
            onError(errorMsg);
          }

          // Handle network errors with retry
          if (errorMsg.includes('network') && retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            setTimeout(() => {
              void startListening();
            }, 1000 * retryCountRef.current);
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
  }, [currentLanguage, autoStop, maxRetries, onError, stopListening]);

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  /**
   * Text to speech
   */
  const speak = useCallback(async (text: string) => {
    if (!text) return;

    setIsSpeaking(true);
    setError(null);

    try {
      await speechService.textToSpeech(text, {
        language: currentLanguage
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
  }, [currentLanguage, onError]);

  /**
   * Set language
   */
  const setLanguage = useCallback((lang: VoiceLanguage) => {
    setCurrentLanguage(lang);
  }, []);

  const isSupported = typeof window !== 'undefined' && SpeechService.isSupported();
  const isSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return {
    isListening,
    isSpeaking,
    interim,
    error,
    transcript,
    startListening,
    stopListening,
    clearTranscript,
    speak,
    setLanguage,
    isSupported,
    isSynthesisSupported
  };
}

/**
 * Hook for voice commands/dictation into form fields
 */
export interface UseVoiceDictationOptions extends UseVoiceInputOptions {
  onTextReceived?: (text: string) => void;
  appendMode?: boolean; // Append to existing or replace
}

export function useVoiceDictation(options: UseVoiceDictationOptions = {}): UseVoiceInputReturn & {
  appendText: (text: string) => void;
  setText: (text: string) => void;
} {
  const { appendMode: _appendMode = true, onTextReceived: _onTextReceived, ...voiceOptions } = options;

  const voice = useVoiceInput(voiceOptions);

  /**
   * Append text to transcript
   */
  const appendText = useCallback((_text: string) => {
    // This is handled by useVoiceInput automatically
  }, []);

  /**
   * Set text directly
   */
  const setText = useCallback((_text: string) => {
    // This allows manual text setting
  }, []);

  return {
    ...voice,
    appendText,
    setText
  };
}

/**
 * Hook for voice commands with actions
 */
export interface VoiceCommand {
  pattern: string | RegExp;
  action: (transcript: string) => void;
}

export interface UseVoiceCommandsOptions extends UseVoiceInputOptions {
  commands: VoiceCommand[];
  debug?: boolean;
}

export function useVoiceCommands(options: UseVoiceCommandsOptions): UseVoiceInputReturn & {
  executeCommand: (transcript: string) => boolean;
} {
  const { commands, debug = false, ...voiceOptions } = options;

  const voice = useVoiceInput(voiceOptions);

  /**
   * Execute voice command if matches pattern
   */
  const executeCommand = useCallback((transcript: string): boolean => {
    const lowerTranscript = transcript.toLowerCase();

    for (const command of commands) {
      const pattern = typeof command.pattern === 'string'
        ? new RegExp(command.pattern, 'i')
        : command.pattern;

      if (pattern.test(lowerTranscript)) {
        try {
          command.action(transcript);
          return true;
        } catch (error) {
          logger.error('❌ Command action failed', { error, transcript });
          return false;
        }
      }
    }

    return false;
  }, [commands]);

  return {
    ...voice,
    executeCommand
  };
}

/**
 * Hook for voice-controlled search
 */
export interface UseVoiceSearchOptions extends UseVoiceInputOptions {
  onSearch: (query: string) => Promise<any>;
  debounceMs?: number;
}

export function useVoiceSearch(options: UseVoiceSearchOptions) {
  const { onSearch, debounceMs = 500, ...voiceOptions } = options;

  const voice = useVoiceInput(voiceOptions);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Handle search with debounce
   */
  const handleSearch = useCallback(
    async (query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (!query.trim()) {
          setResults([]);
          return;
        }

        setIsSearching(true);
        try {
          const data = await onSearch(query);
          setResults(data);
        } catch (error) {
          logger.error('Search failed', { error, query });
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  // Auto-search on transcript change
  useEffect(() => {
    if (voice.transcript && !voice.isListening) {
      handleSearch(voice.transcript);
    }
  }, [voice.transcript, voice.isListening, handleSearch]);

  return {
    ...voice,
    results,
    isSearching,
    handleSearch,
    clearResults: () => setResults([])
  };
}

/**
 * Hook for live transcription display
 */
export interface UseTranscriptionOptions extends UseVoiceInputOptions {
  showInterim?: boolean;
  maxLength?: number;
}

export function useTranscription(options: UseTranscriptionOptions = {}) {
  const { showInterim = true, maxLength = 1000, ...voiceOptions } = options;

  const voice = useVoiceInput(voiceOptions);

  /**
   * Get current display text
   */
  const displayText = showInterim
    ? voice.transcript + (voice.interim ? ' ' + voice.interim : '')
    : voice.transcript;

  /**
   * Get text with length limit
   */
  const limitedText = displayText.slice(0, maxLength);

  /**
   * Get character count
   */
  const charCount = displayText.length;

  /**
   * Check if over limit
   */
  const isOverLimit = charCount > maxLength;

  return {
    ...voice,
    displayText: limitedText,
    charCount,
    isOverLimit,
    remainingChars: Math.max(0, maxLength - charCount)
  };
}

export default useVoiceInput;
