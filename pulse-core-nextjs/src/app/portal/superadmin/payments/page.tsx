/**
 * Super Admin Payment Tracking Dashboard
 * Global payment processing monitoring across all hospitals
 * Aggregate anonymised transaction data only
 */
'use client';

import { useEffect, useState } from 'react';
import KPICard from '@/components/ui/KPICard';
import PageLayout from '@/components/ui/PageLayout';
import DataTable from '@/components/ui/DataTable';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';

interface PaymentStats {
  totalVolume: number;
  transactionCount: number;
  successRate: number;
  pendingCount: number;
  failedCount: number;
  averageTransactionValue: number;
}

interface HospitalTransaction {
  id: string;
  hospitalId: string;
  hospitalName: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  createdAt: string;
}

export default function PaymentTrackingPage() {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [transactions, setTransactions] = useState<HospitalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, txRes] = await Promise.all([
          fetch('/api/admin/payments/stats'),
          fetch('/api/admin/payments/transactions')
        ]);

        const statsData = await statsRes.json();
        const txData = await txRes.json();

        setStats(statsData);
        setTransactions(txData.transactions);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'refunded': return <RefreshCw className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const columns = [
    { key: 'id', header: 'Transaction ID', accessor: (row: HospitalTransaction) => row.id },
    { key: 'hospitalName', header: 'Hospital', accessor: (row: HospitalTransaction) => row.hospitalName },
    { 
      key: 'amount', 
      header: 'Amount',
      accessor: (row: HospitalTransaction) => `KSh ${row.amount.toLocaleString()}`
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row: HospitalTransaction) => (
        <div className="flex items-center gap-2">
          {statusIcon(row.status)}
          <span className="capitalize">{row.status}</span>
        </div>
      )
    },
    { key: 'paymentMethod', header: 'Method', accessor: (row: HospitalTransaction) => row.paymentMethod },
    { key: 'createdAt', header: 'Date', accessor: (row: HospitalTransaction) => row.createdAt },
  ];

  if (loading) {
    return (
      <PageLayout title="Payment Tracking">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-card" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Payment Tracking">
      <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Aggregate transaction monitoring only. Patient payment details are not accessible.</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Total Payment Volume"
            value={`KSh ${stats?.totalVolume?.toLocaleString() || 0}`}
            icon={DollarSign}
            trend={{ value: 12.4, label: 'vs last month' }}
          />
          <KPICard
            title="Transactions"
            value={stats?.transactionCount?.toLocaleString() || 0}
            icon={CreditCard}
          />
          <KPICard
            title="Success Rate"
            value={`${stats?.successRate || 0}%`}
            icon={TrendingUp}
            trend={{ value: 3.2, label: 'vs last month' }}
          />
          <KPICard
            title="Pending Transactions"
            value={stats?.pendingCount || 0}
            icon={Clock}
            trend={{ value: -8, label: 'vs last month' }}
          />
        </div>

        <div className="bg-content-bg dark:bg-gray-900 rounded-card p-6 border border-content-border dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <select 
              className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <DataTable<HospitalTransaction>
            columns={columns}
            data={transactions.filter(tx => statusFilter === 'all' || tx.status === statusFilter)}
            keyExtractor={(row) => row.id}
            searchable
            exportable
          />
        </div>
      </div>
    </PageLayout>
  );
}