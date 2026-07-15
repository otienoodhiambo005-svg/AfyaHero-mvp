'use client';

import { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Activity, 
  ChevronRight,
  Monitor,
  LayoutGrid,
  Zap,
  ShieldCheck,
  X,
  Stethoscope,
  ArrowRight,
  Bed as BedIcon,
  Activity as PulseIcon,
  Heart,
  Timer,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRealtimeBeds } from '@/hooks/useRealtimeBeds';
import { BedTile } from './BedTile';
import { TasksList } from '../TasksList';
import { VitalsMonitor } from '../VitalsMonitor';

type NurseModule = 'wards' | 'tasks' | 'vitals';

export function WardDashboard() {
  const [activeModule, setActiveModule] = useState<NurseModule>('wards');
  const hospitalId = 'demo-hospital';
  
  const bedsData = useRealtimeBeds(hospitalId);
  const beds = bedsData.beds;
  const stats = bedsData.stats;
  const loading = bedsData.connectionStatus === 'connecting';
  const error = bedsData.connectionStatus === 'error';
  
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedBed = useMemo(() => 
    beds.find(b => b.id === selectedBedId) || null,
  [beds, selectedBedId]);

  const criticalBeds = useMemo(() =>
    beds.filter(b => b.status === 'occupied' && 'priority' in b && b.priority === 'high').length,
  [beds]);

  const filteredBeds = useMemo(() => {
    return beds.filter(b => {
      const matchesWard = selectedWard === 'all' || b.ward_id === selectedWard;
      const matchesSearch = b.bed_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.patient_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesWard && matchesSearch;
    });
  }, [beds, selectedWard, searchQuery]);

  const wardOptions = useMemo(() => {
    const wards = Array.from(new Set(beds.map(b => b.ward_id)));
    return wards.map(id => ({
      id,
      name: beds.find(b => b.ward_id === id)?.ward_name || id
    }));
  }, [beds]);

  if (error) {
    return <SyncErrorState />;
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Premium Module Switcher */}
      <div className="flex justify-center pt-2">
         <div className="flex items-center gap-1 rounded-[2rem] border border-content-border bg-content-bg p-1.5 shadow-card">
            {(['wards', 'tasks', 'vitals'] as const).map((mod) => (
              <button
                key={mod}
                onClick={() => setActiveModule(mod)}
                className={cn(
                  "relative overflow-hidden rounded-[1.5rem] px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all group sm:px-10",
                  activeModule === mod ? "text-white" : "text-slate hover:bg-content-surface hover:text-ink"
                )}
              >
                {activeModule === mod && (
                  <motion.div 
                    layoutId="module-pill"
                    className="absolute inset-0 bg-portal-primary shadow-xl shadow-portal-primary/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                   {mod === 'wards' && <LayoutGrid className="w-3.5 h-3.5" />}
                   {mod === 'tasks' && <ClipboardList className="w-3.5 h-3.5" />}
                   {mod === 'vitals' && <Activity className="w-3.5 h-3.5" />}
                   {mod}
                </span>
              </button>
            ))}
         </div>
      </div>

      <AnimatePresence mode="wait">
        {activeModule === 'wards' && (
          <motion.div
            key="wards"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Standard Ward Dashboard Content */}
            <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(217,119,6,0.16),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-6 shadow-card">
              <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-portal-primary/10 blur-3xl" />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-portal-primary">
                  <Monitor className="h-3.5 w-3.5" />
                  Live bed board
                </div>
                <h1 className="max-w-3xl text-4xl font-black tracking-tight text-ink md:text-6xl">
                  Ward control <span className="text-portal-primary">& admissions</span>
                </h1>
                <p className="max-w-2xl text-base font-medium tracking-tight text-slate md:text-lg">
                  Real-time occupancy management for {beds.length} beds across active wards, isolation rooms, and step-down units.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
                {[
                  { label: 'Occupied', value: stats.occupied, icon: <BedIcon className="h-4 w-4" /> },
                  { label: 'Available', value: stats.available, icon: <ShieldCheck className="h-4 w-4" /> },
                  { label: 'Critical', value: criticalBeds, icon: <PulseIcon className="h-4 w-4" /> },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-content-border bg-content-bg p-3 shadow-sm">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-portal-primary/10 text-portal-primary">
                      {item.icon}
                    </div>
                    <p className="text-2xl font-semibold text-ink">{item.value}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate">{item.label}</p>
                  </div>
                ))}
              </div>
              </div>
            </div>

            <div className="flex flex-col gap-8 xl:flex-row">
              <div className="flex-1 space-y-8">
                <div className="relative flex flex-col items-center gap-4 rounded-[2rem] border border-content-border bg-content-bg p-4 shadow-card md:flex-row">
                  <div className="relative flex-1 group w-full">
                    <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate" />
                    <input 
                      type="text" 
                      placeholder="Lookup Unit ID or Patient Registry..."
                      className="w-full rounded-[1.5rem] border border-content-border bg-content-surface px-12 py-4 text-base font-medium text-ink outline-none transition-all placeholder:text-slate focus:border-portal-primary/40 focus:ring-2 focus:ring-portal-primary/15"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex w-full items-center gap-2 overflow-x-auto rounded-[1.5rem] border border-content-border bg-content-surface p-2 md:w-auto">
                    <button 
                      onClick={() => setSelectedWard('all')}
                      className={cn("whitespace-nowrap rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-colors", selectedWard === 'all' ? "bg-portal-primary text-white shadow-sm" : "text-slate hover:bg-content-bg hover:text-ink")}
                    >All</button>
                    {wardOptions.map(ward => (
                      <button 
                        key={ward.id}
                        onClick={() => setSelectedWard(ward.id)}
                        className={cn("whitespace-nowrap rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-colors", selectedWard === ward.id ? "bg-portal-primary text-white shadow-sm" : "text-slate hover:bg-content-bg hover:text-ink")}
                      >{ward.name}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 pb-12 md:grid-cols-2 lg:grid-cols-3">
                  {filteredBeds.map((bed) => (
                    <BedTile key={bed.id} bed={bed} isSelected={selectedBedId === bed.id} onClick={() => setSelectedBedId(bed.id)} />
                  ))}
                </div>
              </div>

              {selectedBed && (
                <div className="sticky top-8 h-fit w-full xl:w-[440px] xl:shrink-0">
                   <BedSummaryPanel bed={selectedBed} onClose={() => setSelectedBedId(null)} />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeModule === 'tasks' && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <TasksList />
          </motion.div>
        )}

        {activeModule === 'vitals' && (
          <motion.div
            key="vitals"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <VitalsMonitor />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BedSummaryPanel({ bed, onClose }: { bed: any, onClose: () => void }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-content-border bg-content-bg p-8 shadow-card space-y-8">
      <div className="flex items-center justify-between">
         <div>
           <p className="text-[10px] font-black uppercase tracking-widest text-portal-primary">Selected bed</p>
           <h3 className="text-4xl font-black tracking-tight text-ink">{bed.bed_number}</h3>
         </div>
         <button onClick={onClose} className="rounded-full bg-content-surface p-3 transition-colors hover:bg-content-border">
            <X className="h-5 w-5" />
         </button>
      </div>
      <div className="space-y-4">
         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Occupant</p>
         <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-portal-primary text-2xl font-black text-white">{bed.patient_name?.[0] || 'P'}</div>
            <div>
              <p className="text-xl font-bold text-ink">{bed.patient_name || 'Available'}</p>
              <p className="text-sm text-slate">{bed.ward_name}</p>
            </div>
         </div>
      </div>
      <button className="w-full rounded-full bg-ink py-5 text-xs font-black uppercase tracking-widest text-white transition-transform hover:scale-[1.01]">
         Patient Timeline
      </button>
    </div>
  );
}

function SyncErrorState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <ShieldCheck className="w-12 h-12 text-rose-500" />
      <h2 className="text-xl font-bold font-serif">Sync Timeout</h2>
      <button onClick={() => window.location.reload()} className="px-8 py-3 rounded-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest">Retry Sync</button>
    </div>
  );
}
