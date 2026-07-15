'use client';

import { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Filter, 
  Users, 
  Activity, 
  ChevronRight,
  Monitor,
  LayoutGrid,
  Zap,
  ShieldCheck,
  MoreHorizontal,
  X,
  Stethoscope,
  Bed as BedIcon,
  Timer,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
// import { useSession } from 'next-auth/react'; // Removed to resolve build error
import { useRealtimeBeds } from '@/hooks/useRealtimeBeds';
import { BedTile } from '../medical/nurse/wards/BedTile'; // Corrected path
import logger from '@/lib/logger';

export function BedControlCenter() {
  const hospitalId = 'demo-hospital';
  const bedsData = useRealtimeBeds(hospitalId);
  const beds = bedsData.beds;
  const stats = bedsData.stats;
  const loading = bedsData.connectionStatus === 'connecting';
  const error = bedsData.connectionStatus === 'error';
  const actions = {
    admit: (id: string, pid: string) => logger.info('Bed admit action triggered', { bedId: id, patientId: pid }),
    discharge: (id: string) => logger.info('Bed discharge action triggered', { bedId: id }),
  };
  
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedBed = useMemo(() => 
    beds.find(b => b.id === selectedBedId) || null,
  [beds, selectedBedId]);

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
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-serif text-ink mb-2">Sync Connection Interrupted</h2>
        <p className="text-slate-500 max-w-sm mb-8">Administrators require a persistent socket connection to monitor facility capacity. Please verify your network state.</p>
        <button onClick={() => window.location.reload()} className="px-8 py-4 bg-slate-900 text-white rounded-card font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">
          Re-establish Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Tactical Admin Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 bg-[#080F0C] p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl shadow-emerald-950/20 border border-white/5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full -mr-32 -mt-32" />
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-4">
             <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Command Center
             </div>
          </div>
          <h1 className="text-4xl font-serif mb-3 tracking-tight">Facility Capacity Oversight</h1>
          <p className="text-emerald-50/50 text-sm font-medium max-w-lg leading-relaxed">
            Real-time monitoring of {beds.length} clinical units. Analytics-driven surge detection and resource optimization for the entire facility.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 relative z-10">
           <div className="flex items-center gap-6 pr-8 border-r border-white/10 italic">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black mb-1">Intake Velocity</p>
                <p className="text-xl font-mono text-emerald-400 font-bold">14/hr</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black mb-1">Turnaround</p>
                <p className="text-xl font-mono text-white font-bold">42m</p>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-6 py-3 rounded-card bg-content-bg text-[#080F0C] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95 shadow-xl shadow-emerald-500/20 cursor-default">
                <TrendingUp className="w-4 h-4" />
                Surge Mode
              </button>
              <button className="p-3 rounded-card bg-content-bg/5 border border-white/10 hover:bg-content-bg/10 transition-all">
                <MoreHorizontal className="w-5 h-5 text-white/60" />
              </button>
           </div>
        </div>
      </div>

      {/* Capacity Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'System Occupancy', value: `${stats.occupancyRate}%`, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50', sub: `${stats.occupied} Units Active` },
          { label: 'Emergency Reserve', value: '08', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50', sub: 'Critical Threshold' },
          { label: 'Cleaning Stream', value: stats.maintenance.toString(), icon: Timer, color: 'text-amber-500', bg: 'bg-amber-50', sub: 'Avg. 18m per unit' },
          { label: 'Total Capacity', value: stats.total.toString(), icon: LayoutGrid, color: 'text-blue-500', bg: 'bg-blue-50', sub: 'Across 6 Wards' },
        ].map((stat, i) => (
          <div key={i} className="bg-content-bg border border-content-border/50 p-8 rounded-[2.5rem] shadow-card hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
            <div className="flex items-start justify-between mb-4">
               <div className={cn("p-4 rounded-[1.2rem] transition-transform group-hover:scale-110", stat.bg)}>
                 <stat.icon className={cn("w-6 h-6", stat.color)} />
               </div>
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live</span>
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-serif text-ink">{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-400">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="flex-1 space-y-8">
           {/* Navigation & Search Console */}
           <div className="bg-[#080F0C] rounded-[2.5rem] p-5 flex flex-col md:flex-row items-center gap-5 shadow-2xl border border-white/5">
              <div className="relative flex-1 group w-full">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/40 group-focus-within:text-emerald-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Query system by Bed ID, Patient, or Tag..."
                  className="w-full pl-14 pr-8 py-4 rounded-[1.75rem] bg-content-bg/5 border border-white/10 outline-none text-sm font-medium text-emerald-50 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 transition-all font-mono placeholder:text-emerald-900"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-2 p-1.5 bg-content-bg/5 rounded-[1.75rem] border border-white/10 w-full md:w-auto overflow-x-auto scrollbar-hide">
                <button 
                  onClick={() => setSelectedWard('all')}
                  className={cn(
                    "px-6 py-3 rounded-card text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap",
                    selectedWard === 'all' 
                      ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/40" 
                      : "text-emerald-500/40 hover:text-emerald-400 hover:bg-content-bg/5 text-xs"
                  )}
                >
                  Global
                </button>
                {wardOptions.map((ward) => (
                  <button 
                    key={ward.id}
                    onClick={() => setSelectedWard(ward.id)}
                    className={cn(
                      "px-6 py-3 rounded-card text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap",
                      selectedWard === ward.id 
                        ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/40" 
                        : "text-emerald-500/40 hover:text-emerald-400 hover:bg-content-bg/5"
                    )}
                  >
                    {ward.name}
                  </button>
                ))}
              </div>
           </div>

           {/* Bed Grid Context */}
           {loading ? (
             <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {[...Array(8)].map((_, i) => (
                 <div key={i} className="h-[280px] rounded-[3rem] bg-content-bg animate-pulse border border-content-border/50 shadow-card" />
               ))}
             </div>
           ) : (
             <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {filteredBeds.map((bed) => (
                 <BedTile 
                   key={bed.id} 
                   bed={bed} 
                   isSelected={selectedBedId === bed.id}
                   onClick={() => setSelectedBedId(bed.id)}
                 />
               ))}
             </div>
           )}
        </div>

        {/* Admin Detail Sidebar */}
        <AnimatePresence mode="wait">
          {selectedBed && (
            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="w-full xl:w-[480px] xl:shrink-0 sticky top-12"
            >
              <div className="bg-content-bg rounded-[3rem] border border-content-border/50 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col min-h-[700px]">
                {/* Header */}
                <div className="p-10 pb-0 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[2rem] bg-[#080F0C] flex items-center justify-center text-white shadow-2xl shadow-emerald-950/20">
                      <BedIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-serif text-ink">{selectedBed.bed_number}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{selectedBed.ward_name}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">ID: {selectedBed.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedBedId(null)}
                    className="p-3 rounded-full hover:bg-content-surface text-slate-300 hover:text-ink transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-10 space-y-10 flex-1">
                    {selectedBed.patient_id ? (
                      <div className="space-y-8">
                        <div className="p-8 rounded-[2.5rem] bg-content-surface border border-content-border/50">
                           <div className="flex items-center gap-4 mb-6">
                              <div className="w-14 h-14 rounded-card bg-[#2563EB] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">
                                {selectedBed.patient_name ? selectedBed.patient_name[0] : 'P'}
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primary Occupant</p>
                                <h4 className="text-2xl font-bold text-ink">{selectedBed.patient_name || 'Anonymous'}</h4>
                              </div>
                           </div>

                           <div className="flex items-center justify-between py-4 border-t border-content-border/50">
                              <p className="text-xs font-bold text-slate-500">Admission Duration</p>
                              <p className="font-mono text-sm font-bold text-ink">4 days, 12h</p>
                           </div>
                           <div className="flex items-center justify-between py-4 border-t border-content-border/50">
                              <p className="text-xs font-bold text-slate-500">Service Assigned</p>
                              <p className="font-mono text-sm font-bold text-[#2563EB]">Medical / Oncology</p>
                           </div>
                        </div>

                        {/* DAWA Admin Insights */}
                        <div className="p-8 rounded-[2.5rem] bg-[#080F0C] text-white relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl opacity-50" />
                           <div className="flex items-center gap-3 mb-6">
                              <div className="p-2 rounded-card bg-emerald-500/20 border border-emerald-500/40">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">DAWA System Advisory</span>
                           </div>
                           <p className="text-base font-medium italic text-emerald-50/80 leading-relaxed font-serif mb-6">
                              &ldquo;Clinical markers indicate stability. Opportunity for inter-facility referral to Step-down Unit within 24h to optimize revenue per bed.&rdquo;
                           </p>
                           <div className="flex gap-2">
                              <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-[8px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-500/20">Optimal Flow</div>
                              <div className="px-3 py-1 rounded-full bg-content-bg/5 text-[8px] font-black text-white/40 uppercase tracking-widest border border-white/5">Capacity Plus</div>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-6 opacity-40">
                         <div className="w-24 h-24 rounded-[2.5rem] bg-content-surface flex items-center justify-center border border-content-border/50 italic font-serif text-3xl text-slate-300">
                           {selectedBed.bed_number}
                         </div>
                         <div className="space-y-2">
                           <h4 className="font-serif text-2xl text-ink">Unit Available</h4>
                           <p className="text-sm text-slate-400 max-w-[200px] mx-auto font-medium">Monitoring cleaning cycle velocity. Estimated intake ready in 8 mins.</p>
                         </div>
                      </div>
                    )}
                </div>

                {/* Tactical Overrides */}
                <div className="p-10 border-t bg-content-surface/50 space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center mb-2">Tactical Overrides</p>
                   <div className="flex gap-3">
                      <button className="flex-1 py-4 rounded-card bg-content-bg border border-content-border text-ink text-xs font-black uppercase tracking-widest hover:bg-content-surface transition-all flex items-center justify-center gap-2">
                         <Stethoscope className="w-4 h-4" /> Rounds Report
                      </button>
                      <button className="flex-1 py-4 rounded-card bg-content-bg border border-content-border text-ink text-xs font-black uppercase tracking-widest hover:bg-content-surface transition-all flex items-center justify-center gap-2">
                         <Monitor className="w-4 h-4" /> Telemetry
                      </button>
                   </div>
                   <button className="w-full py-5 rounded-3xl bg-[#080F0C] text-white text-sm font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95 shadow-2xl shadow-emerald-950/40">
                      Initiate Resource Transfer
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
