'use client';

import Image from 'next/image';
import { Video, FileText, Sparkles, TrendingUp, Search } from 'lucide-react';

const articles = [
    { title: 'Understanding Malaria Prevention', category: 'Epidemiology', type: 'Article', time: '5 min read', image: 'https://images.unsplash.com/photo-1584032762282-ec512765ea9a?q=80&w=2000&auto=format&fit=crop' },
    { title: 'Hypertension Management Tips', category: 'Chronic Care', type: 'Video', time: '12 min video', image: 'https://images.unsplash.com/photo-1576091160550-217359f4ecf8?q=80&w=2070&auto=format&fit=crop' },
    { title: 'First Aid for Home Injuries', category: 'Emergency', type: 'Guide', time: '8 min read', image: 'https://images.unsplash.com/photo-1603398938378-e54e42857410?q=80&w=2070&auto=format&fit=crop' },
];

export default function HealthNews() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold font-serif mb-1">Health News</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Medical Insights & Wellness Protocols</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search topics..."
                        aria-label="Search health news topics"
                        className="w-full bg-content-bg/5 border border-white/10 rounded-card pl-10 pr-4 py-2 text-xs outline-none focus:border-rose-500/50 transition-all font-medium"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {articles.map((art, i) => (
                    <div key={i} className="bg-content-bg/5 rounded-[32px] border border-white/10 overflow-hidden group hover:border-white/20 transition-all">
                        <div className="h-40 overflow-hidden relative">
                            <Image src={art.image} alt={art.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" sizes="(max-width: 768px) 100vw, 33vw" />
                            <div className="absolute top-4 left-4 px-3 py-1 bg-slate-900/80 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-tighter text-rose-500 border border-rose-500/20">
                                {art.category}
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {art.type === 'Video' ? <Video className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                {art.type} • {art.time}
                            </div>
                            <h3 className="text-lg font-bold text-white mb-4 leading-tight group-hover:text-rose-400 transition-colors uppercase tracking-tight">{art.title}</h3>
                            <button aria-label={`Read more about ${art.title}`} className="w-full bg-content-bg/5 hover:bg-rose-500 text-slate-300 hover:text-white font-bold py-3 rounded-card transition-all text-[10px] uppercase tracking-widest border border-white/5">
                                Read More
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-gradient-to-r from-rose-500/10 to-indigo-500/10 rounded-[40px] border border-white/5 p-10 flex flex-wrap items-center justify-between gap-8">
                <div className="flex-1 min-w-[300px]">
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-rose-500" />
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">AI Daily Insight</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3 font-serif">Stay Protected: Seasonal Update</h3>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-lg italic">
                        &ldquo;Recent epidemiology data shows a slight uptick in respiratory cases in coastal regions. We recommend maintaining hydration and reviewing your vaccination status.&rdquo;
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-card flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Regional Safety Score</div>
                        <div className="text-xl font-bold text-emerald-400 uppercase tracking-tighter">Optimal (84/100)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
