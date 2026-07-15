'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Database, ArrowRight, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HL7Message {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  segment: string;
  status: 'received' | 'processed' | 'error';
}

const SOURCES = ['Sysmex XN-1000', 'Cobas C311', 'Finecare FIA'];
const MSG_TYPES = ['ORU^R01', 'OML^O21', 'ACK^R01'];

export function HL7LiveFeed() {
  const [messages, setMessages] = useState<HL7Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const newMessage: HL7Message = {
        id: `MSG-${Math.floor(Math.random() * 90000) + 10000}`,
        timestamp: new Date().toLocaleTimeString(),
        source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
        type: MSG_TYPES[Math.floor(Math.random() * MSG_TYPES.length)],
        segment: `MSH|^~\\&|${SOURCES[Math.floor(Math.random() * SOURCES.length)]}|LAB-LIS|ADT|1.0||${MSG_TYPES[Math.floor(Math.random() * MSG_TYPES.length)]}|${Math.random().toString(36).substring(7)}|P|2.3`,
        status: Math.random() > 0.05 ? 'processed' : 'error',
      };

      setMessages((prev) => [newMessage, ...prev].slice(0, 10));
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#080F0C] rounded-[2.5rem] border border-emerald-900/30 overflow-hidden shadow-2xl shadow-emerald-900/10">
      <div className="px-8 py-5 border-b border-emerald-900/20 bg-emerald-950/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-card bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Terminal className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-50 font-serif tracking-tight">HL7 / ASTM Interface</h3>
            <p className="text-[10px] font-black font-mono text-emerald-500/60 uppercase tracking-widest">Live Integration Feed</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-mono">Listening on Port 2575</span>
            </div>
            <Activity className="w-4 h-4 text-emerald-500/40" />
        </div>
      </div>

      <div className="p-4 h-[400px] overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-emerald-900/40" ref={scrollRef}>
        <div className="space-y-2">
          {messages.map((msg, idx) => (
            <div 
              key={msg.id} 
              className={cn(
                "p-4 rounded-card border transition-all animate-in slide-in-from-top-2 duration-500",
                msg.status === 'error' 
                  ? "bg-rose-500/5 border-rose-500/20 shadow-lg shadow-rose-500/5" 
                  : "bg-emerald-500/5 border-emerald-500/10"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-content-bg/5 border border-white/10 px-2 py-0.5 rounded-lg text-emerald-400 font-bold">
                        {msg.timestamp}
                    </span>
                    <span className="text-[10px] text-slate-500">ID: {msg.id}</span>
                </div>
                <div className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1.5",
                    msg.status === 'processed' ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                )}>
                    {msg.status === 'processed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {msg.status}
                </div>
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs text-emerald-50/80 font-bold tracking-tight">{msg.source}</p>
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <p className="text-xs text-violet-400 font-bold">{msg.type}</p>
              </div>

              <div className="bg-black/40 rounded-card p-3 border border-white/5 overflow-x-auto">
                <code className="text-[10px] text-emerald-500/80 break-all leading-relaxed">
                    {msg.segment}
                </code>
              </div>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 py-20">
              <Database className="w-12 h-12 opacity-20" />
              <p className="text-xs font-mono uppercase tracking-widest">Waiting for incoming transmission...</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-4 border-t border-emerald-900/20 bg-emerald-950/10 flex justify-between items-center">
          <div className="flex gap-4">
              <div className="text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">Packets</p>
                  <p className="text-xs font-bold text-emerald-400">1.2k</p>
              </div>
              <div className="text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">Errors</p>
                  <p className="text-xs font-bold text-rose-500">0.02%</p>
              </div>
          </div>
          <button className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-2 group font-mono">
              View Audit Logs
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
          </button>
      </div>
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>;
}

function AlertCircle({ className }: { className?: string }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
