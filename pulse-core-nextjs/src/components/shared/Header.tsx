'use client';

import { useState } from 'react';
import { Search, HelpCircle, Menu } from 'lucide-react';
import { NotificationPanel } from '@/components/portal/NotificationPanel';

export default function Header() {
    const [searchFocused, setSearchFocused] = useState(false);

    return (
        <header className="h-20 bg-ink border-b border-forest/30 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10">
            {/* Mobile menu button — visible below md */}
            <button type="button" aria-label="Open menu" className="md:hidden p-3 text-mist hover:text-white hover:bg-forest/30 rounded-card transition-all mr-2 min-h-[44px] min-w-[44px]">
                <Menu className="w-5 h-5" />
            </button>

            <div className={`relative w-full max-w-md transition-all ${searchFocused ? 'max-w-lg' : ''}`}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist" />
                <input
                    type="text"
                    placeholder="Search patients, staff, records..."
                    className="w-full bg-forest/30 border border-forest/20 rounded-card py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-mist/50 focus:ring-2 focus:ring-emerald/20 focus:border-emerald/40 outline-none transition-all font-sans"
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                />
            </div>

            <div className="flex items-center gap-2 md:gap-4 ml-4">
                <button className="p-3 text-mist hover:text-white hover:bg-forest/30 rounded-card transition-all hidden sm:block min-h-[44px] min-w-[44px]">
                    <HelpCircle className="w-5 h-5" />
                </button>
                <NotificationPanel />

                <div className="h-8 w-px bg-forest/30 mx-1 md:mx-2 hidden sm:block"></div>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--portal-primary)] rounded-card flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-[var(--portal-primary)]/20 border border-[var(--portal-primary)]/30">
                        AD
                    </div>
                    <div className="flex-col hidden sm:flex">
                        <span className="text-sm font-bold text-white leading-tight">Admin User</span>
                        <span className="text-[11px] text-sage font-medium">Administrator</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
