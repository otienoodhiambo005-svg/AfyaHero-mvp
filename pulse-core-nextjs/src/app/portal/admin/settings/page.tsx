'use client';

import { useState } from 'react';
import { 
  Building2, 
  Users, 
  DollarSign, 
  FileText, 
  Shield, 
  Languages, 
  Accessibility, 
  Save, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentSettings } from '@/lib/settings';

type SettingsTab = 'facility' | 'staffing' | 'billing' | 'reporting' | 'notifications' | 'accessibility' | 'language';

const TABS: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
  { key: 'facility', label: 'Facility Profile', icon: <Building2 className="w-4 h-4" /> },
  { key: 'staffing', label: 'Staff & Roles', icon: <Users className="w-4 h-4" /> },
  { key: 'billing', label: 'Billing & Payments', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'reporting', label: 'Report Templates', icon: <FileText className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { key: 'accessibility', label: 'Accessibility', icon: <Accessibility className="w-4 h-4" /> },
  { key: 'language', label: 'Language', icon: <Languages className="w-4 h-4" /> },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('facility');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { settings, updateSettings, isLoading, reset } = useCurrentSettings('admin');

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
    if (hasUnsavedChanges) {
      setShowResetConfirm(true);
    } else {
      reset();
    }
  };

  const confirmReset = () => {
    reset();
    setHasUnsavedChanges(false);
    setShowResetConfirm(false);
  };

  const handleUpdateSettings = (section: string, data: any) => {
    updateSettings({ [section]: data });
    setHasUnsavedChanges(true);
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
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
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
      case 'facility':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Facility Profile Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Facility name</label>
                <input
                  type="text"
                  value={settings.facility?.name || ''}
                  onChange={(e) => handleUpdateSettings('facility', { ...settings.facility, name: e.target.value })}
                  className="w-full max-w-md rounded-md border border-content-border px-3 py-2"
                  placeholder="Enter facility name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">License number</label>
                <input
                  type="text"
                  value={settings.facility?.licenseNumber || ''}
                  onChange={(e) => handleUpdateSettings('facility', { ...settings.facility, licenseNumber: e.target.value })}
                  className="w-full max-w-md rounded-md border border-content-border px-3 py-2"
                  placeholder="Enter license number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={settings.facility?.address || ''}
                  onChange={(e) => handleUpdateSettings('facility', { ...settings.facility, address: e.target.value })}
                  className="w-full max-w-md rounded-md border border-content-border px-3 py-2"
                  placeholder="Enter facility address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="text"
                  value={settings.facility?.phone || ''}
                  onChange={(e) => handleUpdateSettings('facility', { ...settings.facility, phone: e.target.value })}
                  className="w-full max-w-md rounded-md border border-content-border px-3 py-2"
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </div>
        );
      case 'staffing':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Staff Management Configuration</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Require approval for new users</p>
                  <p className="text-sm text-slate-500">Require admin approval before new staff can access system</p>
                </div>
                <Toggle checked={settings.staffing?.requireApprovalForNewUsers || false} onChange={(v) => handleUpdateSettings('staffing', { ...settings.staffing, requireApprovalForNewUsers: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Session timeout (minutes)</label>
                <input
                  type="number"
                  value={settings.staffing?.sessionTimeout || 30}
                  onChange={(e) => handleUpdateSettings('staffing', { ...settings.staffing, sessionTimeout: parseInt(e.target.value) || 30 })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                />
              </div>
            </div>
          </div>
        );
      case 'billing':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Billing Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-billing</p>
                  <p className="text-sm text-slate-500">Automatically generate bills for services</p>
                </div>
                <Toggle checked={settings.billing?.autoBilling || false} onChange={(v) => handleUpdateSettings('billing', { ...settings.billing, autoBilling: v })} />
              </div>
            </div>
          </div>
        );
      case 'reporting':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Report Templates</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-generate reports</p>
                  <p className="text-sm text-slate-500">Automatically generate scheduled reports</p>
                </div>
                <Toggle checked={settings.reporting?.autoGenerateReports || false} onChange={(v) => handleUpdateSettings('reporting', { ...settings.reporting, autoGenerateReports: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Report frequency</label>
                <select
                  value={settings.reporting?.reportFrequency || 'monthly'}
                  onChange={(e) => handleUpdateSettings('reporting', { ...settings.reporting, reportFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
            <div className="space-y-4">
              {(['systemAlerts', 'staffOnboardingAlerts', 'complianceAlerts', 'emailNotifications'] as const).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <p className="font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</p>
                  <Toggle checked={settings.notifications?.[key as keyof typeof settings.notifications] || false} onChange={(v) => handleUpdateSettings('notifications', { ...settings.notifications, [key]: v })} />
                </div>
              ))}
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
    <div className="min-h-screen bg-content-surface dark:bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Settings</h1>
            <p className="text-slate-500">Configure facility profile, staff, billing, compliance, and communication settings</p>
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
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-content-border hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || !hasUnsavedChanges}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm rounded-md text-white',
                hasUnsavedChanges ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-400 cursor-not-allowed'
              )}
            >
              <Save className="w-4 h-4" /> {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          <nav className="w-56 shrink-0">
            <div className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                    activeTab === tab.key
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 bg-content-bg dark:bg-slate-800 rounded-lg border border-content-border dark:border-slate-700 p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-content-bg dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Confirm Reset</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              You have unsaved changes. Are you sure you want to reset all settings to their default values? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm rounded-md border border-content-border hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Reset Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
