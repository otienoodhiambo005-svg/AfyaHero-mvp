/**
 * Settings Store Unit Tests
 * 
 * Tests for the Zustand settings store including:
 * - State management
 * - Persistence
 * - Settings updates
 * - Reset functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useSettingsStore } from '../settings-store'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Settings Store', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear()
    // Reset store to initial state
    useSettingsStore.getState().clearAllSettings()
  })

  describe('Initial State', () => {
    it('should have null values for all settings initially', () => {
      const { doctorSettings, pharmacySettings, laboratorySettings, adminSettings, superAdminSettings, receptionSettings } = useSettingsStore.getState()
      
      expect(doctorSettings).toBeNull()
      expect(pharmacySettings).toBeNull()
      expect(laboratorySettings).toBeNull()
      expect(adminSettings).toBeNull()
      expect(superAdminSettings).toBeNull()
      expect(receptionSettings).toBeNull()
    })

    it('should have loading and error states initialized', () => {
      const { isLoading, error, lastSynced } = useSettingsStore.getState()
      
      expect(isLoading).toBe(false)
      expect(error).toBeNull()
      expect(lastSynced).toBeNull()
    })
  })

  describe('Doctor Settings', () => {
    it('should set doctor settings', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setDoctorSettings({ profile: { displayName: 'Dr. Test' } })
      })

      expect(result.current.doctorSettings?.profile?.displayName).toBe('Dr. Test')
    })

    it('should merge partial updates with existing settings', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setDoctorSettings({ profile: { displayName: 'Dr. Test' } })
      })

      act(() => {
        result.current.setDoctorSettings({ profile: { displayName: 'Dr. Test', email: 'test@example.com' } })
      })

      expect(result.current.doctorSettings?.profile?.displayName).toBe('Dr. Test')
      expect(result.current.doctorSettings?.profile?.email).toBe('test@example.com')
    })

    it('should reset doctor settings to defaults', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setDoctorSettings({ profile: { displayName: 'Dr. Test' } })
      })

      act(() => {
        result.current.reset('doctor')
      })

      expect(result.current.doctorSettings).not.toBeNull()
      expect(result.current.doctorSettings?.profile?.displayName).toBe('')
    })
  })

  describe('Pharmacy Settings', () => {
    it('should set pharmacy settings', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setPharmacySettings({ dispensing: { defaultQuantity: 60, allowSubstitution: true, enableInteractionChecking: true, defaultLabelTemplate: 'standard', enableBarcodeScanning: true } })
      })

      expect(result.current.pharmacySettings?.dispensing?.defaultQuantity).toBe(60)
    })

    it('should reset pharmacy settings to defaults', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setPharmacySettings({ dispensing: { defaultQuantity: 60, allowSubstitution: true, enableInteractionChecking: true, defaultLabelTemplate: 'standard', enableBarcodeScanning: true } })
      })

      act(() => {
        result.current.reset('pharmacy')
      })

      expect(result.current.pharmacySettings?.dispensing?.defaultQuantity).toBe(30)
    })
  })

  describe('Laboratory Settings', () => {
    it('should set laboratory settings', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setLaboratorySettings({ testing: { defaultPanels: [], enableReflexTesting: true, criticalValueAlerts: false, autoValidateResults: false } })
      })

      expect(result.current.laboratorySettings?.testing?.criticalValueAlerts).toBe(false)
    })

    it('should reset laboratory settings to defaults', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setLaboratorySettings({ testing: { defaultPanels: [], enableReflexTesting: true, criticalValueAlerts: true, autoValidateResults: false } })
      })

      act(() => {
        result.current.reset('laboratory')
      })

      expect(result.current.laboratorySettings?.testing?.criticalValueAlerts).toBe(true)
    })
  })

  describe('Admin Settings', () => {
    it('should set admin settings', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setAdminSettings({ facility: { name: 'Test Hospital', address: '', phone: '', email: '', licenseNumber: '', taxId: '' } })
      })

      expect(result.current.adminSettings?.facility?.name).toBe('Test Hospital')
    })

    it('should reset admin settings to defaults', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setAdminSettings({ facility: { name: 'Another Hospital', address: '', phone: '', email: '', licenseNumber: '', taxId: '' } })
      })

      act(() => {
        result.current.reset('admin')
      })

      expect(result.current.adminSettings?.facility?.name).toBe('')
    })
  })

  describe('SuperAdmin Settings', () => {
    it('should set superadmin settings', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setSuperAdminSettings({ 
          system: { 
            featureFlags: {}, 
            maintenanceMode: true, 
            apiVersion: '2.0.0' 
          } 
        })
      })

      expect(result.current.superAdminSettings?.system?.maintenanceMode).toBe(true)
    })

    it('should reset superadmin settings to defaults', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setSuperAdminSettings({ 
          system: { 
            featureFlags: {}, 
            maintenanceMode: true, 
            apiVersion: '2.0.0' 
          } 
        })
      })

      act(() => {
        result.current.reset('superadmin')
      })

      expect(result.current.superAdminSettings?.system?.maintenanceMode).toBe(false)
    })
  })

  describe('Reception Settings', () => {
    it('should set reception settings', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setReceptionSettings({ checkIn: { autoAssignQueue: true, defaultQueue: 'general', requireInsuranceVerification: false, enablePatientSearch: true } })
      })

      expect(result.current.receptionSettings?.checkIn?.autoAssignQueue).toBe(true)
    })

    it('should reset reception settings to defaults', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setReceptionSettings({ checkIn: { autoAssignQueue: true, defaultQueue: 'general', requireInsuranceVerification: false, enablePatientSearch: true } })
      })

      act(() => {
        result.current.reset('reception')
      })

      expect(result.current.receptionSettings?.checkIn?.autoAssignQueue).toBe(false)
    })
  })

  describe('Clear All Settings', () => {
    it('should clear all settings', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setDoctorSettings({ profile: { displayName: 'Dr. Test' } })
        result.current.setPharmacySettings({ dispensing: { defaultQuantity: 60, allowSubstitution: true, enableInteractionChecking: true, defaultLabelTemplate: 'standard', enableBarcodeScanning: true } })
        result.current.setReceptionSettings({ checkIn: { autoAssignQueue: true, defaultQueue: 'general', requireInsuranceVerification: false, enablePatientSearch: true } })
      })

      act(() => {
        result.current.clearAllSettings()
      })

      expect(result.current.doctorSettings).toBeNull()
      expect(result.current.pharmacySettings).toBeNull()
      expect(result.current.receptionSettings).toBeNull()
      expect(result.current.lastSynced).toBeNull()
    })
  })

  describe('Utility Functions', () => {
    it('should get nested setting by path', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setDoctorSettings({ notifications: { email: true, push: false, sms: false, consultationRequests: false, criticalResults: false, appointmentReminders: false, systemAlerts: false, marketingUpdates: false } })
      })

      const emailSetting = result.current.getSetting('doctor', 'notifications.email')
      expect(emailSetting).toBe(true)
    })

    it('should return undefined for non-existent path', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      const nonExistent = result.current.getSetting('doctor', 'nonexistent.path')
      expect(nonExistent).toBeUndefined()
    })

    it('should update nested setting by path', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setDoctorSettings({ notifications: { email: false, push: false, sms: false, consultationRequests: false, criticalResults: false, appointmentReminders: false, systemAlerts: false, marketingUpdates: false } })
      })

      act(() => {
        result.current.updateSetting('doctor', 'notifications.email', true)
      })

      expect(result.current.doctorSettings?.notifications?.email).toBe(true)
    })
  })

  describe('Persistence', () => {
    it('should update lastSynced timestamp on settings change', () => {
      const { result } = renderHook(() => useSettingsStore())
      
      act(() => {
        result.current.setDoctorSettings({ profile: { displayName: 'Dr. Test' } })
      })

      expect(result.current.lastSynced).not.toBeNull()
      expect(result.current.lastSynced).toBeInstanceOf(Date)
    })
  })

  describe('Error Handling', () => {
    it('should handle sync errors gracefully', async () => {
      const { result } = renderHook(() => useSettingsStore())
      
      // Mock sync to fail
      const originalFetch = global.fetch
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))
      
      await act(async () => {
        await result.current.sync()
      })

      expect(result.current.error).toBe('Failed to sync settings')
      expect(result.current.isLoading).toBe(false)

      global.fetch = originalFetch
    })
  })
})
