/**
 * Settings Store - State Management for User Settings
 * 
 * Provides persistent storage and retrieval of user settings across sessions
 * Uses localStorage for client-side persistence and syncs with server when available
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DoctorSettings, PharmacySettings, LaboratorySettings, AdminSettings, SuperAdminSettings, ReceptionSettings } from './settings-types';
import { DEFAULT_DOCTOR_SETTINGS, DEFAULT_RECEPTION_SETTINGS } from './settings-types';
import logger from '@/lib/logger';
import { settingsSyncManager } from './sync-manager';
import { createSettingsSnapshot, resolveSettingsConflict } from './conflict-resolution';

type SettingsRecord = Record<string, unknown>;

function asSettingsRecord<T>(settings: T | null): SettingsRecord | null {
  return settings ? (settings as SettingsRecord) : null;
}

interface SettingsState {
  // Current user's settings
  doctorSettings: DoctorSettings | null;
  pharmacySettings: PharmacySettings | null;
  laboratorySettings: LaboratorySettings | null;
  adminSettings: AdminSettings | null;
  superAdminSettings: SuperAdminSettings | null;
  receptionSettings: ReceptionSettings | null;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  lastSynced: Date | null;
  
  // Actions
  setDoctorSettings: (settings: Partial<DoctorSettings>) => void;
  setPharmacySettings: (settings: Partial<PharmacySettings>) => void;
  setLaboratorySettings: (settings: Partial<LaboratorySettings>) => void;
  setAdminSettings: (settings: Partial<AdminSettings>) => void;
  setSuperAdminSettings: (settings: Partial<SuperAdminSettings>) => void;
  setReceptionSettings: (settings: Partial<ReceptionSettings>) => void;
  
  // Sync actions
  syncWithServer: () => Promise<void>;
  sync: () => Promise<void>;
  subscribeToUpdates: (role: string, callback: (update: unknown) => void) => { unsubscribe: () => void };
  resetToDefaults: (dashboard: 'doctor' | 'pharmacy' | 'laboratory' | 'admin' | 'superadmin' | 'reception') => void;
  reset: (dashboard: 'doctor' | 'pharmacy' | 'laboratory' | 'admin' | 'superadmin' | 'reception') => void;
  clearAllSettings: () => void;
  
  // Utility actions
  getSetting: <T>(dashboard: string, path: string) => T | undefined;
  updateSetting: <T>(dashboard: string, path: string, value: T) => void;
}

// Default settings for each dashboard type
const DEFAULT_SETTINGS = {
  doctor: DEFAULT_DOCTOR_SETTINGS,
  pharmacy: {
    profile: DEFAULT_DOCTOR_SETTINGS.profile,
    notifications: DEFAULT_DOCTOR_SETTINGS.notifications,
    dispensing: {
      defaultQuantity: 30,
      allowSubstitution: true,
      enableInteractionChecking: true,
      defaultLabelTemplate: 'standard',
      enableBarcodeScanning: true,
    },
    inventory: {
      lowStockThreshold: 10,
      expiryWarningDays: 30,
      autoReorder: false,
      preferredSuppliers: [],
    },
    insurance: {
      preferredInsurers: [],
      autoClaimProcessing: false,
    },
    accessibility: DEFAULT_DOCTOR_SETTINGS.accessibility,
    language: DEFAULT_DOCTOR_SETTINGS.language,
  },
  laboratory: {
    profile: DEFAULT_DOCTOR_SETTINGS.profile,
    notifications: DEFAULT_DOCTOR_SETTINGS.notifications,
    testing: {
      defaultPanels: [] as string[],
      enableReflexTesting: true,
      criticalValueAlerts: true,
      autoValidateResults: false,
    },
    testPanels: {
      defaultPanel: '',
      autoAssign: false,
    },
    equipment: {
      calibrationSchedule: 30,
      maintenanceAlerts: true,
      qcFrequency: 8,
      maintenanceSchedule: 'weekly' as const,
      alerts: true,
    },
    reporting: {
      format: 'pdf' as const,
      includeReferenceRanges: true,
      enableCriticalFlags: true,
      autoGenerate: false,
    },
    quality: {
      autoQC: true,
      qcFrequency: 'daily' as const,
    },
    samples: {
      autoLabel: true,
      tracking: 'barcode' as const,
    },
    database: {
      sync: false,
      syncFrequency: 'daily' as const,
    },
    security: {
      twoFactorAuth: false,
      auditLog: true,
      sessionTimeout: 30,
    },
    accessibility: DEFAULT_DOCTOR_SETTINGS.accessibility,
    language: DEFAULT_DOCTOR_SETTINGS.language,
  },
  admin: {
    profile: DEFAULT_DOCTOR_SETTINGS.profile,
    notifications: DEFAULT_DOCTOR_SETTINGS.notifications,
    facility: {
      name: '',
      address: '',
      phone: '',
      email: '',
      licenseNumber: '',
      taxId: '',
    },
    staffing: {
      defaultRolePermissions: {} as Record<string, string[]>,
      requireApprovalForNewUsers: true,
      sessionTimeout: 30,
    },
    billing: {
      defaultPricing: {} as Record<string, number>,
      insuranceContracts: [] as string[],
      autoBilling: false,
    },
    reporting: {
      customTemplates: [] as string[],
      autoGenerateReports: false,
      reportFrequency: 'monthly' as const,
    },
    accessibility: DEFAULT_DOCTOR_SETTINGS.accessibility,
    language: DEFAULT_DOCTOR_SETTINGS.language,
  },
  superadmin: {
    profile: DEFAULT_DOCTOR_SETTINGS.profile,
    notifications: DEFAULT_DOCTOR_SETTINGS.notifications,
    system: {
      featureFlags: {} as Record<string, boolean>,
      maintenanceMode: false,
      apiVersion: '2.0.0',
    },
    ai: {
      defaultProvider: 'gemini' as const,
      modelParameters: {} as Record<string, any>,
      enableBiasMonitoring: true,
      trainingDataSources: [] as string[],
    },
    security: {
      ...DEFAULT_DOCTOR_SETTINGS.security,
      ipWhitelist: [],
      rateLimiting: {
        enabled: true,
        requestsPerMinute: 100,
      },
    },
    compliance: {
      dataRetentionDays: 365,
      auditLogRetention: 2555, // 7 years
      enableEncryption: true,
      backupFrequency: 'daily' as const,
    },
    accessibility: DEFAULT_DOCTOR_SETTINGS.accessibility,
    language: DEFAULT_DOCTOR_SETTINGS.language,
  },
  reception: DEFAULT_RECEPTION_SETTINGS,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      doctorSettings: null,
      pharmacySettings: null,
      laboratorySettings: null,
      adminSettings: null,
      superAdminSettings: null,
      receptionSettings: null,
      isLoading: false,
      error: null,
      lastSynced: null,

      // Doctor settings actions
      setDoctorSettings: (settings) => {
        const current = get().doctorSettings || DEFAULT_SETTINGS.doctor;
        set({ 
          doctorSettings: { ...current, ...settings },
          lastSynced: new Date()
        });
      },

      // Pharmacy settings actions
      setPharmacySettings: (settings) => {
        const current = get().pharmacySettings || DEFAULT_SETTINGS.pharmacy;
        set({ 
          pharmacySettings: { ...current, ...settings },
          lastSynced: new Date()
        });
      },

      // Laboratory settings actions
      setLaboratorySettings: (settings) => {
        const current = get().laboratorySettings || DEFAULT_SETTINGS.laboratory;
        set({ 
          laboratorySettings: { ...current, ...settings },
          lastSynced: new Date()
        });
      },

      // Admin settings actions
      setAdminSettings: (settings) => {
        const current = get().adminSettings || DEFAULT_SETTINGS.admin;
        set({ 
          adminSettings: { ...current, ...settings },
          lastSynced: new Date()
        });
      },

      // Super admin settings actions
      setSuperAdminSettings: (settings) => {
        const current = get().superAdminSettings || DEFAULT_SETTINGS.superadmin;
        set({ 
          superAdminSettings: { ...current, ...settings },
          lastSynced: new Date()
        });
      },

      // Reception settings actions
      setReceptionSettings: (settings) => {
        const current = get().receptionSettings || DEFAULT_SETTINGS.reception;
        set({ 
          receptionSettings: { ...current, ...settings },
          lastSynced: new Date()
        });
      },

      // Sync with server
      syncWithServer: async () => {
        set({ isLoading: true, error: null });
        try {
          const state = get();
          const settingsToSync: Record<string, any> = {};

          if (state.doctorSettings) settingsToSync.doctor = state.doctorSettings;
          if (state.pharmacySettings) settingsToSync.pharmacy = state.pharmacySettings;
          if (state.laboratorySettings) settingsToSync.laboratory = state.laboratorySettings;
          if (state.adminSettings) settingsToSync.admin = state.adminSettings;
          if (state.superAdminSettings) settingsToSync.superadmin = state.superAdminSettings;
          if (state.receptionSettings) settingsToSync.reception = state.receptionSettings;

          if (Object.keys(settingsToSync).length === 0) {
            const response = await fetch('/api/settings?role=doctor');
            if (!response.ok) throw new Error('Failed to sync settings');
          }

          // Sync each role's settings to the server
          const syncPromises = Object.entries(settingsToSync).map(async ([role, settings]) => {
            try {
              const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, settings }),
              });
              if (!response.ok) throw new Error(`Failed to sync ${role} settings`);
              
              // Broadcast update to other connected clients via sync manager
              settingsSyncManager.broadcast({
                role,
                settings,
                timestamp: Date.now(),
                userId: 'current-user', // This would be the actual user ID
              });
            } catch (error) {
              logger.error(`[settings-store] Failed to sync ${role} settings`, {
                error: error instanceof Error ? error.message : String(error),
              });
              throw error;
            }
          });

          await Promise.all(syncPromises);

          set({ 
            isLoading: false,
            lastSynced: new Date()
          });
        } catch (error) {
          set({ 
            isLoading: false,
            error: 'Failed to sync settings'
          });
        }
      },

      // Sync (alias for syncWithServer)
      sync: async () => {
        await get().syncWithServer();
      },

      // Subscribe to real-time settings updates
      subscribeToUpdates: (role: string, callback: (update: unknown) => void) => {
        return settingsSyncManager.subscribe(role, callback);
      },

      // Reset to defaults
      resetToDefaults: (dashboard) => {
        switch (dashboard) {
          case 'doctor':
            set({ doctorSettings: DEFAULT_SETTINGS.doctor });
            break;
          case 'pharmacy':
            set({ pharmacySettings: DEFAULT_SETTINGS.pharmacy });
            break;
          case 'laboratory':
            set({ laboratorySettings: DEFAULT_SETTINGS.laboratory });
            break;
          case 'admin':
            set({ adminSettings: DEFAULT_SETTINGS.admin });
            break;
          case 'superadmin':
            set({ superAdminSettings: DEFAULT_SETTINGS.superadmin });
            break;
          case 'reception':
            set({ receptionSettings: DEFAULT_SETTINGS.reception });
            break;
        }
      },

      // Reset (alias for resetToDefaults)
      reset: (dashboard) => {
        switch (dashboard) {
          case 'doctor':
            set({ doctorSettings: DEFAULT_SETTINGS.doctor });
            break;
          case 'pharmacy':
            set({ pharmacySettings: DEFAULT_SETTINGS.pharmacy });
            break;
          case 'laboratory':
            set({ laboratorySettings: DEFAULT_SETTINGS.laboratory });
            break;
          case 'admin':
            set({ adminSettings: DEFAULT_SETTINGS.admin });
            break;
          case 'superadmin':
            set({ superAdminSettings: DEFAULT_SETTINGS.superadmin });
            break;
          case 'reception':
            set({ receptionSettings: DEFAULT_SETTINGS.reception });
            break;
        }
      },

      // Clear all settings
      clearAllSettings: () => {
        set({
          doctorSettings: null,
          pharmacySettings: null,
          laboratorySettings: null,
          adminSettings: null,
          superAdminSettings: null,
          receptionSettings: null,
          lastSynced: null,
        });
      },

      // Get nested setting by path
      getSetting: <T>(dashboard: string, path: string): T | undefined => {
        const state = get();
        let settings: SettingsRecord | null;
        
        switch (dashboard) {
          case 'doctor':
            settings = asSettingsRecord(state.doctorSettings);
            break;
          case 'pharmacy':
            settings = asSettingsRecord(state.pharmacySettings);
            break;
          case 'laboratory':
            settings = asSettingsRecord(state.laboratorySettings);
            break;
          case 'admin':
            settings = asSettingsRecord(state.adminSettings);
            break;
          case 'superadmin':
            settings = asSettingsRecord(state.superAdminSettings);
            break;
          case 'reception':
            settings = asSettingsRecord(state.receptionSettings);
            break;
          default:
            return undefined;
        }
        
        if (!settings) return undefined;
        
        // Navigate the path (e.g., "notifications.email")
        const parts = path.split('.');
        let value: unknown = settings;
        
        for (const part of parts) {
          if (value === undefined || value === null) return undefined;
          value = (value as SettingsRecord)[part];
        }
        
        return value as T;
      },

      // Update nested setting by path
      updateSetting: <T>(dashboard: string, path: string, value: T) => {
        const state = get();
        let settings: SettingsRecord | null;
        let setSettings: (s: SettingsRecord) => void;
        
        switch (dashboard) {
          case 'doctor':
            settings = asSettingsRecord(state.doctorSettings);
            setSettings = (s) => set({ doctorSettings: { ...settings, ...s } as unknown as DoctorSettings });
            break;
          case 'pharmacy':
            settings = asSettingsRecord(state.pharmacySettings);
            setSettings = (s) => set({ pharmacySettings: { ...settings, ...s } as unknown as PharmacySettings });
            break;
          case 'laboratory':
            settings = asSettingsRecord(state.laboratorySettings);
            setSettings = (s) => set({ laboratorySettings: { ...settings, ...s } as unknown as LaboratorySettings });
            break;
          case 'admin':
            settings = asSettingsRecord(state.adminSettings);
            setSettings = (s) => set({ adminSettings: { ...settings, ...s } as unknown as AdminSettings });
            break;
          case 'superadmin':
            settings = asSettingsRecord(state.superAdminSettings);
            setSettings = (s) => set({ superAdminSettings: { ...settings, ...s } as unknown as SuperAdminSettings });
            break;
          case 'reception':
            settings = asSettingsRecord(state.receptionSettings);
            setSettings = (s) => set({ receptionSettings: { ...settings, ...s } as unknown as ReceptionSettings });
            break;
          default:
            return;
        }
        
        if (!settings) return;
        
        // Set nested value by path
        const parts = path.split('.');
        const lastPart = parts.pop()!;
        let obj: SettingsRecord = settings;
        
        for (const part of parts) {
          if (obj[part] === undefined) {
            obj[part] = {};
          }
          obj = obj[part] as SettingsRecord;
        }
        
        obj[lastPart] = value;
        setSettings(settings);
      },
    }),
    {
      name: 'afyahero-settings', // localStorage key
      partialize: (state) => ({
        doctorSettings: state.doctorSettings,
        pharmacySettings: state.pharmacySettings,
        laboratorySettings: state.laboratorySettings,
        adminSettings: state.adminSettings,
        superAdminSettings: state.superAdminSettings,
        receptionSettings: state.receptionSettings,
        lastSynced: state.lastSynced,
      }),
    }
  )
);

// Hook for easy access to current user's settings based on role
export type SettingsRole = 'doctor' | 'pharmacy' | 'laboratory' | 'admin' | 'superadmin' | 'reception';

export type SettingsByRole<T extends SettingsRole> = 
  T extends 'doctor' ? DoctorSettings :
  T extends 'pharmacy' ? PharmacySettings :
  T extends 'laboratory' ? LaboratorySettings :
  T extends 'admin' ? AdminSettings :
  T extends 'superadmin' ? SuperAdminSettings :
  T extends 'reception' ? ReceptionSettings : never;

export const useCurrentSettings = <T extends SettingsRole>(
  dashboard: T
) => {
  const store = useSettingsStore();
  
  const getSettings = (): SettingsByRole<T> => {
    switch (dashboard) {
      case 'doctor':
        return (store.doctorSettings || DEFAULT_SETTINGS.doctor) as unknown as SettingsByRole<T>;
      case 'pharmacy':
        return (store.pharmacySettings || DEFAULT_SETTINGS.pharmacy) as unknown as SettingsByRole<T>;
      case 'laboratory':
        return (store.laboratorySettings || DEFAULT_SETTINGS.laboratory) as unknown as SettingsByRole<T>;
      case 'admin':
        return (store.adminSettings || DEFAULT_SETTINGS.admin) as unknown as SettingsByRole<T>;
      case 'superadmin':
        return (store.superAdminSettings || DEFAULT_SETTINGS.superadmin) as unknown as SettingsByRole<T>;
      case 'reception':
        return (store.receptionSettings || DEFAULT_SETTINGS.reception) as unknown as SettingsByRole<T>;
    }
    return DEFAULT_SETTINGS.doctor as unknown as SettingsByRole<T>;
  };
  
  const updateSettings = (settings: Partial<SettingsByRole<T>>) => {
    switch (dashboard) {
      case 'doctor':
        store.setDoctorSettings(settings as Partial<DoctorSettings>);
        break;
      case 'pharmacy':
        store.setPharmacySettings(settings as Partial<PharmacySettings>);
        break;
      case 'laboratory':
        store.setLaboratorySettings(settings as Partial<LaboratorySettings>);
        break;
      case 'admin':
        store.setAdminSettings(settings as Partial<AdminSettings>);
        break;
      case 'superadmin':
        store.setSuperAdminSettings(settings as Partial<SuperAdminSettings>);
        break;
      case 'reception':
        store.setReceptionSettings(settings as Partial<ReceptionSettings>);
        break;
    }
  };
  
  return {
    settings: getSettings(),
    updateSettings,
    isLoading: store.isLoading,
    error: store.error,
    lastSynced: store.lastSynced,
    sync: store.syncWithServer,
    reset: () => store.resetToDefaults(dashboard),
  };
};
