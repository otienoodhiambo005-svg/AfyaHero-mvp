'use client';

import { useState, useRef, useEffect } from 'react';
import { 
    Sparkles, 
    Send, 
    Bot, 
    User, 
    Loader2, 
    X, 
    Maximize2, 
    Minimize2, 
    BrainCircuit,
    ChevronRight,
    Command,
    Workflow
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    model?: string;
    provider?: string;
}

export function DawaAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Hello Dr. Amina. I'm **DAWA**, your clinical co-pilot. I have context on your current ward status and 12 active consultations. How can I assist you?",
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/ai/dawa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: input })
            });
            const data = await res.json();
            
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.answer || "I'm sorry, I'm having trouble connecting to the clinical knowledge base.",
                timestamp: new Date(),
                model: data.model,
                provider: data.provider
            }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "System alert: AI cascade failure. Please verify your network connection or consult local protocols.",
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn(
            "fixed bottom-8 right-8 z-[100] transition-all duration-500 ease-in-out",
            isOpen ? "w-[400px]" : "w-16 h-16"
        )}>
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        onClick={() => setIsOpen(true)}
                        className="w-16 h-16 rounded-[2rem] bg-ink text-white shadow-2xl flex items-center justify-center group border border-white/10 hover:border-portal-primary/50 transition-all hover:scale-110"
                    >
                        <BrainCircuit className="w-7 h-7 group-hover:text-portal-primary transition-colors" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-portal-primary rounded-full border-4 border-ink flex items-center justify-center">
                           <div className="w-1.5 h-1.5 bg-content-bg rounded-full animate-pulse" />
                        </div>
                    </motion.button>
                )}

                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={cn(
                            "bg-content-bg border rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden",
                            isExpanded ? "h-[800px] w-[600px] -translate-x-[200px]" : "h-[600px] w-full"
                        )}
                    >
                        {/* Header */}
                        <div className="p-6 bg-ink text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-card bg-portal-primary flex items-center justify-center shadow-lg shadow-portal-primary/20">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                        DAWA AI
                                        <span className="text-[10px] bg-content-bg/10 px-2 py-0.5 rounded-full text-portal-primary">ACTIVE</span>
                                    </h3>
                                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Autonomous Assistant</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-content-bg/10 rounded-card transition-colors">
                                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-rose-500/20 text-white hover:text-rose-500 rounded-card transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-content-surface/70"
                        >
                            {messages.map((msg, i) => (
                                <div key={i} className={cn(
                                    "flex gap-4 max-w-[85%]",
                                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                                )}>
                                    <div className={cn(
                                        "w-8 h-8 rounded-card flex items-center justify-center shrink-0 border",
                                        msg.role === 'user' ? "bg-content-bg border-content-border" : "bg-ink border-white/10"
                                    )}>
                                        {msg.role === 'user' ? <User className="w-4 h-4 text-slate" /> : <Bot className="w-4 h-4 text-white" />}
                                    </div>
                                    <div className="space-y-2">
                                        <div className={cn(
                                            "p-4 rounded-[1.5rem] text-sm leading-relaxed shadow-card",
                                            msg.role === 'user' 
                                                ? "bg-portal-primary text-white rounded-tr-none"
                                                : "bg-content-bg border border-content-border text-ink rounded-tl-none font-medium"
                                        )}>
                                            {msg.content}
                                        </div>
                                        {msg.model && (
                                            <div className="flex items-center gap-2 mt-2 ml-1">
                                                <span className="text-[9px] font-black text-slate uppercase tracking-widest">SOURCE:</span>
                                                <span className="text-[9px] font-bold text-portal-primary bg-portal-primary/5 px-2 py-0.5 rounded-full">
                                                    {msg.provider?.toUpperCase()} • {msg.model}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-4 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-card bg-ink flex items-center justify-center shrink-0 animate-pulse">
                                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                                    </div>
                                    <div className="bg-content-bg border border-content-border p-4 rounded-[1.5rem] rounded-tl-none shadow-card italic text-slate text-sm">
                                        DAWA is consulting clinical knowledge...
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="px-6 py-3 border-t border-content-border bg-content-bg flex items-center gap-2 overflow-x-auto no-scrollbar">
                           <button className="flex items-center gap-2 px-4 py-2 rounded-card border border-content-border text-[10px] font-black uppercase tracking-widest whitespace-nowrap hover:bg-content-surface transition-colors">
                              <Workflow className="w-3 h-3 text-portal-primary" /> Shift Handoff
                           </button>
                           <button className="flex items-center gap-2 px-4 py-2 rounded-card border border-content-border text-[10px] font-black uppercase tracking-widest whitespace-nowrap hover:bg-content-surface transition-colors">
                              <BrainCircuit className="w-3 h-3 text-portal-primary" /> Lab Analytics
                           </button>
                           <button className="flex items-center gap-2 px-4 py-2 rounded-card border border-content-border text-[10px] font-black uppercase tracking-widest whitespace-nowrap hover:bg-content-surface transition-colors">
                              <Command className="w-3 h-3 text-portal-primary" /> Protocols
                           </button>
                        </div>

                        {/* Input Area */}
                        <div className="p-6 pt-0 bg-content-bg">
                            <div className="relative group">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Consult DAWA on unit performance or protocols..."
                                    className="w-full bg-content-surface border border-content-border rounded-card px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary/50 transition-all resize-none min-h-[60px] max-h-[120px]"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading}
                                    className={cn(
                                        "absolute bottom-3 right-3 w-10 h-10 rounded-card flex items-center justify-center transition-all shadow-lg",
                                        input.trim() && !isLoading ? "bg-portal-primary text-white shadow-portal-primary/30 hover:scale-105 active:scale-95" : "bg-content-border text-slate"
                                    )}
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-black text-slate uppercase tracking-[0.2em]">
                                <BrainCircuit className="w-3 h-3" />
                                Clinical Decision Support Mode Active
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
