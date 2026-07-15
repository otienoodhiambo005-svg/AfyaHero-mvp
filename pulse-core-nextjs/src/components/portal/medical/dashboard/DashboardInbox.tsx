'use client';

import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InboxItem, inboxTypeColors } from './DashboardTypes';

interface DashboardInboxProps {
  items: InboxItem[];
}

export function DashboardInbox({ items }: DashboardInboxProps) {
  return (
    <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-content-border bg-content-surface/50">
        <h2 className="text-xs font-bold text-ink uppercase tracking-widest flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-600" /> Surgeon Inbox
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-blue-100 text-blue-600 uppercase tracking-tighter">{items.length} New</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-4 px-5 py-4 hover:bg-content-surface transition-colors group cursor-pointer">
            <div className={cn('p-2 rounded-card bg-content-surface group-hover:bg-content-bg transition-colors shrink-0 border border-content-border/50', inboxTypeColors[item.type])}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800 font-semibold leading-tight group-hover:text-blue-600 transition-colors">{item.text}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wide">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
      <button className="w-full py-4 text-xs font-bold text-slate-500 hover:bg-content-surface border-t border-content-border/50 transition-colors uppercase tracking-widest">
         View Full Communications Hub
      </button>
    </div>
  );
}
