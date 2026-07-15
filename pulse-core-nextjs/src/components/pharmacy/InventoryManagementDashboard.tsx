'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Package,
  CheckCircle2,
  Clock,
  Zap,
  Calendar,
  BarChart3,
  Search,
  RefreshCw,
  Loader2,
  ChevronRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

interface InventoryItem {
  id: string;
  medication_name: string;
  stock_quantity: number;
  min_stock_level: number;
  unit_price: number;
  unit: string;
  expiry_date: string;
}

type SortField = 'name' | 'stock' | 'value' | 'urgency';
type FilterType = 'all' | 'low-stock' | 'overstock' | 'expiring' | 'optimal';

export default function InventoryManagementDashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortField>('urgency');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pharmacy_inventory')
        .select('*')
        .order('medication_name');

      if (!error && data) {
        setInventory(data);
      }
    } catch (error) {
      logger.error('Fetch Error', { error });
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (inventory.length === 0) return;
    setAnalyzing(true);
    try {
      const response = await fetch('/api/ai/smart-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType: 'comprehensive',
          data: inventory
        })
      });
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      logger.error('Analysis Error', { error });
    } finally {
      setAnalyzing(false);
    }
  };

  // Calculate stock status
  const getStockStatus = (item: InventoryItem) => {
    const percentageOfMin = (item.stock_quantity / item.min_stock_level) * 100;
    if (item.stock_quantity === 0) return 'stockout';
    if (percentageOfMin < 100) return 'low';
    if (percentageOfMin > 500) return 'overstock';
    if (item.expiry_date) {
      const daysUntilExpiry = Math.floor(
        (new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry < 0) return 'expired';
      if (daysUntilExpiry < 30) return 'expiring';
    }
    return 'optimal';
  };

  // Filter items
  const filteredItems = inventory.filter(item => {
    const status = getStockStatus(item);
    const matchesSearch = item.medication_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (filter) {
      case 'low-stock':
        return status === 'low' || status === 'stockout';
      case 'overstock':
        return status === 'overstock';
      case 'expiring':
        return status === 'expiring' || status === 'expired';
      case 'optimal':
        return status === 'optimal';
      default:
        return true;
    }
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.medication_name.localeCompare(b.medication_name);
      case 'stock':
        return b.stock_quantity - a.stock_quantity;
      case 'value':
        return (b.stock_quantity * b.unit_price) - (a.stock_quantity * a.unit_price);
      case 'urgency': {
        const statusOrder = { stockout: 0, expired: 1, low: 2, expiring: 3, overstock: 4, optimal: 5 };
        const aStatus = getStockStatus(a);
        const bStatus = getStockStatus(b);
        return (statusOrder[aStatus as keyof typeof statusOrder] ?? 6) - 
               (statusOrder[bStatus as keyof typeof statusOrder] ?? 6);
      }
      default:
        return 0;
    }
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      stockout: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Out of Stock' },
      expired: { icon: Calendar, color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Expired' },
      low: { icon: ArrowDown, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Low Stock' },
      expiring: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Expiring Soon' },
      overstock: { icon: ArrowUp, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Overstock' },
      optimal: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Optimal' }
    };
    const badge = badges[status as keyof typeof badges] || badges.optimal;
    const Icon = badge.icon;
    return { Icon, color: badge.color, bg: badge.bg, label: badge.label };
  };

  const summaryStats = {
    total: inventory.length,
    lowStock: inventory.filter(i => getStockStatus(i) === 'low').length,
    overstock: inventory.filter(i => getStockStatus(i) === 'overstock').length,
    expiring: inventory.filter(i => getStockStatus(i) === 'expiring').length,
    totalValue: inventory.reduce((sum, i) => sum + (i.stock_quantity * i.unit_price), 0)
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === sortedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(sortedItems.map(i => i.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald animate-spin mx-auto mb-4" />
          <p className="text-sage">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Inventory Management</h2>
          <p className="text-sage mt-2">Real-time stock tracking and optimization</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={runAnalysis}
            disabled={analyzing || inventory.length === 0}
            className={cn(
              'px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition',
              analyzing
                ? 'bg-white/5 text-sage cursor-not-allowed'
                : 'bg-emerald text-white hover:bg-emerald/90'
            )}
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {analyzing ? 'Analyzing...' : 'Smart Analysis'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-forest/40 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-sage font-bold uppercase tracking-wide">Total Items</p>
          <p className="text-2xl font-bold text-white mt-2">{summaryStats.total}</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
          <p className="text-xs text-rose-400 font-bold uppercase tracking-wide">Low Stock</p>
          <p className="text-2xl font-bold text-rose-300 mt-2">{summaryStats.lowStock}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <p className="text-xs text-orange-400 font-bold uppercase tracking-wide">Overstock</p>
          <p className="text-2xl font-bold text-orange-300 mt-2">{summaryStats.overstock}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <p className="text-xs text-amber-400 font-bold uppercase tracking-wide">Expiring</p>
          <p className="text-2xl font-bold text-amber-300 mt-2">{summaryStats.expiring}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-xs text-emerald-400 font-bold uppercase tracking-wide">Total Value</p>
          <p className="text-xl font-bold text-emerald-300 mt-2">${(summaryStats.totalValue / 1000).toFixed(1)}k</p>
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="bg-forest/40 border border-emerald/20 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-emerald mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Analysis Results
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-sage font-bold mb-1">Critical Alerts</p>
              <p className="text-2xl font-bold text-rose-400">{analysis.summary?.criticalAlerts || 0}</p>
            </div>
            <div>
              <p className="text-xs text-sage font-bold mb-1">Items in Category A</p>
              <p className="text-2xl font-bold text-emerald">{analysis.optimizations?.filter((o: any) => o.category === 'A').length || 0}</p>
            </div>
            <div>
              <p className="text-xs text-sage font-bold mb-1">Upcoming Actions</p>
              <p className="text-2xl font-bold text-blue-400">{analysis.recommendations?.length || 0}</p>
            </div>
            <div>
              <p className="text-xs text-sage font-bold mb-1">Supplier Options</p>
              <p className="text-2xl font-bold text-orange-400">{analysis.suppliers?.length || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage" />
          <input
            type="text"
            placeholder="Search medications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-forest/40 border border-white/5 rounded-lg text-white placeholder:text-sage focus:outline-none focus:border-emerald/30 transition"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="px-4 py-3 bg-forest/40 border border-white/5 rounded-lg text-white text-sm focus:outline-none focus:border-emerald/30 cursor-pointer hover:border-white/10 transition"
          >
            <option value="all">All Items</option>
            <option value="low-stock">Low Stock</option>
            <option value="overstock">Overstock</option>
            <option value="expiring">Expiring</option>
            <option value="optimal">Optimal</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="px-4 py-3 bg-forest/40 border border-white/5 rounded-lg text-white text-sm focus:outline-none focus:border-emerald/30 cursor-pointer hover:border-white/10 transition"
          >
            <option value="urgency">Sort: Urgency</option>
            <option value="name">Sort: Name</option>
            <option value="stock">Sort: Stock</option>
            <option value="value">Sort: Value</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="border border-white/5 rounded-2xl overflow-hidden bg-forest/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-forest/40">
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === sortedItems.length && sortedItems.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-white/20 bg-forest/40"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-sage uppercase tracking-wider">Medication</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-sage uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-sage uppercase tracking-wider">Min Level</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-sage uppercase tracking-wider">Unit Price</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-sage uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-sage uppercase tracking-wider">Expiry</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-sage uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-sage uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(item => {
                const status = getStockStatus(item);
                const { Icon: StatusIcon, color, bg, label } = getStatusBadge(status);
                const totalValue = item.stock_quantity * item.unit_price;

                return (
                  <tr key={item.id} className="border-b border-white/5 hover:bg-forest/30 transition">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="w-4 h-4 rounded border-white/20 bg-forest/40"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">{item.medication_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-mist">{item.stock_quantity} {item.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-mist">{item.min_stock_level} {item.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-mist">${item.unit_price.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">${totalValue.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      {item.expiry_date ? (
                        <span className="text-mist text-sm">{new Date(item.expiry_date).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-sage text-sm">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-lg border', bg)}>
                        <StatusIcon className={cn('w-4 h-4', color)} />
                        <span className={cn('text-xs font-bold', color)}>{label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-emerald hover:text-emerald/80 transition">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sortedItems.length === 0 && (
        <div className="text-center py-12 bg-forest/20 border border-white/5 rounded-2xl">
          <Package className="w-12 h-12 text-sage/40 mx-auto mb-4" />
          <p className="text-sage">No inventory items match your search</p>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#0C1510] border border-emerald-500/10 rounded-2xl p-6 shadow-2xl flex items-center gap-4">
          <span className="text-white font-bold">{selectedItems.size} selected</span>
          <div className="h-6 w-px bg-white/10" />
          <button className="px-4 py-2 bg-emerald text-white rounded-lg hover:bg-emerald/90 transition font-bold text-sm">
            Reorder
          </button>
          <button className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition font-bold text-sm">
            Export
          </button>
          <button
            onClick={() => setSelectedItems(new Set())}
            className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 transition font-bold text-sm"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
