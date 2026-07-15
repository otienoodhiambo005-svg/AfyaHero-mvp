/**
 * ResponsiveDataTable — wraps DataTable with a card-based mobile layout.
 *
 * On viewports >= md, renders the standard DataTable.
 * On viewports <  md, renders each row as a stacked card using either:
 *   - A custom `renderMobileCard(row)` render prop, or
 *   - A default fallback that lists each column as a `<dt>/<dd>` pair.
 *
 * Use this for any table whose columns exceed what fits comfortably on
 * a phone (≈ 3 columns).
 */

'use client';

import { type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import DataTable, { type Column } from '@/components/ui/DataTable';

export interface ResponsiveDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  title?: string;
  description?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  exportable?: boolean;
  exportFilename?: string;
  className?: string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Custom mobile renderer. Falls back to a default if omitted. */
  renderMobileCard?: (row: T) => ReactNode;
  /** Subset of column keys to surface on mobile when using the default renderer. */
  mobilePrimaryKeys?: string[];
}

export function ResponsiveDataTable<T>({
  data,
  columns,
  keyExtractor,
  title,
  description,
  searchable,
  searchPlaceholder,
  exportable,
  exportFilename,
  className,
  emptyState,
  onRowClick,
  renderMobileCard,
  mobilePrimaryKeys,
}: ResponsiveDataTableProps<T>) {
  const mobileColumns =
    mobilePrimaryKeys && mobilePrimaryKeys.length > 0
      ? columns.filter((c) => mobilePrimaryKeys.includes(c.key))
      : columns;

  const defaultMobileCard = (row: T) => (
    <dl className="space-y-1.5">
      {mobileColumns.map((col) => (
        <div key={col.key} className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] items-start gap-3">
          <dt className="min-w-0 break-words text-xs font-medium uppercase tracking-wide text-slate">
            {col.header}
          </dt>
          <dd className="min-w-0 break-words text-right text-sm text-ink">{col.accessor(row)}</dd>
        </div>
      ))}
    </dl>
  );

  const handleMobileCardKeyDown = (event: KeyboardEvent<HTMLLIElement>, row: T) => {
    if (!onRowClick) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <>
      {/* Desktop / tablet */}
      <div className={cn('hidden md:block', className)}>
        <DataTable
          data={data}
          columns={columns}
          keyExtractor={keyExtractor}
          title={title}
          description={description}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder}
          exportable={exportable}
          exportFilename={exportFilename}
          emptyState={emptyState}
          onRowClick={onRowClick}
        />
      </div>

      {/* Mobile cards */}
      <div className={cn('md:hidden', className)}>
        {(title || description) && (
          <div className="mb-3">
            {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
            {description && <p className="text-xs text-slate">{description}</p>}
          </div>
        )}
        {data.length === 0 ? (
          <div className="rounded-card border border-content-border bg-content-bg p-6 text-center text-sm text-slate">
            {emptyState ?? 'No records'}
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((row) => (
              <li
                key={keyExtractor(row)}
                className={cn(
                  'rounded-card border border-content-border bg-content-bg p-3 shadow-sm',
                  onRowClick &&
                    'cursor-pointer transition-colors hover:border-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist focus-visible:ring-offset-2',
                )}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => handleMobileCardKeyDown(event, row) : undefined}
              >
                {renderMobileCard ? renderMobileCard(row) : defaultMobileCard(row)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default ResponsiveDataTable;
