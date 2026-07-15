'use client';

import { cn } from '@/lib/utils';
import { tokens, type PortalType } from '@/styles/design-tokens';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { Skeleton } from './Skeleton';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
  };
  accentColor?: string;
  portal?: PortalType;
  loading?: boolean;
  error?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * Standardized KPI Card component
 * Used across all portals for consistent metrics display
 * 
 * Usage:
 * ```tsx
 * <KPICard
 *   title="Active Patients"
 *   value={42}
 *   icon={Users}
 *   trend={{ value: 12, label: "vs last week" }}
 *   portal="medical"
 *   subtitle="Currently in queue"
 * />
 * ```
 */
function KPICard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  accentColor,
  portal,
  loading = false,
  error = false,
  className,
  onClick,
}: KPICardProps) {
  // Determine accent color
  const color = accentColor || (portal ? tokens.colors.portals[portal] : tokens.colors.primary[500]);
  
  // Trend icon and color
  const TrendIcon = trend ? (trend.value > 0 ? TrendingUp : trend.value < 0 ? TrendingDown : Minus) : null;
  const trendColor = trend
    ? trend.value > 0
      ? tokens.colors.status.success
      : trend.value < 0
      ? tokens.colors.status.error
      : tokens.colors.neutral.slate
    : null;
  
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[1.5rem] border border-content-border bg-content-bg/90 p-card shadow-card transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover hover:border-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--portal-primary)]',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-100"
        style={{ backgroundColor: `${color}18` }}
      />
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div
          className="relative flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-[1rem] ring-1 ring-inset"
          style={{ 
            backgroundColor: `${color}14`,
            color: color,
            borderColor: `${color}22`
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        
        {/* Trend */}
        {trend && TrendIcon && trendColor && (
          <div 
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset"
            style={{ 
              backgroundColor: `${trendColor}14`,
              color: trendColor
            }}
          >
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      
      {/* Value */}
      <div className="mt-4">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-content-border rounded w-24"></div>
          </div>
        ) : error ? (
          <div className="text-slate text-2xl font-semibold">—</div>
        ) : (
          <div className="relative text-[1.75rem] leading-tight font-semibold tracking-tight text-ink">{value}</div>
        )}
        
        {/* Title */}
        <div className="mt-1 text-sm font-medium text-charcoal">{title}</div>
        
        {/* Subtitle */}
        {subtitle && (
          <div className="text-xs text-slate mt-1">{subtitle}</div>
        )}
        
        {/* Trend label */}
        {trend?.label && (
          <div className="text-xs text-slate mt-1">{trend.label}</div>
        )}
      </div>
    </div>
  );
}

/**
 * KPI Card Grid for displaying multiple KPIs
 */
interface KPICardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

const gridColumns = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function KPICardGrid({ children, columns = 4, className }: KPICardGridProps) {
  return (
    <div className={cn('grid gap-5', gridColumns[columns], className)}>
      {children}
    </div>
  );
}

/**
 * KPI Card Skeleton for loading states
 */
export function KPICardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-content-bg rounded-card border border-content-border p-card shadow-card', className)}>
      <div className="flex items-start justify-between">
        <Skeleton className="w-11 h-11 rounded-card min-h-[44px] min-w-[44px]" />
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

/**
 * Legacy KPI Hero Strip - refactored to use design tokens
 * Used for top-of-page KPIs with dark background
 */
interface KPIHeroItemProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
}

export function KPIHeroItem({ icon: Icon, label, value, color = tokens.colors.primary[500] }: KPIHeroItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color }} className="opacity-70">
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className="text-[10px] uppercase tracking-wider leading-none opacity-60" style={{ color: tokens.colors.neutral.mist }}>
          {label}
        </p>
        <p className="text-content-bg font-mono text-lg leading-tight mt-0.5">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export default KPICard;
export { KPICard };