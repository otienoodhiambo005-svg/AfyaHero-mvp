'use client';

import { useState } from 'react';
import { 
  Pill, 
  Bell, 
  Package, 
  Shield, 
  Languages, 
  Accessibility, 
  Save, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Printer,
  AlertTriangle,
  Database,
  Lock,
  BrainCircuit,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentSettings } from '@/lib/settings';

type SettingsTab = 'dispensing' | 'inventory' | 'notifications' | 'insurance' | 'accessibility' | 'language';

const TABS: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
  { key: 'dispensing', label: 'Dispensing', icon: <Pill className="w-4 h-4" /> },
  { key: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { key: 'insurance', label: 'Insurance', icon: <Shield className="w-4 h-4" /> },
  { key: 'accessibility', label: 'Accessibility', icon: <Accessibility className="w-4 h-4" /> },
  { key: 'language', label: 'Language', icon: <Languages className="w-4 h-4" /> },
];

export default function PharmacySettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('dispensing');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { settings, updateSettings, isLoading, reset } = useCurrentSettings('pharmacy');

  const handleUpdateSettings = (section: string, data: any) => {
    updateSettings({ [section]: data });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleReset = () => {
    reset();
    setHasUnsavedChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500 animate-pulse">Loading settings...</div>
      </div>
    );
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-portal-primary' : 'bg-slate-300'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-content-bg transition-transform',
        checked ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dispensing':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Dispensing Preferences</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Default quantity (days)</label>
                <input
                  type="number"
                  value={settings.dispensing?.defaultQuantity || 30}
                  onChange={(e) => handleUpdateSettings('dispensing', { ...settings.dispensing, defaultQuantity: parseInt(e.target.value) || 30 })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allow substitution</p>
                  <p className="text-sm text-slate-500">Allow generic substitution when brand is unavailable</p>
                </div>
                <Toggle checked={settings.dispensing?.allowSubstitution || false} onChange={(v) => handleUpdateSettings('dispensing', { ...settings.dispensing, allowSubstitution: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable interaction checking</p>
                  <p className="text-sm text-slate-500">Check for drug interactions before dispensing</p>
                </div>
                <Toggle checked={settings.dispensing?.enableInteractionChecking || false} onChange={(v) => handleUpdateSettings('dispensing', { ...settings.dispensing, enableInteractionChecking: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable barcode scanning</p>
                  <p className="text-sm text-slate-500">Use barcode scanner for medication verification</p>
                </div>
                <Toggle checked={settings.dispensing?.enableBarcodeScanning || false} onChange={(v) => handleUpdateSettings('dispensing', { ...settings.dispensing, enableBarcodeScanning: v })} />
              </div>
            </div>
          </div>
        );
      case 'inventory':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Inventory Alerts Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Low stock threshold (units)</label>
                <input
                  type="number"
                  value={settings.inventory?.lowStockThreshold || 10}
                  onChange={(e) => handleUpdateSettings('inventory', { ...settings.inventory, lowStockThreshold: parseInt(e.target.value) || 10 })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expiry warning (days before)</label>
                <input
                  type="number"
                  value={settings.inventory?.expiryWarningDays || 30}
                  onChange={(e) => handleUpdateSettings('inventory', { ...settings.inventory, expiryWarningDays: parseInt(e.target.value) || 30 })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-reorder</p>
                  <p className="text-sm text-slate-500">Automatically generate reorder requests when stock is low</p>
                </div>
                <Toggle checked={settings.inventory?.autoReorder || false} onChange={(v) => handleUpdateSettings('inventory', { ...settings.inventory, autoReorder: v })} />
              </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
            <div className="space-y-4">
              {(['lowStockAlerts', 'expiryAlerts', 'reorderReminders', 'emailNotifications'] as const).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <p className="font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</p>
                  <Toggle checked={settings.notifications?.[key as keyof typeof settings.notifications] || false} onChange={(v) => handleUpdateSettings('notifications', { ...settings.notifications, [key]: v })} />
                </div>
              ))}
            </div>
          </div>
        );
      case 'insurance':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Insurance Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-verify coverage</p>
                  <p className="text-sm text-slate-500">Automatically check patient insurance coverage before dispensing</p>
                </div>
                <Toggle checked={settings.insurance?.autoClaimProcessing || false} onChange={(v) => handleUpdateSettings('insurance', { ...settings.insurance, autoClaimProcessing: v })} />
              </div>
            </div>
          </div>
        );
      case 'accessibility':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Accessibility</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Font size</label>
                <select
                  value={settings.accessibility?.fontSize || 'medium'}
                  onChange={(e) => handleUpdateSettings('accessibility', { ...settings.accessibility, fontSize: e.target.value as 'small' | 'medium' | 'large' })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-medium">High contrast mode</p>
                <Toggle checked={settings.accessibility?.highContrast || false} onChange={(v) => handleUpdateSettings('accessibility', { ...settings.accessibility, highContrast: v })} />
              </div>
            </div>
          </div>
        );
      case 'language':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Language Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Preferred language</label>
                <select
                  value={settings.language?.preferredLanguage || 'en'}
                  onChange={(e) => handleUpdateSettings('language', { ...settings.language, preferredLanguage: e.target.value })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                  <option value="am">Amharic</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-medium">Auto-detect language</p>
                <Toggle checked={settings.language?.autoDetect || false} onChange={(v) => handleUpdateSettings('language', { ...settings.language, autoDetect: v })} />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Pharmacy Settings</h1>
            <p className="text-slate">Configure dispensing, inventory, and safety preferences</p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-600 text-sm">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-rose-600 text-sm">
                <AlertCircle className="w-4 h-4" /> Save failed
              </span>
            )}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-card border border-content-border px-4 py-2 text-sm font-medium text-charcoal hover:bg-content-bg"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || !hasUnsavedChanges}
              className={cn(
                'flex items-center gap-2 rounded-card px-4 py-2 text-sm text-white',
                hasUnsavedChanges ? 'bg-portal-primary hover:bg-portal-primary-hover' : 'cursor-not-allowed bg-slate-400'
              )}
            >
              <Save className="w-4 h-4" /> {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          <nav className="w-56 shrink-0" aria-label="Pharmacy settings sections">
            <div className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                    activeTab === tab.key
                      ? 'bg-portal-primary-light/35 text-portal-primary font-medium'
                      : 'text-slate hover:bg-content-bg'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 rounded-card border border-content-border bg-content-bg p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
