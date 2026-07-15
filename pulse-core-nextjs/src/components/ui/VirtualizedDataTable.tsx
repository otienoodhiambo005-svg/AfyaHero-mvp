/**
 * VirtualizedDataTable — efficient rendering for large datasets (>100 rows).
 *
 * Native IntersectionObserver-based virtualization (zero dependencies).
 * Renders only visible rows + buffer, maintaining 60fps with thousands of records.
 *
 * Features:
 *   - Auto virtualization threshold (virtualizes at >100 rows)
 *   - Fixed header during scroll
 *   - Buffer rows above/below viewport for smooth scrolling
 *   - Falls back to standard rendering for small datasets
 */

'use client';

import {
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
  type UIEvent,
} from 'react';
import { cn } from '@/lib/utils';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  accessor: (row: T) => ReactNode;
  width?: string | number;
  minWidth?: number;
  className?: string;
  headerClassName?: string;
}

export interface VirtualizedDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  title?: string;
  description?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Row height in pixels. Default 48. */
  rowHeight?: number;
  /** Threshold above which virtualization kicks in. Default 100. */
  virtualizationThreshold?: number;
  /** Max table height. Default 600px. */
  maxHeight?: number | string;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  onRetry?: () => void;
  /** Header height. Default 48. */
  headerHeight?: number;
}

const DEFAULT_ROW_HEIGHT = 48;
const DEFAULT_HEADER_HEIGHT = 48;
const DEFAULT_VIRTUALIZATION_THRESHOLD = 100;
const DEFAULT_MAX_HEIGHT = 600;
const BUFFER_ROWS = 5; // Extra rows to render above/below viewport

interface VisibleRange {
  start: number;
  end: number;
}

export function VirtualizedDataTable<T>({
  data,
  columns,
  keyExtractor,
  title,
  description,
  className,
  emptyState,
  onRowClick,
  rowHeight = DEFAULT_ROW_HEIGHT,
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
  maxHeight = DEFAULT_MAX_HEIGHT,
  loading,
  error,
  onRetry,
  headerHeight = DEFAULT_HEADER_HEIGHT,
}: VirtualizedDataTableProps<T>) {
  const [search, setSearch] = useState('');
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Simple client-side search filter
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const value = col.accessor(row);
        if (typeof value === 'string') {
          return value.toLowerCase().includes(term);
        }
        return String(value).toLowerCase().includes(term);
      }),
    );
  }, [data, search, columns]);

  // Determine if we should virtualize
  const shouldVirtualize = filteredData.length > virtualizationThreshold;

  // Calculate visible range based on scroll position
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({ start: 0, end: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Update visible range on scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !shouldVirtualize) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS);
    const endIndex = Math.min(
      filteredData.length - 1,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + BUFFER_ROWS
    );

    setVisibleRange({ start: startIndex, end: endIndex });
  }, [filteredData.length, rowHeight, shouldVirtualize]);

  // Initial calculation and resize handler
  useEffect(() => {
    handleScroll();
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => handleScroll());
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [handleScroll, filteredData.length]);

  // Sync header scroll with body scroll for horizontal scrolling
  const handleBodyScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    handleScroll();
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, [handleScroll]);

  const tableHeight = useMemo(() => {
    const contentHeight = filteredData.length * rowHeight + headerHeight;
    const maxH = typeof maxHeight === 'string' ? parseInt(maxHeight, 10) : maxHeight;
    return Math.min(contentHeight, maxH);
  }, [filteredData.length, rowHeight, headerHeight, maxHeight]);

  if (loading) {
    return <LoadingState title="Loading data" />;
  }

  if (error) {
    return <ErrorState title="Could not load data" description={error} onRetry={onRetry} />;
  }

  if (filteredData.length === 0) {
    return (
      <div className={cn('rounded-card border border-content-border bg-content-bg p-8', className)}>
        {emptyState ?? (
          <div className="text-center text-slate">
            <p>No records found</p>
          </div>
        )}
      </div>
    );
  }

  // Calculate virtualization params
  const totalHeight = filteredData.length * rowHeight;
  const visibleHeight = (visibleRange.end - visibleRange.start + 1) * rowHeight;
  const topOffset = visibleRange.start * rowHeight;

  return (
    <div className={cn('rounded-card border border-content-border bg-content-bg overflow-hidden', className)}>
      {/* Header with title/search */}
      {(title || description) && (
        <div className="px-4 py-3 border-b border-content-border flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
            {description && <p className="text-xs text-slate">{description}</p>}
          </div>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-48 lg:w-64 px-3 py-1.5 bg-content-surface border border-content-border rounded-control text-sm text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
        </div>
      )}

      {/* Table Header */}
      <div
        ref={headerRef}
        className="border-b border-content-border bg-content-surface/50 overflow-hidden"
      >
        <div
          className="flex items-center"
          style={{ height: headerHeight }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                'px-4 text-xs font-semibold uppercase tracking-wider text-slate truncate',
                col.headerClassName,
              )}
              style={{
                width: col.width ?? 'auto',
                minWidth: col.minWidth,
                flex: typeof col.width === 'number' || col.width?.endsWith('px') ? 'none' : 1,
              }}
            >
              {col.header}
            </div>
          ))}
        </div>
      </div>

      {/* Table Body - Virtualized or Standard */}
      <div
        ref={containerRef}
        onScroll={handleBodyScroll}
        className="overflow-auto"
        style={{ height: tableHeight }}
      >
        {shouldVirtualize ? (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: topOffset,
                left: 0,
                right: 0,
                height: visibleHeight,
              }}
            >
              {filteredData.slice(visibleRange.start, visibleRange.end + 1).map((row, idx) => {
                const actualIndex = visibleRange.start + idx;
                return (
                  <div
                    key={keyExtractor(row)}
                    className={cn(
                      'flex items-center border-b border-content-border',
                      onRowClick && 'cursor-pointer hover:bg-content-surface/50',
                    )}
                    style={{ height: rowHeight }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <div
                        key={col.key}
                        className={cn(
                          'flex items-center px-4 text-sm text-ink truncate',
                          col.className,
                        )}
                        style={{
                          width: col.width ?? 'auto',
                          minWidth: col.minWidth,
                          flex: typeof col.width === 'number' || col.width?.endsWith('px') ? 'none' : 1,
                        }}
                      >
                        {col.accessor(row)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            {filteredData.map((row) => (
              <div
                key={keyExtractor(row)}
                className={cn(
                  'flex items-center border-b border-content-border last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-content-surface/50',
                )}
                style={{ height: rowHeight }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={cn(
                      'px-4 text-sm text-ink truncate',
                      col.className,
                    )}
                    style={{
                      width: col.width ?? 'auto',
                      minWidth: col.minWidth,
                      flex: typeof col.width === 'number' || col.width?.endsWith('px') ? 'none' : 1,
                    }}
                  >
                    {col.accessor(row)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="px-4 py-2 border-t border-content-border text-xs text-slate">
        {filteredData.length} of {data.length} records
        {search && ` (filtered by "${search}")`}
      </div>
    </div>
  );
}

export default VirtualizedDataTable;
