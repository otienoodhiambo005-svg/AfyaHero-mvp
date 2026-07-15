'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    className?: string;
    headerAction?: ReactNode;
    /** If true, applies zero default padding to the chart area */
    flush?: boolean;
}

/**
 * Reusable Recharts wrapper card that provides a consistent visual frame
 * for all portal analytics charts. Matches the PRD-specified dark KPI strip
 * design language with rounded-card corners and content-border styling.
 */
export function ChartCard({ title, subtitle, children, className, headerAction, flush }: ChartCardProps) {
    return (
        <div className={cn('bg-content-bg rounded-card border border-content-border shadow-card overflow-hidden', className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-content-border/60">
                <div>
                    <h3 className="text-sm font-bold text-ink">{title}</h3>
                    {subtitle && <p className="text-[11px] text-slate mt-0.5">{subtitle}</p>}
                </div>
                {headerAction && <div>{headerAction}</div>}
            </div>

            {/* Chart Content */}
            <div className={cn('w-full', flush ? 'p-0' : 'p-5')}>
                {children}
            </div>
        </div>
    );
}
