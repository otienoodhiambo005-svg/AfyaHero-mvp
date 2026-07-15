'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  Send, ArrowRightLeft, UserPlus, Check, X, 
  Loader2, Search, Filter, Building2, Phone, Calendar 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

type ReferralStatus = 'requested' | 'accepted' | 'rejected' | 'completed';

interface Referral {
  id: string;
  patientName: string;
  patientPhone: string;
  reason: string;
  facility: string;
  status: ReferralStatus;
  createdAt: string;
  notes?: string;
}

export default function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'out' | 'create'>('inbox');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReferralStatus | 'all'>('all');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [inbox, setInbox] = useState<Referral[]>([]);
  const [outbox, setOutbox] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/referrals', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load referrals (${res.status})`);
      const data = await res.json();
      const all: Referral[] = Array.isArray(data.referrals) ? data.referrals : [];
      setInbox(all.filter(r => r.status === 'requested' || r.status === 'accepted'));
      setOutbox(all.filter(r => r.status === 'completed' || r.status === 'rejected'));
    } catch (err) {
      logger.error('Failed to load referrals', { error: err });
      setError(err instanceof Error ? err.message : 'Could not load referrals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReferrals(); }, [loadReferrals]);

  const referrals = activeTab === 'inbox' ? inbox : outbox;

  const filteredReferrals = referrals.filter(r => {
    if (search && !r.patientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const [actionBusy, setActionBusy] = useState(false);

  const handleAccept = async (referral: Referral) => {
    setActionBusy(true);
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId: referral.id, action: 'accept' }),
      });
      if (!res.ok) throw new Error('Failed to accept referral');
      await loadReferrals();
    } catch (err) {
      logger.error('Failed to accept referral', { error: err });
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (referral: Referral, reason: string) => {
    setActionBusy(true);
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId: referral.id, action: 'reject', reason }),
      });
      if (!res.ok) throw new Error('Failed to reject referral');
      await loadReferrals();
    } catch (err) {
      logger.error('Failed to reject referral', { error: err });
    } finally {
      setActionBusy(false);
    }
  };

  const statusColors: Record<ReferralStatus, string> = {
    requested: 'bg-amber-100 text-amber-700 border-amber-200',
    accepted: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <div className="flex h-full">
      {/* Main List */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between bg-content-bg">
          <h1 className="text-xl font-semibold">Rufaa {activeTab === 'inbox' ? 'Zilizoingia' : 'Zilizotumwa'}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('inbox')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === 'inbox' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Inbox ({inbox.length})
            </button>
            <button
              onClick={() => setActiveTab('out')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === 'out' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Sent
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === 'create' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Send className="w-4 h-4 inline mr-1" />
              Peleka
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="border-b px-6 py-3 flex gap-4 bg-gray-50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ReferralStatus | 'all')}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="all">All Status</option>
            <option value="requested">Inasubiri</option>
            <option value="accepted">Imekubaliwa</option>
            <option value="rejected">Imekataliwa</option>
            <option value="completed">Imemalizika</option>
          </select>
        </div>

        {/* Referral List */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex justify-center items-center h-full text-red-500">
              {error}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReferrals.map((referral) => (
                <div
                  key={referral.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedReferral(referral)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedReferral(referral); } }}
                  className={cn(
                    'border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35',
                    selectedReferral?.id === referral.id
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-content-border'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{referral.patientName}</h3>
                      <p className="text-sm text-gray-500">{referral.reason}</p>
                      <p className="text-sm text-gray-500">{referral.facility}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium border',
                        statusColors[referral.status]
                      )}>
                        {referral.status === 'requested' && 'Inasubiri'}
                        {referral.status === 'accepted' && 'Imekubaliwa'}
                        {referral.status === 'rejected' && 'Imekataliwa'}
                        {referral.status === 'completed' && 'Imemalizika'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {new Date(referral.createdAt).toLocaleDateString('sw-KE', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedReferral && activeTab === 'inbox' && (
        <div className="w-96 border-l bg-content-bg flex flex-col">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold">Maelezo</h2>
            <button onClick={() => setSelectedReferral(null)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Mgonjwa</label>
                <p className="font-medium">{selectedReferral.patientName}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Simu</label>
                <p className="font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {selectedReferral.patientPhone}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Sababu</label>
                <p className="font-medium">{selectedReferral.reason}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Hospitali</label>
                <p className="font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {selectedReferral.facility}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Maelezo</label>
                <p className="text-sm">{selectedReferral.notes || 'Hakuna'}</p>
              </div>
            </div>
          </div>
          {selectedReferral.status === 'requested' && (
            <div className="border-t p-4 flex gap-2">
              <button
                onClick={() => handleAccept(selectedReferral)}
                disabled={actionBusy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {actionBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Kubali
              </button>
              <button
                onClick={() => handleReject(selectedReferral, 'No capacity')}
                disabled={actionBusy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Kataa
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}