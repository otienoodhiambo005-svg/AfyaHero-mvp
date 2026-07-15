'use client';

import { useState } from 'react';
import { 
  FlaskConical, 
  Bell, 
  Shield, 
  Languages, 
  Accessibility, 
  Save, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Printer,
  Microscope,
  Lock,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentSettings } from '@/lib/settings';

type SettingsTab = 'testPanels' | 'reporting' | 'equipment' | 'quality' | 'samples' | 'notifications' | 'database' | 'accessibility' | 'language' | 'security';

const TABS: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
  { key: 'testPanels', label: 'Test Panels', icon: <FlaskConical className="w-4 h-4" /> },
  { key: 'reporting', label: 'Result Reporting', icon: <Printer className="w-4 h-4" /> },
  { key: 'equipment', label: 'Equipment', icon: <Microscope className="w-4 h-4" /> },
  { key: 'quality', label: 'Quality Control', icon: <Shield className="w-4 h-4" /> },
  { key: 'samples', label: 'Sample Management', icon: <Database className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { key: 'database', label: 'Reference Ranges', icon: <Database className="w-4 h-4" /> },
  { key: 'accessibility', label: 'Accessibility', icon: <Accessibility className="w-4 h-4" /> },
  { key: 'language', label: 'Language', icon: <Languages className="w-4 h-4" /> },
  { key: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
];

export default function LaboratorySettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('testPanels');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { settings, updateSettings, isLoading, reset } = useCurrentSettings('laboratory');

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
      aria-pressed={checked}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/40 focus-visible:ring-offset-2',
        checked ? 'bg-portal-primary' : 'bg-content-border'
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
      case 'testPanels':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Test Panels Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Default test panel</label>
                <select
                  value={settings.testPanels?.defaultPanel || ''}
                  onChange={(e) => handleUpdateSettings('testPanels', { ...settings.testPanels, defaultPanel: e.target.value })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="cbc">Complete Blood Count (CBC)</option>
                  <option value="cmp">Comprehensive Metabolic Panel</option>
                  <option value="lipid">Lipid Panel</option>
                  <option value="thyroid">Thyroid Panel</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-assign tests</p>
                  <p className="text-sm text-slate-500">Automatically assign tests based on diagnosis</p>
                </div>
                <Toggle checked={settings.testPanels?.autoAssign || false} onChange={(v) => handleUpdateSettings('testPanels', { ...settings.testPanels, autoAssign: v })} />
              </div>
            </div>
          </div>
        );
      case 'reporting':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Result Reporting Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-generate reports</p>
                  <p className="text-sm text-slate-500">Automatically generate reports after test completion</p>
                </div>
                <Toggle checked={settings.reporting?.autoGenerate || false} onChange={(v) => handleUpdateSettings('reporting', { ...settings.reporting, autoGenerate: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Report format</label>
                <select
                  value={settings.reporting?.format || 'pdf'}
                  onChange={(e) => handleUpdateSettings('reporting', { ...settings.reporting, format: e.target.value as 'pdf' | 'csv' | 'excel' })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 'equipment':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Equipment Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Maintenance schedule</label>
                <select
                  value={settings.equipment?.maintenanceSchedule || 'weekly'}
                  onChange={(e) => handleUpdateSettings('equipment', { ...settings.equipment, maintenanceSchedule: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Equipment alerts</p>
                  <p className="text-sm text-slate-500">Send alerts when equipment needs maintenance</p>
                </div>
                <Toggle checked={settings.equipment?.alerts || false} onChange={(v) => handleUpdateSettings('equipment', { ...settings.equipment, alerts: v })} />
              </div>
            </div>
          </div>
        );
      case 'quality':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Quality Control Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto QC</p>
                  <p className="text-sm text-slate-500">Automatically run quality control tests</p>
                </div>
                <Toggle checked={settings.quality?.autoQC || false} onChange={(v) => handleUpdateSettings('quality', { ...settings.quality, autoQC: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">QC frequency</label>
                <select
                  value={settings.quality?.qcFrequency || 'daily'}
                  onChange={(e) => handleUpdateSettings('quality', { ...settings.quality, qcFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
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
      case 'samples':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Sample Management Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-label samples</p>
                  <p className="text-sm text-slate-500">Automatically generate labels for new samples</p>
                </div>
                <Toggle checked={settings.samples?.autoLabel || false} onChange={(v) => handleUpdateSettings('samples', { ...settings.samples, autoLabel: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sample tracking</label>
                <select
                  value={settings.samples?.tracking || 'barcode'}
                  onChange={(e) => handleUpdateSettings('samples', { ...settings.samples, tracking: e.target.value as 'barcode' | 'rfid' | 'manual' })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="barcode">Barcode</option>
                  <option value="rfid">RFID</option>
                  <option value="manual">Manual</option>
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
              {(['systemAlerts', 'emailNotifications', 'pushNotifications', 'smsNotifications'] as const).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <p className="font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</p>
                  <Toggle checked={settings.notifications?.[key as keyof typeof settings.notifications] || false} onChange={(v) => handleUpdateSettings('notifications', { ...settings.notifications, [key]: v })} />
                </div>
              ))}
            </div>
          </div>
        );
      case 'database':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Database Sync Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sync database</p>
                  <p className="text-sm text-slate-500">Automatically sync lab data with central database</p>
                </div>
                <Toggle checked={settings.database?.sync || false} onChange={(v) => handleUpdateSettings('database', { ...settings.database, sync: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sync frequency</label>
                <select
                  value={settings.database?.syncFrequency || 'daily'}
                  onChange={(e) => handleUpdateSettings('database', { ...settings.database, syncFrequency: e.target.value as 'hourly' | 'daily' | 'weekly' })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
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
      case 'security':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Security Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-factor authentication</p>
                  <p className="text-sm text-slate-500">Require 2FA for sensitive operations</p>
                </div>
                <Toggle checked={settings.security?.twoFactorAuth || false} onChange={(v) => handleUpdateSettings('security', { ...settings.security, twoFactorAuth: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Audit log</p>
                  <p className="text-sm text-slate-500">Log all actions for compliance</p>
                </div>
                <Toggle checked={settings.security?.auditLog || false} onChange={(v) => handleUpdateSettings('security', { ...settings.security, auditLog: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Session timeout (minutes)</label>
                <input
                  type="number"
                  value={settings.security?.sessionTimeout || 30}
                  onChange={(e) => handleUpdateSettings('security', { ...settings.security, sessionTimeout: parseInt(e.target.value) || 30 })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-content-canvas p-4 md:p-6">
      <div className="mx-auto max-w-6xl rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Laboratory Settings</h1>
            <p className="mt-0.5 text-sm text-slate">Configure test panels, quality control, and reporting preferences</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-rose-700">
                <AlertCircle className="w-4 h-4" /> Save failed
              </span>
            )}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-card border border-content-border bg-content-bg px-4 py-2 text-sm text-charcoal transition-colors hover:bg-content-surface"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || !hasUnsavedChanges}
              className={cn(
                'flex items-center gap-2 rounded-card px-4 py-2 text-sm text-white transition-colors',
                hasUnsavedChanges ? 'bg-portal-primary hover:bg-portal-primary-hover' : 'cursor-not-allowed bg-slate-400'
              )}
            >
              <Save className="w-4 h-4" /> {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <nav className="w-full shrink-0 rounded-card border border-content-border bg-content-bg p-2 lg:w-64" aria-label="Lab settings sections">
            <div className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  aria-pressed={activeTab === tab.key}
                  className={cn(
                    'w-full rounded-card px-3 py-2 text-left text-sm transition-colors',
                    'flex items-center gap-3',
                    activeTab === tab.key
                      ? 'bg-portal-primary-light/35 font-medium text-portal-primary'
                      : 'text-slate hover:bg-content-surface hover:text-ink'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 rounded-card border border-content-border bg-content-bg p-5 text-charcoal shadow-card md:p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
