'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { 
  Paperclip, 
  Image as ImageIcon, 
  Mic, 
  Send, 
  X, 
  FileText, 
  Square,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

export interface MultiModalPayload {
  text: string;
  files: File[];
  audio?: Blob;
}

interface MultiModalInputProps {
  onSend: (payload: MultiModalPayload) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiModalInput({
  onSend,
  placeholder = "Type a message or record audio...",
  disabled = false,
  className
}: MultiModalInputProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSend = useCallback(() => {
    if (!text.trim() && files.length === 0) return;
    
    onSend({
      text: text.trim(),
      files,
    });
    
    setText('');
    setFiles([]);
  }, [text, files, onSend]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        onSend({ text: '[Audio Message]', files: [], audio: audioBlob });
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      logger.error('Failed to start recording', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("flex flex-col gap-2 p-2 bg-content-bg/5 rounded-3xl border border-white/10 shadow-inner group focus-within:border-primary/30 transition-all", className)}>
      {/* Previews */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-2 px-3 pt-2"
          >
            {files.map((file, i) => (
              <motion.div 
                key={`${file.name}-${i}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative group/file"
              >
                <div className="w-16 h-16 rounded-card bg-content-bg/10 border border-white/10 flex items-center justify-center overflow-hidden">
                  {file.type.startsWith('image/') ? (
                    <Image 
                      src={URL.createObjectURL(file)} 
                      alt={`Preview of uploaded file: ${file.name}`}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-6 h-6 text-white/40" />
                  )}
                </div>
                <button 
                  onClick={() => removeFile(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 px-2 py-1">
        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-rose-500/10 rounded-card border border-rose-500/20">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-mono font-bold text-rose-500">Recording... {formatTime(recordingTime)}</span>
            <button 
              onClick={stopRecording}
              className="ml-auto w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center hover:bg-rose-600 transition-colors"
            >
              <Square className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ) : (
          <>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx"
            />
            
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-white/40 hover:text-white hover:bg-content-bg/5 rounded-card transition-all active:scale-95"
              title="Attach files"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={disabled}
                placeholder={placeholder}
                rows={1}
                className="w-full bg-transparent border-none text-sm text-white placeholder:text-white/20 py-3 px-1 outline-none resize-none max-h-32 custom-scrollbar font-medium"
              />
            </div>

            <div className="flex items-center gap-1 self-center">
              <button 
                type="button"
                onClick={startRecording}
                className="p-3 text-white/40 hover:text-rose-400 hover:bg-rose-500/5 rounded-card transition-all active:scale-95"
                title="Record audio"
              >
                <Mic className="w-5 h-5" />
              </button>
              
              <button 
                type="button"
                onClick={handleSend}
                disabled={disabled || (!text.trim() && files.length === 0)}
                className="p-3 bg-primary text-white rounded-card transition-all active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100 hover:shadow-lg hover:shadow-primary/20"
                style={{ background: '#2563EB' }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
