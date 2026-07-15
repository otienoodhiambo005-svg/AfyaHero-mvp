/**
 * Speech & Voice Service
 * 
 * Handles speech-to-text (STT) and text-to-speech (TTS) using Azure AI Speech Services
 * or browser Web Speech API as fallback.
 */

import logger from '@/lib/logger';

type WebSpeechRecognition = {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type WebSpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type WebSpeechRecognitionErrorEvent = {
  error: string;
};

export type VoiceLanguage = 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE' | 'it-IT' | 'pt-BR' | 'ja-JP' | 'zh-CN';

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  language: VoiceLanguage;
}

export interface TextToSpeechOptions {
  language?: VoiceLanguage;
  rate?: number; // 0.5 to 2.0
  pitch?: number; // 0.5 to 2.0
  volume?: number; // 0 to 1
}

interface SpeechError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Speech Service - Handles voice input/output
 */
class SpeechService {
  private recognition: WebSpeechRecognition | null = null;

  private synthesis: SpeechSynthesis | null = null;

  private isListening = false;

  private useAzure = false;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    this.initializeSpeechRecognition();
  }

  /**
   * Initialize speech recognition API
   */
  private initializeSpeechRecognition() {
    if (typeof window === 'undefined') {
      this.useAzure = true;
      return;
    }

    try {
      // Try to use Web Speech API first (available in Chrome, Edge)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.useAzure = false;
        // console.log('✅ Web Speech API initialized');
      } else {
        // console.warn('⚠️ Web Speech API not available, will use Azure Speech Services');
        this.useAzure = true;
      }
    } catch (error) {
      // console.error('❌ Speech API initialization failed:', error);
      this.useAzure = true;
    }
  }

  /**
   * Start listening for voice input
   */
  async startListening(
    language: VoiceLanguage = 'en-US',
    onResult?: (result: SpeechRecognitionResult) => void,
    onError?: (error: SpeechError) => void
  ): Promise<void> {
    if (this.isListening) {
      return;
    }

    this.isListening = true;

    if (this.useAzure) {
      await this.startAzureListening(language, onResult, onError);
    } else {
      this.startWebSpeechListening(language, onResult, onError);
    }
  }

  /**
   * Start listening using Web Speech API
   */
  private startWebSpeechListening(
    language: VoiceLanguage,
    onResult?: (result: SpeechRecognitionResult) => void,
    onError?: (error: SpeechError) => void
  ) {
    if (!this.recognition) return;

    this.recognition.language = language;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      // console.log('🎤 Listening...');
    };

    this.recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }

        if (onResult) {
          onResult({
            text: finalTranscript || interimTranscript,
            confidence: confidence,
            isFinal: event.results[i].isFinal,
            language
          });
        }
      }
    };

    this.recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      const error: SpeechError = {
        code: event.error,
        message: this.getErrorMessage(event.error)
      };
      if (onError) {
        onError(error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      // console.log('🎤 Stopped listening');
    };

    this.recognition.start();
  }

  /**
   * Start listening using Azure Speech Services
   */
  private async startAzureListening(
    language: VoiceLanguage,
    onResult?: (result: SpeechRecognitionResult) => void,
    onError?: (error: SpeechError) => void
  ) {
    try {
      const response = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'recognize', language, action: 'start' })
      });

      if (!response.ok) {
        throw new Error('Failed to start Azure speech recognition');
      }

      // In production, you'd handle streaming audio to Azure
      const result = await response.json();
      if (onResult) {
        onResult({
          text: result.text,
          confidence: result.confidence || 0.8,
          isFinal: true,
          language
        });
      }

      this.isListening = false;
    } catch (error) {
      if (onError) {
        onError({
          code: 'AZURE_ERROR',
          message: String(error)
        });
      }
      this.isListening = false;
    }
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(
    text: string,
    options: TextToSpeechOptions = {}
  ): Promise<void> {
    const {
      language = 'en-US',
      rate = 1.0,
      pitch = 1.0,
      volume = 1.0
    } = options;

    if (this.useAzure) {
      await this.azureTextToSpeech(text, language);
    } else {
      this.webSpeechTextToSpeech(text, rate, pitch, volume);
    }
  }

  /**
   * Text to speech using Web Speech API
   */
  private webSpeechTextToSpeech(
    text: string,
    rate: number,
    pitch: number,
    volume: number
  ) {
    if (typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Text to speech using Azure Speech Services
   */
  private async azureTextToSpeech(
    text: string,
    language: VoiceLanguage
  ) {
    try {
      const response = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'synthesize', text, language })
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
    } catch (error) {
      logger.error('Text to speech failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Check if speech input is currently active
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Get error message for speech error code
   */
  private getErrorMessage(errorCode: string): string {
    const messages: { [key: string]: string } = {
      'no-speech': 'No speech detected. Please try again.',
      'audio-capture': 'No microphone found. Please check your audio input.',
      'network': 'Network error. Please check your connection.',
      'not-allowed': 'Microphone access denied. Please enable microphone permissions.',
      'bad-grammar': 'Speech recognition error. Please try again.',
      'service-not-allowed': 'Speech service not available.',
      'aborted': 'Speech recognition was aborted.',
      'service-unavailable': 'Speech service is unavailable.'
    };

    return messages[errorCode] || 'An error occurred during speech recognition.';
  }

  /**
   * Check if voice input is supported
   */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }

  /**
   * Check if text-to-speech is supported
   */
  static isSpeechSynthesisSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  /**
   * Get available languages
   */
  static getAvailableLanguages(): { code: VoiceLanguage; name: string }[] {
    return [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'es-ES', name: 'Spanish' },
      { code: 'fr-FR', name: 'French' },
      { code: 'de-DE', name: 'German' },
      { code: 'it-IT', name: 'Italian' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' }
    ];
  }
}

// Export singleton instance
export const speechService = new SpeechService();

export default SpeechService;
