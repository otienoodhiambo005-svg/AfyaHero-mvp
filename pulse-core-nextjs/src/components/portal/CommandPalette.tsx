'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Search, Users, Calendar, Stethoscope, FileText,
    FlaskConical, Pill, BedDouble, BarChart3, Settings,
    ArrowRight, Command, Hash
} from 'lucide-react';

/* ── types ─────────────────────────────────────────── */
interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ComponentType<{ className?: string }>;
    category: string;
    shortcut?: string;
    href?: string;
    action?: () => void;
}

/* ── mock commands ─────────────────────────────────── */
const COMMANDS: CommandItem[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Dashboard', description: 'Go to main dashboard', icon: BarChart3, category: 'Navigation', href: '/dashboard' },
    { id: 'nav-queue', label: 'Patient Queue', description: 'View current queue', icon: Users, category: 'Navigation', shortcut: 'Q', href: '/dashboard/queue' },
    { id: 'nav-appointments', label: 'Appointments', description: 'View all appointments', icon: Calendar, category: 'Navigation', href: '/dashboard/appointments' },
    { id: 'nav-lab', label: 'Laboratory', description: 'Lab results & orders', icon: FlaskConical, category: 'Navigation', href: '/dashboard/laboratory' },
    { id: 'nav-pharmacy', label: 'Pharmacy', description: 'Prescriptions & dispensing', icon: Pill, category: 'Navigation', href: '/dashboard/pharmacy' },
    { id: 'nav-wards', label: 'Wards & Beds', description: 'Bed management', icon: BedDouble, category: 'Navigation', href: '/dashboard/wards' },
    { id: 'nav-analytics', label: 'Analytics', description: 'Reports & analytics', icon: BarChart3, category: 'Navigation', href: '/dashboard/analytics' },
    { id: 'nav-settings', label: 'Settings', description: 'Hospital settings', icon: Settings, category: 'Navigation', href: '/dashboard/admin' },
    // Quick Actions
    { id: 'act-new-patient', label: 'Register New Patient', description: 'Add a new patient record', icon: Users, category: 'Quick Actions' },
    { id: 'act-new-consult', label: 'Start Consultation', description: 'Begin a new consultation', icon: Stethoscope, category: 'Quick Actions' },
    { id: 'act-new-rx', label: 'Write Prescription', description: 'Create a prescription', icon: FileText, category: 'Quick Actions' },
    { id: 'act-lab-order', label: 'Order Lab Test', description: 'Submit a lab order', icon: FlaskConical, category: 'Quick Actions' },
    // Recent Patients
    { id: 'pt-1', label: 'Amina Odhiambo', description: 'ID: AFH-2025-0021 · F · 34y', icon: Users, category: 'Recent Patients' },
    { id: 'pt-2', label: 'John Kamau', description: 'ID: AFH-2025-0019 · M · 45y', icon: Users, category: 'Recent Patients' },
    { id: 'pt-3', label: 'Grace Wanjiku', description: 'ID: AFH-2025-0017 · F · 28y', icon: Users, category: 'Recent Patients' },
];

/* ── component ─────────────────────────────────────── */
export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    /* ── keyboard shortcut ⌘K / Ctrl+K ── */
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape') setOpen(false);
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    /* ── focus input when opened ── */
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    /* ── filtered results ── */
    const filtered = query.length === 0
        ? COMMANDS
        : COMMANDS.filter(cmd =>
            cmd.label.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description?.toLowerCase().includes(query.toLowerCase()) ||
            cmd.category.toLowerCase().includes(query.toLowerCase())
        );

    /* ── grouped results ── */
    const groups = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});

    const flatItems = Object.values(groups).flat();

    /* ── keyboard navigation ── */
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
            e.preventDefault();
            handleSelect(flatItems[selectedIndex]);
        }
    }, [flatItems, selectedIndex]);

    function handleSelect(item: CommandItem) {
        setOpen(false);
        if (item.href) window.location.href = item.href;
        else if (item.action) item.action();
    }

    /* ── scroll selected into view ── */
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    if (!open) return null;

    let globalIndex = -1;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={() => setOpen(false)}
            />

            {/* Palette */}
            <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="bg-[#0C1A14] border border-forest/40 rounded-card shadow-2xl shadow-black/40 overflow-hidden">
                    {/* Search input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-forest/30">
                        <Search className="w-5 h-5 text-sage flex-shrink-0" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Search commands, patients, pages..."
                            className="flex-1 bg-transparent text-white text-sm placeholder:text-mist/50 outline-none font-sans"
                        />
                        <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-mist bg-forest/40 rounded-lg px-2 py-1 font-mono border border-forest/30">
                            ESC
                        </kbd>
                    </div>

                    {/* Results */}
                    <div ref={listRef} className="max-h-80 overflow-y-auto scrollbar-thin">
                        {Object.entries(groups).length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <Hash className="w-8 h-8 text-mist/30 mx-auto mb-2" />
                                <p className="text-sm text-mist">No results for &ldquo;{query}&rdquo;</p>
                            </div>
                        ) : (
                            Object.entries(groups).map(([category, items]) => (
                                <div key={category}>
                                    <div className="px-4 pt-3 pb-1">
                                        <span className="text-[10px] uppercase tracking-wider text-sage font-bold font-mono">
                                            {category}
                                        </span>
                                    </div>
                                    {items.map(item => {
                                        globalIndex++;
                                        const idx = globalIndex;
                                        const isSelected = idx === selectedIndex;
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.id}
                                                data-index={idx}
                                                onClick={() => handleSelect(item)}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                    isSelected
                                                        ? 'bg-emerald/10 text-white'
                                                        : 'text-mist hover:bg-forest/20 hover:text-white'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                    isSelected ? 'bg-emerald/20 text-emerald' : 'bg-forest/30 text-sage'
                                                }`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{item.label}</p>
                                                    {item.description && (
                                                        <p className="text-[11px] text-sage truncate">{item.description}</p>
                                                    )}
                                                </div>
                                                {item.shortcut && (
                                                    <kbd className="text-[10px] text-mist bg-forest/30 rounded px-1.5 py-0.5 font-mono border border-forest/20">
                                                        {item.shortcut}
                                                    </kbd>
                                                )}
                                                {isSelected && <ArrowRight className="w-3.5 h-3.5 text-emerald flex-shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-forest/30 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[10px] text-mist font-mono">
                            <span className="flex items-center gap-1">
                                <kbd className="bg-forest/30 rounded px-1 py-0.5 border border-forest/20">↑↓</kbd> navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="bg-forest/30 rounded px-1 py-0.5 border border-forest/20">↵</kbd> select
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-sage">
                            <Command className="w-3 h-3" />
                            <span className="font-mono">K</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
