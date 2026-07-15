'use client';

import Image from 'next/image';
import { Search, MapPin, ShieldCheck, Star, Navigation, Phone, Info } from 'lucide-react';

const hospitals = [
    {
        name: 'Metropolitan Hospital Centre',
        address: 'Nairobi, Kenya',
        insurances: ['SHIF', 'AAR', 'Jubilee'],
        rating: 4.8,
        distance: '2.4 km',
        image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2053&auto=format&fit=crop'
    },
    {
        name: 'Avenue Health Hub',
        address: 'Parklands, Nairobi',
        insurances: ['SHIF', 'Britam'],
        rating: 4.5,
        distance: '5.1 km',
        image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce8?q=80&w=2073&auto=format&fit=crop'
    },
    {
        name: 'Sunrise Medical Node',
        address: 'Kilimani, Nairobi',
        insurances: ['Jubilee', 'Madison'],
        rating: 4.9,
        distance: '3.8 km',
        image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=2070&auto=format&fit=crop'
    },
];

export default function HospitalFinder() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold font-serif">Find Nearby Care</h2>
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Matched with your SHIF & Jubilee policy coverage</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by facility name or specialty..."
                        aria-label="Search facilities by name or specialty"
                        className="w-full bg-content-bg/5 border border-white/10 rounded-[20px] pl-12 pr-6 py-4 text-sm outline-none focus:border-rose-500/50 transition-all font-medium"
                    />
                </div>
                <button aria-label="Use current location to find nearby hospitals" className="px-6 py-4 bg-content-bg/5 border border-white/10 rounded-[20px] text-xs font-bold uppercase tracking-widest hover:bg-content-bg/10 transition-all flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    Current Location
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hospitals.map((hosp, i) => (
                    <div key={i} className="bg-content-bg/5 rounded-[40px] border border-white/10 overflow-hidden group hover:border-emerald-500/30 transition-all relative">
                        <div className="h-48 overflow-hidden relative">
                            <Image src={hosp.image} alt={hosp.name} fill className="object-cover opacity-50 transition-transform duration-700 group-hover:scale-110" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                <span className="text-[10px] font-bold text-white">{hosp.rating}</span>
                            </div>
                            <div className="absolute bottom-4 left-4 flex gap-1">
                                {hosp.insurances.map((ins, j) => (
                                    <span key={j} className="text-[8px] font-black uppercase tracking-tighter bg-emerald-500 text-white px-2 py-0.5 rounded shadow-lg">
                                        {ins}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="p-8">
                            <h3 className="text-lg font-bold text-white mb-2 leading-tight uppercase tracking-tight">{hosp.name}</h3>
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-6">
                                <MapPin className="w-3.5 h-3.5" />
                                {hosp.address} • {hosp.distance}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button aria-label={`Navigate to ${hosp.name}`} className="flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-card text-[10px] font-bold uppercase tracking-widest transition-all">
                                    <Navigation className="w-3.5 h-3.5" />
                                    Navigate
                                </button>
                                <button aria-label={`Contact ${hosp.name}`} className="flex items-center justify-center gap-2 py-3 bg-content-bg/5 hover:bg-content-bg/10 text-slate-300 rounded-card text-[10px] font-bold uppercase tracking-widest border border-white/5 transition-all">
                                    <Phone className="w-3.5 h-3.5" />
                                    Contact
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-emerald-500/5 rounded-[32px] border border-emerald-500/20 p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-card bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Info className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    Facilitating direct billing for <span className="text-white">SHIF Super Cover</span> and <span className="text-white">Jubilee Platinum</span> at these nodes. Dynamic ID authentication supported.
                </p>
            </div>
        </div>
    );
}
