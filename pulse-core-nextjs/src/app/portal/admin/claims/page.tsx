'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  DollarSign, Clock, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, Download, Filter, RefreshCw, Loader2,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface ClaimStats {
  todayBilled: number;
  todayPaid: number;
  weekBilled: number;
  weekPaid: number;
  monthBilled: number;
  monthPaid: number;
  pending: number;
  rejected: number;
  rejectRate: number;
}

interface Claim {
  id: string;
  claimNumber: string;
  patientName: string;
  service: string;
  billed: number;
  approved: number;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'paid';
  date: string;
}

const EMPTY_STATS: ClaimStats = {
  todayBilled: 0, todayPaid: 0, weekBilled: 0, weekPaid: 0,
  monthBilled: 0, monthPaid: 0, pending: 0, rejected: 0, rejectRate: 0,
};

export default function ClaimsDashboardPage() {
  const [stats, setStats] = useState<ClaimStats>(EMPTY_STATS);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/claims', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load claims (${res.status})`);
      const data = await res.json();
      setStats(data.stats ?? EMPTY_STATS);
      setClaims(Array.isArray(data.claims) ? data.claims : []);
    } catch (err) {
      logger.error('Failed to load claims', { error: err });
      setError(err instanceof Error ? err.message : 'Could not load claims.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadClaims(); }, [loadClaims]);

  const filteredClaims = claims.filter(c => {
    if (search && !c.patientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  const totalBilled = filteredClaims.reduce((sum, c) => sum + c.billed, 0);
  const totalApproved = filteredClaims.reduce((sum, c) => sum + c.approved, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sw-KE', { 
      style: 'currency', 
      currency: 'KES',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const statusColors: Record<string, { bg: string; text: string; icon: any }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
    submitted: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
    approved: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
    paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: DollarSign },
  };

  return (
    <div className="h-full flex flex-col">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 p-6 bg-content-surface">
        <div className="bg-content-bg rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            {dateRange === 'today' && 'Leo'}
            {dateRange === 'week' && 'Wiki'}
            {dateRange === 'month' && 'Mwezi'}
          </div>
          <p className="text-2xl font-bold">{formatCurrency(
            dateRange === 'today' ? stats.todayBilled : 
            dateRange === 'week' ? stats.weekBilled : stats.monthBilled
          )}</p>
          <p className="text-xs text-gray-500">Zilizotumwa</p>
        </div>

        <div className="bg-content-bg rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Zilizolipwa
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(
            dateRange === 'today' ? stats.todayPaid : 
            dateRange === 'week' ? stats.weekPaid : stats.monthPaid
          )}</p>
          <p className="text-xs text-gray-500">
            {Math.round(
              (dateRange === 'today' ? stats.todayPaid : 
              dateRange === 'week' ? stats.weekPaid : stats.monthPaid) /
              (dateRange === 'today' ? stats.todayBilled : 
              dateRange === 'week' ? stats.weekBilled : stats.monthBilled) * 100
            )}% ya malipo
          </p>
        </div>

        <div className="bg-content-bg rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Zinazosubiri
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.pending)}</p>
          <p className="text-xs text-gray-500">{claims.filter(c => c.status === 'pending').length} claims</p>
        </div>

        <div className="bg-content-bg rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            Zilizokataliwa
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.rejected)}</p>
          <p className="text-xs text-gray-500">{stats.rejectRate}% reject rate</p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3 flex items-center justify-between bg-content-bg">
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="today">Leo</option>
            <option value="week">Wiki</option>
            <option value="month">Mwezi</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="all">Hali yoyote</option>
            <option value="pending">Inasubiri</option>
            <option value="submitted">Imetumwa</option>
            <option value="approved">Imepitwa</option>
            <option value="paid">Imelipwa</option>
            <option value="rejected">Imekataliwa</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-content-surface">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button 
            onClick={() => { setIsLoading(true); setTimeout(() => setIsLoading(false), 1000); }}
            className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-content-surface"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Sasisha
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-content-surface border-b sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarehe</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Namba</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mgonjwa</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Huduma</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kiasi</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">SHA</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hali</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredClaims.map((claim) => {
              const colors = statusColors[claim.status];
              const StatusIcon = colors.icon;
              return (
                <tr key={claim.id} className="hover:bg-content-surface cursor-pointer">
                  <td className="px-6 py-4 text-sm">{claim.date}</td>
                  <td className="px-6 py-4 text-sm font-medium">{claim.claimNumber}</td>
                  <td className="px-6 py-4 text-sm">{claim.patientName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{claim.service}</td>
                  <td className="px-6 py-4 text-sm text-right">{formatCurrency(claim.billed)}</td>
                  <td className="px-6 py-4 text-sm text-right">{formatCurrency(claim.approved)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', colors.bg, colors.text)}>
                      <StatusIcon className="w-3 h-3" />
                      {claim.status === 'pending' && 'Inasubiri'}
                      {claim.status === 'submitted' && 'Imetumwa'}
                      {claim.status === 'approved' && 'Imepitwa'}
                      {claim.status === 'paid' && 'Imelipwa'}
                      {claim.status === 'rejected' && 'Imekataliwa'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-content-surface border-t sticky bottom-0">
            <tr>
              <td colSpan={4} className="px-6 py-3 text-sm font-medium">Jumla</td>
              <td className="px-6 py-3 text-sm text-right font-medium">{formatCurrency(totalBilled)}</td>
              <td className="px-6 py-3 text-sm text-right font-medium">{formatCurrency(totalApproved)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}