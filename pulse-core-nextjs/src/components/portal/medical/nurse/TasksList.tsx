'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  ClipboardCheck, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  Filter,
  Search,
  Pill,
  Droplets,
  Stethoscope,
  FlaskConical,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import type { ClinicalTask, TaskPriority, TaskStatus } from './types';


export function TasksList() {
  const [tasks, setTasks] = useState<ClinicalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/medical/nurse/tasks', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`);
      const data = await res.json();
      setTasks(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      logger.error('Failed to load nurse tasks', { error: err });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.patientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || t.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'medium': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'low': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  const getCategoryIcon = (category: ClinicalTask['category']) => {
    switch (category) {
      case 'medication': return <Pill className="w-4 h-4" />;
      case 'lab': return <FlaskConical className="w-4 h-4" />;
      case 'dressing': return <Droplets className="w-4 h-4" />;
      case 'observation': return <Stethoscope className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
              <ClipboardCheck className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Active Shift Pipeline</span>
            </div>
          </div>
          <h1 className="text-5xl font-serif text-ink font-black tracking-tight grayscale hover:grayscale-0 transition-all duration-700">
            Clinical <span className="text-slate-300 italic font-medium">Tasks</span>
          </h1>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 bg-content-bg p-2 rounded-[2.5rem] border border-content-border/50 shadow-xl shadow-slate-200/40">
           <div className="relative group flex-1 md:w-80">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text"
                placeholder="Search tasks or patients..."
                className="w-full pl-14 pr-6 py-4 rounded-full bg-content-surface border border-transparent outline-none text-xs font-semibold focus:bg-content-bg focus:border-blue-100 transition-all font-serif"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-1 bg-content-surface p-1.5 rounded-full border border-content-border/50">
              {(['all', 'pending', 'in-progress', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                    filter === f ? "bg-content-bg text-ink shadow-card" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {f === 'all' ? 'All' : f.replace('-', ' ')}
                </button>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group bg-content-bg rounded-[2.5rem] border border-content-border/50 p-8 hover:shadow-[0_32px_80px_-20px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-150 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-content-surface rounded-bl-[4rem] -mr-16 -mt-16 group-hover:bg-blue-50 transition-colors duration-150" />
              
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative z-10">
                <div className="flex items-start gap-6 flex-1">
                  <div className={cn(
                    "w-16 h-16 rounded-[1.75rem] flex items-center justify-center border transition-all duration-150 group-hover:scale-110 shadow-card",
                    getPriorityColor(task.priority)
                  )}>
                    {getCategoryIcon(task.category)}
                  </div>
                  
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">#{task.id}</span>
                      <div className={cn(
                        "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter border",
                        getPriorityColor(task.priority)
                      )}>
                        {task.priority} Priority
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-ink tracking-tight font-serif underline decoration-blue-500/10 underline-offset-4 group-hover:decoration-blue-500/40 transition-all">{task.title}</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-2xl">{task.description}</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-8 xl:pl-12 xl:border-l border-content-border/50">
                  <div className="space-y-4 min-w-[180px]">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-card bg-blue-600 flex items-center justify-center text-white text-[10px] font-black font-serif shadow-xl shadow-blue-500/30">
                          {task.patientName[0]}
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Patient Focus</p>
                          <p className="text-[13px] font-bold text-ink tracking-tight">{task.patientName}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono italic">
                       <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" /> {task.ward}
                       </div>
                       <div className="flex items-center gap-1.5">
                          <BedIcon className="w-3.5 h-3.5" /> Bed {task.bed}
                       </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col lg:flex-row items-center gap-3">
                    <div className="flex flex-col items-end px-6 border-r border-content-border/50 mr-2">
                       <div className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black uppercase tracking-widest underline decoration-blue-500/10">Due by</span>
                       </div>
                       <p className="text-xl font-serif font-black text-ink mt-1">{task.dueTime}</p>
                    </div>

                    <button className={cn(
                      "group/btn relative px-8 py-5 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl",
                      task.status === 'in-progress' 
                        ? "bg-slate-900 text-white shadow-slate-900/20" 
                        : "bg-content-bg border-2 border-content-border/50 text-ink hover:border-blue-200 hover:bg-content-surface"
                    )}>
                       {task.status === 'in-progress' ? (
                         <>
                           <CheckCircle2 className="w-4 h-4 text-blue-400" />
                           Mark Done
                         </>
                       ) : (
                         <>
                           <ChevronRight className="w-4 h-4 text-blue-500 group-hover/btn:translate-x-1 transition-transform" />
                           Begin Procedure
                         </>
                       )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className="py-40 flex flex-col items-center justify-center text-center space-y-6 bg-content-surface/50 rounded-[4rem] border-2 border-dashed border-content-border">
             <div className="w-20 h-20 rounded-[2rem] bg-content-bg border border-content-border/50 flex items-center justify-center shadow-inner">
                <Calendar className="w-10 h-10 text-slate-200" />
             </div>
             <div className="space-y-2">
                <p className="text-2xl font-serif font-medium text-slate-400 tracking-tight italic">All tasks synchronized for this buffer.</p>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">System monitoring active for next incoming shift entries.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Internal reusable icon
function BedIcon(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M2 4v16" /><path d="M2 11h18" /><path d="M2 17h20" /><path d="M6 8v9" /><path d="M10 8v9" /><path d="M14 8v9" /><path d="M18 8v9" /><path d="M22 4v16" />
    </svg>
  );
}

function Building2(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </svg>
  );
}
