import { useState, useEffect, useCallback, useRef } from 'react';
import logger from '@/lib/logger';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export function useAfyaAIChat(endpoint: string = '/v1/ai/triage/ws', accessToken?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    // We assume NEXT_PUBLIC_WS_URL or fallback is available
    const wsUrlBase = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';
    let fullUrl = `${wsUrlBase}${endpoint}`;

    if (accessToken) {
      fullUrl += `?token=${encodeURIComponent(accessToken)}`;
    }

    setStatus('connecting');
    const ws = new WebSocket(fullUrl);

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handling LangGraph streamed responses or processing states
        if (data.status === 'processing' || data.status === 'complete') {
            // Usually AI updates would stream chunks, we append them here
            // This is a minimal implementation, tailor to actual JSON struct.
            if (data.message || data.diagnoses) {
                 const newMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    sender: 'ai',
                    text: data.message || JSON.stringify(data.diagnoses),
                    timestamp: new Date()
                 };
                 setMessages(prev => [...prev, newMsg]);
            }
        }
      } catch (err) {
        logger.error('Failed to parse WebSocket message', { error: err instanceof Error ? err.message : String(err) });
      }
    };

    ws.onerror = (error) => {
      logger.error('WebSocket connection error', { error: String(error) });
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('idle');
    };

    wsRef.current = ws;
  }, [endpoint, accessToken]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((payload: { text: string; [key: string]: unknown }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      
      // Optionally optimistically add user message 
      // (assuming payload contains raw text if it's a chat prompt)
      if (payload.text) {
          setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              sender: 'user',
              text: payload.text,
              timestamp: new Date()
          }]);
      }
    } else {
      logger.warn('Attempted to send message but WebSocket is not connected');
    }
  }, []);

  // Optional: Auto-connect on mount if session is active
  useEffect(() => {
    if (accessToken && status === 'idle') {
      // Defer connect to avoid synchronous setState in effect
      setTimeout(() => connect(), 0);
    }
    return () => {
      disconnect();
    };
  }, [accessToken, connect, disconnect, status]);

  return {
    messages,
    status,
    connect,
    disconnect,
    sendMessage
  };
}
