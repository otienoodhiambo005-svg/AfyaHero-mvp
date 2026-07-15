'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

export type DateRange = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

export interface DateRangeValue {
  from: Date;
  to: Date;
  range: DateRange;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
  align?: 'left' | 'right';
}

const presets: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];

/**
 * Date Range Picker component
 * Provides preset options and custom date selection
 * 
 * Usage:
 * ```tsx
 * const [dateRange, setDateRange] = useState(getDefaultDateRange());
 * 
 * <DateRangePicker
 *   value={dateRange}
 *   onChange={setDateRange}
 *   align="right"
 * />
 * ```
 */
export function DateRangePicker({ value, onChange, className, align = 'left' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(formatDate(value.from));
  const [customTo, setCustomTo] = useState(formatDate(value.to));
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen]);
  
  const handlePresetClick = (range: DateRange) => {
    const { from, to } = getDatesForRange(range);
    onChange({ from, to, range });
    setCustomFrom(formatDate(from));
    setCustomTo(formatDate(to));
    
    if (range !== 'custom') {
      setIsOpen(false);
    }
  };
  
  const handleCustomApply = () => {
    const from = parseDate(customFrom);
    const to = parseDate(customTo);
    
    if (from && to && from <= to) {
      onChange({ from, to, range: 'custom' });
      setIsOpen(false);
    }
  };
  
  const displayLabel = getRangeLabel(value);
  
  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
          isOpen 
            ? 'border-mist bg-content-border/40' 
            : 'border-content-border bg-content-bg hover:border-mist'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <CalendarIcon className="w-4 h-4 text-slate" />
        <span className="text-charcoal">{displayLabel}</span>
        <ChevronDown className={cn('w-4 h-4 text-slate/70 transition-transform', isOpen && 'rotate-180')} />
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-72 bg-content-bg rounded-card border border-content-border shadow-lg',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          role="listbox"
        >
          {/* Presets */}
          <div className="p-2">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetClick(preset.value)}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-lg transition-colors',
                  value.range === preset.value
                    ? 'bg-content-border/60 text-ink font-medium'
                    : 'text-slate hover:bg-content-border/40'
                )}
                role="option"
                aria-selected={value.range === preset.value}
              >
                {preset.label}
              </button>
            ))}
          </div>
          
          {/* Custom Range */}
          {value.range === 'custom' && (
            <div className="border-t border-content-border/60 p-3">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-content-border text-sm focus:outline-none focus:border-mist"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-content-border text-sm focus:outline-none focus:border-mist"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCustomApply}
                  className="w-full px-3 py-2 bg-ink text-content-bg text-sm font-medium rounded-lg hover:bg-charcoal transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Get default date range (last 7 days)
 */
export function getDefaultDateRange(): DateRangeValue {
  return getDatesForRange('last7days');
}

/**
 * Get dates for a specific range preset
 */
export function getDatesForRange(range: DateRange): DateRangeValue {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 6);
  
  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 29);
  
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  
  switch (range) {
    case 'today':
      return { from: today, to: today, range };
    case 'yesterday':
      return { from: yesterday, to: yesterday, range };
    case 'last7days':
      return { from: last7Days, to: today, range };
    case 'last30days':
      return { from: last30Days, to: today, range };
    case 'thisMonth':
      return { from: thisMonthStart, to: today, range };
    case 'lastMonth':
      return { from: lastMonthStart, to: lastMonthEnd, range };
    case 'custom':
    default:
      return { from: last7Days, to: today, range };
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse date string
 */
function parseDate(str: string): Date | null {
  if (!str) return null;
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get human-readable label for date range
 */
function getRangeLabel(value: DateRangeValue): string {
  const preset = presets.find(p => p.value === value.range);
  
  if (value.range === 'custom' || !preset) {
    return `${formatDate(value.from)} - ${formatDate(value.to)}`;
  }
  
  return preset.label;
}

/**
 * Format date for API queries (ISO string)
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString();
}
