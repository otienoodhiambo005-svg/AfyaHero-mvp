/**
 * Super Admin Sidebar Navigation
 * Isolated navigation menu for global administrators.
 *
 * Responsive behavior:
 *   - Desktop (md+): fixed left rail, always visible.
 *   - Mobile: hidden by default; toggled via a top-bar button rendered by
 *     this component. Closes on route change.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  AlertTriangle,
  CreditCard,
  Building2,
  Users,
  Activity,
  FileText,
  Settings,
  HeartPulse,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommandPalette } from '@/components/ui/CommandPalette';

const navigationItems = [
  { path: '/portal/superadmin', label: 'Dashboard', icon: Home },
  { path: '/portal/superadmin/demo', label: 'Demo Management', icon: Sparkles },
  { path: '/portal/superadmin/errors', label: 'Error Monitoring', icon: AlertTriangle },
  { path: '/portal/superadmin/public-health', label: 'Public Health', icon: HeartPulse },
  { path: '/portal/superadmin/compliance', label: 'Compliance', icon: ShieldCheck },
  { path: '/portal/superadmin/capacity-planner', label: 'Capacity planner', icon: BarChart3 },
  { path: '/portal/superadmin/payments', label: 'Payments', icon: CreditCard },
  { path: '/portal/superadmin/hospitals', label: 'Hospitals', icon: Building2 },
  { path: '/portal/superadmin/users', label: 'Users', icon: Users },
  { path: '/portal/superadmin/system', label: 'System Health', icon: Activity },
  { path: '/portal/superadmin/audit', label: 'Audit Logs', icon: FileText },
  { path: '/portal/superadmin/settings', label: 'Settings', icon: Settings },
];

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change (only when pathname actually changes)
  const initialPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== initialPathRef.current) {
      // Intentional: close mobile drawer when navigating
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      initialPathRef.current = pathname;
    }
  }, [pathname]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const navContent = (
    <nav className="p-4 space-y-1" aria-label="Superadmin navigation">
      {navigationItems.map((item) => {
        const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-card transition-all',
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-slate hover:bg-content-bg hover:text-ink',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-5 h-5" aria-hidden />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between gap-3 border-b border-content-border bg-content-surface px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-content-border text-ink hover:bg-content-bg"
          aria-label="Open superadmin navigation"
        >
          <Menu className="w-5 h-5" aria-hidden />
        </button>
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-charcoal">Super Admin</span>
          <span className="text-[11px] text-slate">Platform Management</span>
        </div>
      </div>

      {/* Spacer so mobile content isn't hidden behind the top bar */}
      <div className="md:hidden h-14" aria-hidden />

      {/* Desktop fixed rail */}
      <aside className="hidden md:block fixed left-0 top-0 h-screen w-64 bg-content-surface border-r border-content-border z-40">
        <div className="p-6 border-b border-content-border">
          <h2 className="text-xl font-bold text-charcoal">Super Admin</h2>
          <p className="text-sm text-slate mt-1">Platform Management</p>
          <div className="mt-3">
            <CommandPalette />
          </div>
        </div>
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80vw] bg-content-surface border-r border-content-border shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-content-border">
              <div>
                <h2 className="text-xl font-bold text-charcoal">Super Admin</h2>
                <p className="text-sm text-slate mt-1">Platform Management</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-control text-slate hover:bg-content-bg"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
