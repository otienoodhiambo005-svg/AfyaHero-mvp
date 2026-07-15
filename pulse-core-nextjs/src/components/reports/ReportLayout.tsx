'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PageLayout, PageSection } from '@/components/ui/PageLayout';
import { DateRangePicker, DateRangeValue } from '@/components/ui/DateRangePicker';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';

interface ReportLayoutProps {
  title: string;
  description?: string;
  breadcrumbs: { label: string; href?: string }[];
  dateRange: DateRangeValue;
  onDateRangeChange: (value: DateRangeValue) => void;
  children: ReactNode;
  filters?: ReactNode;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
  className?: string;
  accentColor?: string;
}

/**
 * Report Layout Component
 * Provides consistent structure for all report pages
 * Includes header with date range picker, filters, and export actions
 * 
 * Usage:
 * ```tsx
 * <ReportLayout
 *   title="Patient Consultation Report"
 *   description="Analyze patient consultation trends"
 *   breadcrumbs={[{ label: 'Medical' }, { label: 'Reports' }]}
 *   dateRange={dateRange}
 *   onDateRangeChange={setDateRange}
 *   onExportCSV={handleExportCSV}
 *   onExportPDF={handleExportPDF}
 *   filters={<FilterPanel>... contents ...</FilterPanel>}
 * >
 *   {<!-- report content -->}
 * </ReportLayout>
 * ```
 */
export function ReportLayout({
  title,
  description,
  breadcrumbs,
  dateRange,
  onDateRangeChange,
  children,
  filters,
  onExportCSV,
  onExportPDF,
  onExportExcel,
  onPrint,
  className,
  accentColor: _accentColor = 'var(--portal-primary)',
}: ReportLayoutProps) {
  return (
    <PageLayout
      title={title}
      subtitle={description}
      breadcrumbs={breadcrumbs}
      maxWidth="full"
      className={className}
      actions={
        <div className="flex items-center gap-2">
          {/* Export Actions */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
            {onExportCSV && (
              <button
                onClick={onExportCSV}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                title="Export as CSV"
              >
                <FileText className="w-3.5 h-3.5" />
                CSV
              </button>
            )}
            
            {onExportExcel && (
              <button
                onClick={onExportExcel}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                title="Export as Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
            )}
            
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                title="Export as PDF"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            )}
            
            {onPrint && (
              <button
                onClick={onPrint}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                title="Print report"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            )}
          </div>
          
          {/* Date Range Picker */}
          <DateRangePicker
            value={dateRange}
            onChange={onDateRangeChange}
            align="right"
          />
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filters Section */}
        {filters && (
          <PageSection className="print:hidden">
            {filters}
          </PageSection>
        )}
        
        {/* Report Content */}
        {children}
      </div>
    </PageLayout>
  );
}

/**
 * Filter Panel Component
 * Container for report filters
 */
interface FilterPanelProps {
  children: ReactNode;
  className?: string;
}

export function FilterPanel({ children, className }: FilterPanelProps) {
  return (
    <div className={cn('flex flex-wrap gap-4', className)}>
      {children}
    </div>
  );
}

/**
 * Filter Select Component
 */
interface FilterSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FilterSelect({ label, value, options, onChange, placeholder }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-slate-400 bg-white w-full max-w-xs"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * KPI Grid for Reports
 */
interface ReportKPIGridProps {
  children: ReactNode;
  className?: string;
}

export function ReportKPIGrid({ children, className }: ReportKPIGridProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {children}
    </div>
  );
}

/**
 * Chart Container
 * Provides consistent chart sizing and loading states
 */
interface ChartContainerProps {
  title: string;
  description?: string;
  children: ReactNode;
  loading?: boolean;
  className?: string;
  height?: number;
}

export function ChartContainer({
  title,
  description,
  children,
  loading = false,
  className,
  height = 300,
}: ChartContainerProps) {
  return (
    <PageSection title={title} description={description} className={className}>
      <div style={{ height }} className="relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-32 w-48 bg-slate-200 rounded" />
              <div className="mt-4 h-4 w-32 bg-slate-200 rounded" />
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </PageSection>
  );
}
