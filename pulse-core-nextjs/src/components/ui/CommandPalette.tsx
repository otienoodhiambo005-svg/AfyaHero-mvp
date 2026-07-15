/**
 * CommandPalette — ⌘K global search & navigation for superadmin.
 *
 * Features:
 *   - Keyboard shortcut: Cmd/Ctrl + K to open
 *   - Fuzzy search across pages, actions, and tenants
 *   - Keyboard navigation (↑↓ arrows, Enter to select, Esc to close)
 *   - Recent items persistence via localStorage
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Building2,
  Users,
  Shield,
  FileText,
  Activity,
  Settings,
  FlaskConical,
  LayoutDashboard,
  AlertTriangle,
  CreditCard,
  BarChart3,
  Globe,
  Command,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  category: 'navigation' | 'action' | 'tenant';
  href?: string;
  action?: () => void;
}

const SUPERADMIN_ITEMS: PaletteItem[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Global system overview', icon: <LayoutDashboard className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin' },
  { id: 'demo', label: 'Demo Management', description: 'Create & revoke demo tokens', icon: <FlaskConical className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/demo' },
  { id: 'hospitals', label: 'Hospitals', description: 'Tenant onboarding & governance', icon: <Building2 className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/hospitals' },
  { id: 'users', label: 'Users', description: 'Cross-tenant user search', icon: <Users className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/users' },
  { id: 'audit', label: 'Audit Logs', description: 'Security event trail', icon: <FileText className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/audit' },
  { id: 'errors', label: 'Error Tracker', description: 'Grouped errors & assignees', icon: <AlertTriangle className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/errors' },
  { id: 'public-health', label: 'Public Health', description: 'Disease surveillance', icon: <Globe className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/public-health' },
  { id: 'compliance', label: 'Compliance', description: 'KDPA/HIPAA/ISO posture', icon: <Shield className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/compliance' },
  { id: 'capacity', label: 'Capacity Planner', description: 'Scaling forecasts & SLOs', icon: <BarChart3 className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/capacity-planner' },
  { id: 'payments', label: 'Payments', description: 'Platform billing & tiers', icon: <CreditCard className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/payments' },
  { id: 'system', label: 'System Health', description: 'Service mesh & AI providers', icon: <Activity className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/system' },
  { id: 'settings', label: 'Settings', description: 'Feature flags & AI config', icon: <Settings className="h-4 w-4" />, category: 'navigation', href: '/portal/superadmin/settings' },
];

const RECENT_KEY = 'afyahero-cmd-recent';

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Simple fuzzy: each char must appear in order
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recent items
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      // Intentional: hydrate recent items from localStorage on mount
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setRecentIds(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setActiveIndex(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Filter items
  const filtered = useMemo(() => {
    if (!query) {
      // Show recent first, then all
      const recent = recentIds
        .map((id) => SUPERADMIN_ITEMS.find((i) => i.id === id))
        .filter(Boolean) as PaletteItem[];
      const rest = SUPERADMIN_ITEMS.filter((i) => !recentIds.includes(i.id));
      return [...recent, ...rest];
    }
    return SUPERADMIN_ITEMS.filter(
      (item) => fuzzyMatch(query, item.label) || (item.description && fuzzyMatch(query, item.description)),
    );
  }, [query, recentIds]);

  // Keep activeIndex in bounds when filtered list shrinks
  const safeActiveIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  const selectItem = useCallback((item: PaletteItem) => {
    // Save to recent
    const newRecent = [item.id, ...recentIds.filter((id) => id !== item.id)].slice(0, 5);
    setRecentIds(newRecent);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent));
    } catch { /* ignore */ }

    setOpen(false);
    if (item.href) {
      window.location.href = item.href;
    } else if (item.action) {
      item.action();
    }
  }, [recentIds]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered[safeActiveIndex]) {
        e.preventDefault();
        selectItem(filtered[safeActiveIndex]);
      }
    },
    [filtered, safeActiveIndex, selectItem],
  );

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [safeActiveIndex]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-content-border bg-content-surface px-3 py-1.5 text-sm text-slate transition-colors hover:border-mist hover:text-ink"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-content-border bg-content-bg px-1.5 py-0.5 text-[10px] font-mono text-slate">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-xl border border-content-border bg-content-bg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center border-b border-content-border px-4">
          <Search className="h-4 w-4 text-slate shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions, tenants..."
            className="flex-1 border-0 bg-transparent px-3 py-3 text-sm text-ink placeholder:text-slate focus:outline-none focus:ring-0"
            autoComplete="off"
          />
          <kbd className="rounded border border-content-border bg-content-surface px-1.5 py-0.5 text-[10px] font-mono text-slate">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {query === '' && recentIds.length > 0 && (
                <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate">
                  Recent
                </div>
              )}
              {filtered.map((item, idx) => (
                <button
                  key={item.id}
                  data-active={idx === safeActiveIndex}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    idx === safeActiveIndex
                      ? 'bg-portal-primary/10 text-ink'
                      : 'text-charcoal hover:bg-content-surface',
                  )}
                >
                  <span className="shrink-0 text-slate">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-slate truncate">{item.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate capitalize">{item.category}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-content-border px-4 py-2 text-[10px] text-slate">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-content-border bg-content-surface px-1">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-content-border bg-content-surface px-1">↵</kbd> select
            </span>
          </div>
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
