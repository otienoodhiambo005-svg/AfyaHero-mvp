'use client';

import { useState, useEffect } from 'react';
import { 
  QrCode, 
  Smartphone, 
  Settings, 
  CheckCircle2, 
  Zap, 
  AlertCircle,
  Link,
  SmartphoneNfc,
  Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function BarcodeScanner() {
  const [isPaired, setIsPaired] = useState(false);
  const [scanStream, setScanStream] = useState<string[]>([]);

  // Simulate incoming scans
  useEffect(() => {
    if (isPaired) {
        const interval = setInterval(() => {
            const mockScans = ['600123456789', '501101234567', '400840012345'];
            const randomScan = mockScans[Math.floor(Math.random() * mockScans.length)];
            setScanStream(prev => [randomScan, ...prev].slice(0, 5));
        }, 8000);
        return () => clearInterval(interval);
    }
    return undefined;
  }, [isPaired]);

  return (
    <div className="bg-content-bg rounded-[2.5rem] border border-content-border p-8 shadow-card">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-serif font-bold text-charcoal tracking-tight">Scanner Integration</h3>
          <p className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest">Connect External Handheld or Phone</p>
        </div>
        <div className={cn(
            "px-4 py-1.5 rounded-full flex items-center gap-2 border transition-all",
            isPaired ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-content-surface border-content-border/50 text-slate-400"
        )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", isPaired ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            <span className="text-[9px] font-black uppercase tracking-widest">{isPaired ? 'Device Linked' : 'Offline'}</span>
        </div>
      </div>

      {!isPaired ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-violet-500/10 blur-2xl rounded-full" />
                <div className="relative w-24 h-24 bg-content-bg border-2 border-content-border/50 rounded-3xl flex items-center justify-center shadow-inner">
                    <QrCode className="w-12 h-12 text-slate-200" />
                </div>
            </div>
            <h4 className="text-sm font-bold text-ink mb-2">Pair Stock-Control Device</h4>
            <p className="text-[11px] text-slate-500 max-w-[240px] leading-relaxed mb-6">
                Scan the encrypted QR code with the AfyaHero Mobile app to use your phone as a precision barcode scanner.
            </p>
            <button 
                onClick={() => setIsPaired(true)}
                className="px-8 py-3 rounded-full bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-xl shadow-violet-900/20"
            >
                Generate Pairing Key
            </button>
        </div>
      ) : (
        <div className="space-y-6">
            <div className="p-5 rounded-3xl bg-content-surface border border-content-border/50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Smartphone className="w-4 h-4 text-violet-600" />
                        <span className="text-xs font-bold text-ink">iPhone 15 Pro Max</span>
                    </div>
                    <button onClick={() => setIsPaired(false)} className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Unpair</button>
                </div>
                <div className="space-y-2">
                    {scanStream.length > 0 ? scanStream.map((sku, i) => (
                        <div key={i} className="flex items-center justify-between animate-in slide-in-from-top-2">
                            <span className="font-mono text-[10px] text-slate-400">{sku}</span>
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Matched</span>
                        </div>
                    )) : (
                        <p className="text-[10px] text-slate-400 italic py-2">Waiting for first scan...</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button className="flex flex-col items-center justify-center p-4 rounded-3xl border border-content-border/50 hover:bg-content-surface transition-all text-center group">
                    <Camera className="w-5 h-5 text-slate-400 group-hover:text-violet-600 mb-2" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Browser Cam</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 rounded-3xl border border-content-border/50 hover:bg-content-surface transition-all text-center group">
                    <Link className="w-5 h-5 text-slate-400 group-hover:text-violet-600 mb-2" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">HID Scanner</span>
                </button>
            </div>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3 p-4 rounded-card bg-amber-50 border border-amber-100">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-[9px] text-amber-700 font-medium leading-normal">
              External USB scanners must be in &ldquo;Keyboard Emulation&rdquo; mode (HID) to interface directly with the inventory hub.
          </p>
      </div>
    </div>
  );
}
