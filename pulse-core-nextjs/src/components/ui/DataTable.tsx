'use client';

import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
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
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: string;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

type PaginationItem = number | 'start-ellipsis' | 'end-ellipsis';

function getPaginationItems(totalPages: number, currentPage: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'start-ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'start-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'end-ellipsis', totalPages];
}

/**
 * Data Table Component
 * Provides sorting, pagination, search, and export functionality
 * 
 * Usage:
 * ```tsx
 * <DataTable
 *   data={patients}
 *   columns={[
 *     { key: 'name', header: 'Name', accessor: (p) => p.name, sortable: true },
 *     { key: 'age', header: 'Age', accessor: (p) => p.age, sortable: true },
 *   ]}
 *   keyExtractor={(p) => p.id}
 *   title="Patients"
 *   searchable
 *   exportable
 * />
 * ```
 */
export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  title,
  description,
  searchable = false,
  searchPlaceholder = 'Search...',
  exportable = false,
  exportFilename = 'export',
  className,
  emptyState,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter((row) => {
      return columns.some((col) => {
        const value = String(col.accessor(row)).toLowerCase();
        return value.includes(query);
      });
    });
  }, [data, searchQuery, columns]);
  
  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    
    const column = columns.find((c) => c.key === sortConfig.key);
    if (!column || !column.sortable) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = String(column.accessor(a));
      const bValue = String(column.accessor(b));
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig, columns]);
  
  // Paginate data
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const paginationItems = useMemo(
    () => getPaginationItems(totalPages, currentPage),
    [totalPages, currentPage],
  );
  
  // Reset page when data changes
  useEffect(() => {
    // Defer setState to avoid synchronous setState in effect
    const timeoutId = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, sortConfig?.key, sortConfig?.direction]);
  
  const handleSort = (key: string) => {
    const column = columns.find((c) => c.key === key);
    if (!column?.sortable) return;
    
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };
  
  const handleExport = () => {
    const headers = columns.map((c) => c.header).join(',');
    const rows = sortedData.map((row) =>
      columns.map((col) => {
        const value = col.accessor(row);
        // Escape values containing commas or quotes
        const str = String(value).replace(/"/g, '""');
        return str.includes(',') ? `"${str}"` : str;
      }).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className={cn('bg-content-bg rounded-card border border-content-border shadow-card overflow-hidden', className)}>
      {/* Header */}
      {(title || description || searchable || exportable) && (
        <div className="px-4 py-4 border-b border-content-border/60 flex flex-col gap-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h3 className="text-lg font-semibold text-ink">{title}</h3>}
            {description && <p className="text-sm text-slate mt-0.5">{description}</p>}
          </div>
          
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            {searchable && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-content-border px-3 py-2 text-sm focus:outline-none focus:border-mist sm:w-64"
              />
            )}
            
            {exportable && (
              <button
                onClick={handleExport}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-content-border px-3 py-2 text-sm font-medium text-slate transition-colors hover:bg-content-border/40 sm:w-auto"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-content-border/40 border-b border-content-border/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-6 py-3 text-left text-xs font-semibold text-slate uppercase tracking-wider',
                    column.sortable && 'cursor-pointer hover:text-charcoal select-none',
                    onRowClick && 'cursor-pointer'
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                  tabIndex={column.sortable ? 0 : undefined}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && column.sortable) { e.preventDefault(); handleSort(column.key); } }}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && (
                      <span className="flex flex-col">
                        <ChevronUp 
                          className={cn(
                            'w-3 h-3 -mb-1',
                            sortConfig?.key === column.key && sortConfig.direction === 'asc'
                              ? 'text-ink'
                              : 'text-slate/40'
                          )} 
                        />
                        <ChevronDown 
                          className={cn(
                            'w-3 h-3',
                            sortConfig?.key === column.key && sortConfig.direction === 'desc'
                              ? 'text-ink'
                              : 'text-slate/40'
                          )} 
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-content-border/60">
            {paginatedData.length > 0 ? (
              paginatedData.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className={cn(
                    'hover:bg-content-border/40 transition-colors',
                    onRowClick && 'cursor-pointer',
                    rowClassName
                  )}
                  onClick={() => onRowClick?.(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onRowClick) { e.preventDefault(); onRowClick(row); } }}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-ink">
                      {column.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  {emptyState || (
                    <div className="text-slate/70">
                      <p className="text-sm">No data available</p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-4 border-t border-content-border/60 flex flex-col gap-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm text-slate">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length}
            </span>
            
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="w-full rounded border border-content-border px-2 py-1 text-sm sm:ml-2 sm:w-auto"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </div>
          
          <div className="flex max-w-full items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
              className="p-1 rounded-lg text-slate hover:bg-content-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1">
              {paginationItems.map((item) => {
                if (typeof item !== 'number') {
                  return (
                    <span
                      key={item}
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-sm text-slate"
                    >
                      ...
                    </span>
                  );
                }

                return (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    aria-current={currentPage === item ? 'page' : undefined}
                    aria-label={`Go to page ${item}`}
                    className={cn(
                      'h-8 w-8 shrink-0 rounded-lg text-sm font-medium transition-colors',
                      currentPage === item
                        ? 'bg-ink text-content-bg'
                        : 'text-slate hover:bg-content-border/60'
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
              className="p-1 rounded-lg text-slate hover:bg-content-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
