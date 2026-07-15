'use client';

import { useState } from 'react';
import { Settings, Save, Globe, Bell, Shield, Database } from 'lucide-react';
import PageLayout, { PageSection } from '@/components/ui/PageLayout';
import { useCurrentSettings } from '@/lib/settings';

export default function SuperAdminSettingsPage() {
  const [saving, setSaving] = useState(false);

  const { settings, updateSettings, isLoading, reset } = useCurrentSettings('superadmin');

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 500)); // Placeholder save
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof any>(key: K, value: any) => {
    updateSettings({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500 animate-pulse">Loading settings...</div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Platform Settings"
      subtitle="Configure global platform settings and preferences"
      actions={
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      }
    >
      <PageSection title="System">
        <div className="space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Maintenance Mode</p>
              <p className="text-xs text-slate">Temporarily disable user access</p>
            </div>
            <button
              onClick={() => update('system', { ...settings.system, maintenanceMode: !settings.system?.maintenanceMode })}
              className={`relative w-11 h-6 rounded-full transition-colors ${settings.system?.maintenanceMode ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-content-bg transition-transform ${settings.system?.maintenanceMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">API Version</label>
            <input
              value={settings.system?.apiVersion || '2.0.0'}
              onChange={e => update('system', { ...settings.system, apiVersion: e.target.value })}
              className="w-full rounded-lg border border-content-border dark:border-gray-800 bg-content-bg dark:bg-gray-900 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </PageSection>

      <PageSection title="Security">
        <div className="space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Rate Limiting</p>
              <p className="text-xs text-slate">Enable API rate limiting</p>
            </div>
            <button
              onClick={() => update('security', { ...settings.security, rateLimiting: { ...settings.security?.rateLimiting, enabled: !settings.security?.rateLimiting?.enabled } })}
              className={`relative w-11 h-6 rounded-full transition-colors ${settings.security?.rateLimiting?.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-content-bg transition-transform ${settings.security?.rateLimiting?.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Requests Per Minute</label>
            <input
              type="number"
              value={settings.security?.rateLimiting?.requestsPerMinute || 100}
              onChange={e => update('security', { ...settings.security, rateLimiting: { ...settings.security?.rateLimiting, requestsPerMinute: Number(e.target.value) } })}
              className="w-full rounded-lg border border-content-border dark:border-gray-800 bg-content-bg dark:bg-gray-900 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </PageSection>

      <PageSection title="Compliance">
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Data Retention (days)</label>
            <input
              type="number"
              value={settings.compliance?.dataRetentionDays || 365}
              onChange={e => update('compliance', { ...settings.compliance, dataRetentionDays: Number(e.target.value) })}
              className="w-full rounded-lg border border-content-border dark:border-gray-800 bg-content-bg dark:bg-gray-900 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Enable Encryption</p>
              <p className="text-xs text-slate">Encrypt sensitive data at rest</p>
            </div>
            <button
              onClick={() => update('compliance', { ...settings.compliance, enableEncryption: !settings.compliance?.enableEncryption })}
              className={`relative w-11 h-6 rounded-full transition-colors ${settings.compliance?.enableEncryption ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-content-bg transition-transform ${settings.compliance?.enableEncryption ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </PageSection>
    </PageLayout>
  );
}
