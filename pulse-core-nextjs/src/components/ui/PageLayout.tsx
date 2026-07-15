import { cn } from '@/lib/utils';
import { Breadcrumb, BreadcrumbItem } from './Breadcrumb';
import { ArrowLeft } from 'lucide-react';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  '2xl': 'max-w-7xl',
  full: '',
};

/**
 * Standardized page layout component
 * Provides consistent padding, max-width, and header structure
 */
function PageLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  backHref,
  actions,
  className,
  contentClassName,
  headerClassName,
  maxWidth = 'xl',
}: PageLayoutProps) {
  return (
    <div className={cn('min-h-full', className)}>
      {/* Header Section */}
      {(title || breadcrumbs || actions) && (
        <header className={cn('mb-6 rounded-[1.5rem] border border-content-border bg-content-bg p-4 shadow-sm', headerClassName)}>
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="mb-3">
              <Breadcrumb items={breadcrumbs} />
            </div>
          )}
          
          {/* Title Row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {/* Back Button */}
              {backHref && (
                <a
                  href={backHref}
                  className="-ml-2 rounded-full p-2 text-slate transition-colors hover:bg-content-border/60 hover:text-ink"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </a>
              )}
              
              <div>
                {title && (
                  <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
                )}
                {subtitle && (
                  <p className="text-sm text-slate mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
            
            {/* Actions */}
            {actions && (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            )}
          </div>
        </header>
      )}
      
      {/* Content */}
      <div className={cn(maxWidthClasses[maxWidth], 'mx-auto', contentClassName)}>
        {children}
      </div>
    </div>
  );
}

/**
 * Page section component for consistent section styling
 */
export interface PageSectionProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
}

export function PageSection({
  children,
  title,
  description,
  className,
  contentClassName,
}: PageSectionProps) {
  return (
    <section className={cn('rounded-[1.5rem] border border-content-border bg-content-bg shadow-card', className)}>
      {(title || description) && (
        <div className="px-6 py-4 border-b border-content-border/60">
          {title && (
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-slate mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className={cn('p-6', contentClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * Grid layout for page content
 */
interface PageGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const gapClasses = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
};

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function PageGrid({
  children,
  columns = 1,
  gap = 'md',
  className,
}: PageGridProps) {
  return (
    <div className={cn('grid', columnClasses[columns], gapClasses[gap], className)}>
      {children}
    </div>
  );
}

export default PageLayout;
export { PageLayout };