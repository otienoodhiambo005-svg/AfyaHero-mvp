'use client';

import { useState } from 'react';
import { 
  Users, 
  Calendar, 
  Bell, 
  Languages, 
  Accessibility, 
  Save, 
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentSettings } from '@/lib/settings';

type SettingsTab = 'checkIn' | 'appointments' | 'notifications' | 'accessibility' | 'language';

const TABS: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
  { key: 'checkIn', label: 'Check-In', icon: <Users className="w-4 h-4" /> },
  { key: 'appointments', label: 'Appointments', icon: <Calendar className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { key: 'accessibility', label: 'Accessibility', icon: <Accessibility className="w-4 h-4" /> },
  { key: 'language', label: 'Language', icon: <Languages className="w-4 h-4" /> },
];

export default function OperationsSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('checkIn');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { settings, updateSettings, isLoading, reset } = useCurrentSettings('reception');

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
      case 'checkIn':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Check-In Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-assign queue</p>
                  <p className="text-sm text-slate-500">Automatically assign patients to queue based on priority</p>
                </div>
                <Toggle checked={settings.checkIn?.autoAssignQueue || false} onChange={(v) => handleUpdateSettings('checkIn', { ...settings.checkIn, autoAssignQueue: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default queue</label>
                <select
                  value={settings.checkIn?.defaultQueue || 'general'}
                  onChange={(e) => handleUpdateSettings('checkIn', { ...settings.checkIn, defaultQueue: e.target.value as 'general' | 'urgent' | 'triage' })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="general">General</option>
                  <option value="urgent">Urgent</option>
                  <option value="triage">Triage</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Require insurance verification</p>
                  <p className="text-sm text-slate-500">Verify insurance before check-in</p>
                </div>
                <Toggle checked={settings.checkIn?.requireInsuranceVerification || false} onChange={(v) => handleUpdateSettings('checkIn', { ...settings.checkIn, requireInsuranceVerification: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable patient search</p>
                  <p className="text-sm text-slate-500">Allow searching for existing patients</p>
                </div>
                <Toggle checked={settings.checkIn?.enablePatientSearch || false} onChange={(v) => handleUpdateSettings('checkIn', { ...settings.checkIn, enablePatientSearch: v })} />
              </div>
            </div>
          </div>
        );
      case 'appointments':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Appointment Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Default duration (minutes)</label>
                <input
                  type="number"
                  value={settings.appointments?.defaultDuration || 30}
                  onChange={(e) => handleUpdateSettings('appointments', { ...settings.appointments, defaultDuration: parseInt(e.target.value) || 30 })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable reminders</p>
                  <p className="text-sm text-slate-500">Send appointment reminders to patients</p>
                </div>
                <Toggle checked={settings.appointments?.enableReminders || false} onChange={(v) => handleUpdateSettings('appointments', { ...settings.appointments, enableReminders: v })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reminder advance time (hours)</label>
                <input
                  type="number"
                  value={settings.appointments?.reminderAdvanceTime || 24}
                  onChange={(e) => handleUpdateSettings('appointments', { ...settings.appointments, reminderAdvanceTime: parseInt(e.target.value) || 24 })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allow walk-ins</p>
                  <p className="text-sm text-slate-500">Accept patients without appointments</p>
                </div>
                <Toggle checked={settings.appointments?.allowWalkIns || false} onChange={(v) => handleUpdateSettings('appointments', { ...settings.appointments, allowWalkIns: v })} />
              </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
            <div className="space-y-4">
              {(['email', 'push', 'sms', 'appointmentReminders', 'systemAlerts'] as const).map((key) => (
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
                  onChange={(e) => handleUpdateSettings('accessibility', { ...settings.accessibility, fontSize: e.target.value as 'small' | 'medium' | 'large' | 'x-large' })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="x-large">Extra Large</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-medium">High contrast mode</p>
                <Toggle checked={settings.accessibility?.highContrast || false} onChange={(v) => handleUpdateSettings('accessibility', { ...settings.accessibility, highContrast: v })} />
              </div>
              <div className="flex items-center justify-between">
                <p className="font-medium">Screen reader optimized</p>
                <Toggle checked={settings.accessibility?.screenReader || false} onChange={(v) => handleUpdateSettings('accessibility', { ...settings.accessibility, screenReader: v })} />
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
                <label className="block text-sm font-medium mb-1">Interface language</label>
                <select
                  value={settings.language?.interface || 'en'}
                  onChange={(e) => handleUpdateSettings('language', { ...settings.language, interface: e.target.value })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                  <option value="am">Amharic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Patient communication language</label>
                <select
                  value={settings.language?.patientCommunication || 'en'}
                  onChange={(e) => handleUpdateSettings('language', { ...settings.language, patientCommunication: e.target.value })}
                  className="w-full max-w-xs rounded-md border border-content-border px-3 py-2"
                >
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                  <option value="am">Amharic</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-medium">Enable auto-translate</p>
                <Toggle checked={settings.language?.enableAutoTranslate || false} onChange={(v) => handleUpdateSettings('language', { ...settings.language, enableAutoTranslate: v })} />
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
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Operations Settings</h1>
            <p className="text-slate">Configure check-in, appointments, and communication preferences</p>
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-content-border text-slate-700 hover:bg-content-surface transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saveStatus === 'saving'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-portal-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="w-48 space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  activeTab === tab.key
                    ? 'bg-portal-primary/10 text-portal-primary font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
