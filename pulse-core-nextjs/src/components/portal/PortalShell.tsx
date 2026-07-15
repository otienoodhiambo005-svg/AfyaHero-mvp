'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Bot, Bell, X, LogOut,
  Search, Menu, ChevronDown, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserSession } from '@/types';
import { DawaChat } from '@/components/ai/DawaChat';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';
import { useTranslations } from '@/hooks/useTranslations';

export interface PortalNavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  group?: string;
}

interface PortalShellProps {
  session: UserSession;
  accentColor: string;   // hex
  portalLabel: string;
  portalRole: string;
  navItems: PortalNavItem[];
  children: React.ReactNode;
}

interface SidebarContentProps {
  groups: Record<string, PortalNavItem[]>;
  portalLabel: string;
  accentColor: string;
  pathname: string;
  portalRole: string;
  session: UserSession;
  setMobileOpen: (open: boolean) => void;
  setAiOpen: (open: boolean) => void;
  handleLogout: () => void;
}

function SidebarContent({
  groups,
  portalLabel,
  accentColor,
  pathname,
  portalRole,
  session,
  setMobileOpen,
  setAiOpen,
  handleLogout,
}: SidebarContentProps) {
  const { t } = useTranslations();
  
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8 px-1 hover:opacity-80 transition-opacity">
        <Image src="/afyahero-icon.jpeg" alt="AfyaHero" width={36} height={36} className="rounded-lg shrink-0 shadow-lg" />
        <div>
          <div className="text-emerald font-bold text-base font-logo leading-none drop-shadow-md">AfyaHero</div>
          <div className="text-[10px] font-bold uppercase tracking-widest font-mono mt-0.5" style={{ color: accentColor }}>
            {portalLabel}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Primary portal navigation" className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="mb-4">
            {groupName && (
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate font-mono px-3 mb-1.5">
                {groupName}
              </div>
            )}
            {items.map((item) => {
              const active = pathname === item.href || (item.href !== `/portal/${portalRole}` && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-card text-sm font-medium transition-colors duration-200 group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--portal-primary)]',
                    active ? 'text-ink' : 'text-slate hover:text-ink hover:bg-content-surface'
                  )}
                  style={active ? {
                    background: `${accentColor}18`,
                    color: 'var(--ink)',
                  } : {}}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background: accentColor }}
                    />
                  )}
                  <span className={cn('w-5 h-5 flex items-center justify-center shrink-0 transition-colors', active ? '' : 'text-slate group-hover:text-charcoal')}>
                    {item.icon}
                  </span>
                  <span className="flex-1 leading-none">{item.name}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none text-white"
                      style={{ background: accentColor }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-content-border pt-4">
        <div className="flex items-center gap-3 px-1 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border shrink-0"
            style={{ background: `${accentColor}25`, borderColor: `${accentColor}40` }}
          >
            {session.initials ?? session.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-ink text-xs font-semibold truncate">{session.name}</div>
            <div className="text-slate text-[10px] truncate">{session.title}</div>
          </div>
          {session.demo && (
            <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border"
              style={{ color: accentColor, borderColor: `${accentColor}40`, background: `${accentColor}10` }}>
              DEMO
            </span>
          )}
        </div>
        <button
          data-testid="logout-button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-card text-slate hover:text-red-500 hover:bg-red-500/10 transition-colors w-full text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-300"
        >
          <LogOut className="w-4 h-4" />
          {t('nav_logout')}
        </button>
      </div>
    </div>
  );
}

type DawaApiResponse = {
  answer?: string;
  error?: string;
};

export default function PortalShell({
  session,
  accentColor,
  portalLabel,
  portalRole,
  navItems,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const mobileNavId = useId();
  const aiDialogTitleId = useId();
  const aiDialogDescId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslations();
  
  // Set data-portal on <html> so CSS variable overrides activate
  useEffect(() => {
    document.documentElement.setAttribute('data-portal', portalRole);
    return () => document.documentElement.removeAttribute('data-portal');
  }, [portalRole]);

  const handleLogout = async () => {
    // Use a server-driven redirect so cookie clearing does not depend on client fetch reliability.
    window.location.assign(`/api/auth/logout?redirect=/auth/${portalRole}/login`);
  };

  // Group nav items
  const groups = navItems.reduce<Record<string, PortalNavItem[]>>((acc, item) => {
    const g = item.group ?? '';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAiOpen(false);
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div data-testid="portal-shell" className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(50,130,184,0.10),transparent_30%),linear-gradient(135deg,rgba(50,130,184,0.05),rgba(15,76,117,0.05),rgba(137,196,232,0.05))]">
      {/* Desktop Sidebar */}
      <aside data-testid="portal-sidebar" className="hidden md:flex w-64 bg-content-bg border-r border-content-border flex-col p-card shrink-0 h-screen overflow-y-auto">
        <SidebarContent
          groups={groups}
          portalLabel={portalLabel}
          accentColor={accentColor}
          pathname={pathname}
          portalRole={portalRole}
          session={session}
          setMobileOpen={setMobileOpen}
          setAiOpen={setAiOpen}
          handleLogout={handleLogout}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-in" onClick={() => setMobileOpen(false)} />
          <aside id={mobileNavId} data-testid="portal-sidebar-mobile" aria-label="Mobile portal navigation" className="absolute left-0 top-0 h-full w-72 bg-content-bg border-r border-content-border flex flex-col p-card overflow-y-auto shadow-card-hover slide-in-left">
            <SidebarContent
              groups={groups}
              portalLabel={portalLabel}
              accentColor={accentColor}
              pathname={pathname}
              portalRole={portalRole}
              session={session}
              setMobileOpen={setMobileOpen}
              setAiOpen={setAiOpen}
              handleLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-content-bg border-b border-content-border flex items-center gap-4 px-card shrink-0">
          <button
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls={mobileNavId}
            className="md:hidden p-1.5 rounded-lg text-slate hover:text-ink transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center gap-3 max-w-xl">
            <div className="flex items-center gap-2 bg-content-surface/80 border border-content-border rounded-full px-4 py-2.5 flex-1 shadow-sm transition-all focus-within:border-[var(--portal-primary)] focus-within:ring-2 focus-within:ring-[var(--portal-primary)]/15">
              <Search className="w-3.5 h-3.5 text-slate shrink-0" />
              <input
                placeholder={`Search ${portalLabel.toLowerCase()} workspace...`}
                aria-label="Quick search"
                className="bg-transparent text-sm text-ink placeholder:text-slate outline-none flex-1 min-w-0"
              />
              <kbd className="hidden sm:block text-[10px] font-mono text-slate border border-content-border rounded px-1">⌘K</kbd>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Language Switcher */}
            <LanguageSwitcher variant="dropdown" />

            {/* Compact DAWA Pill Button */}
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border shadow-sm transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500"
              style={{ color: accentColor, borderColor: `${accentColor}30`, background: `${accentColor}10` }}
            >
              <Sparkles className="w-3 h-3" />
              <span>DAWA</span>
            </button>

            <button aria-label="Open notifications" className="relative p-2.5 rounded-full text-slate hover:text-ink hover:bg-content-surface transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full border border-white" style={{ background: accentColor }} />
            </button>

            <div className="w-px h-5 bg-content-border mx-2" />

            <div data-testid="user-menu-trigger" className="flex items-center gap-2 group cursor-pointer">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border"
                style={{ background: `${accentColor}25`, borderColor: `${accentColor}40` }}
              >
                {session.initials ?? session.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <ChevronDown className="w-3 h-3 text-slate group-hover:text-charcoal transition-colors" />
            </div>
          </div>
        </header>


        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-content-canvas p-card md:p-section">
          <div className="max-w-[1500px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* DAWA AI Pill Drawer - Compact pill-style for all portals */}
      {aiOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 transition-opacity pointer-events-auto"
            onClick={() => setAiOpen(false)}
          />

          {/* Pill Panel - Compact Design */}
          <div
            className={cn(
              "relative w-full max-w-md mx-4 bg-content-bg rounded-card shadow-2xl flex flex-col transform transition-all duration-300 ease-out pointer-events-auto",
              aiOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
            )}
            role="dialog"
            aria-modal="true"
            style={{ maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-content-border bg-content-surface rounded-t-card">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">DAWA Assistant</div>
                  <div className="text-xs text-slate">{portalLabel}</div>
                </div>
              </div>
              <button
                onClick={() => setAiOpen(false)}
                aria-label="Close DAWA Assistant"
                className="p-1.5 hover:bg-content-surface rounded-lg text-slate hover:text-ink transition-all focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-hidden p-4" style={{ minHeight: '300px' }}>
              <DawaChat
                portal={portalRole}
                title=""
                placeholder="Ask DAWA Assistant..."
                allowVoice={false}
                allowFileUpload={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
