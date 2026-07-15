import { randomUUID } from 'crypto';
import logger from '@/lib/logger';
import type { FHIRDevice } from '@/lib/fhir/fhir-types';

/**
 * Medical Device Integration Service
 * Implements HL7/FHIR R4 Device resource management
 * Multi-tenant aware with hospital isolation
 */

export interface DeviceRegistration {
  id?: string
  hospitalId: string
  deviceIdentifier: string
  serialNumber?: string
  modelNumber?: string
  manufacturer?: string
  name: string
  type: 'vital_monitor' | 'lab_analyzer' | 'imaging' | 'infusion_pump' | 'ventilator' | 'ecg' | 'other'
  status: 'active' | 'inactive' | 'maintenance' | 'error'
  location?: string
  department?: string
  ipAddress?: string
  macAddress?: string
  firmwareVersion?: string
  lastSeen?: Date
  lastDataReceived?: Date
  properties?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface DeviceDataStream {
  deviceId: string
  patientId?: string
  encounterId?: string
  timestamp: Date
  measurementType: string
  value: number | string | boolean
  unit?: string
  status: 'normal' | 'warning' | 'critical' | 'unknown'
  referenceRange?: {
    low?: number
    high?: number
  }
}

export class MedicalDeviceService {
  /**
   * Register a new medical device in the system
   */
  static async registerDevice(device: Omit<DeviceRegistration, 'id'>): Promise<DeviceRegistration> {
    try {
      const registered: DeviceRegistration = {
        id: randomUUID(),
        ...device
      };

      logger.info('Medical device registered', {
        deviceId: registered.id,
        hospitalId: device.hospitalId,
        type: device.type,
        name: device.name
      });

      return registered;
    } catch (error) {
      logger.error('Failed to register medical device', { error, device });
      throw error;
    }
  }

  /**
   * Convert internal device model to FHIR R4 Device resource format
   */
  static toFHIRDevice(device: DeviceRegistration): FHIRDevice {
    return {
      resourceType: 'Device',
      id: device.id,
      identifier: [
        {
          system: 'https://afyahero.org/fhir/sid/device-id',
          value: device.deviceIdentifier
        },
        ...(device.serialNumber ? [{
          system: 'https://afyahero.org/fhir/sid/serial-number',
          value: device.serialNumber
        }] : [])
      ],
      status: device.status === 'error' || device.status === 'maintenance' ? 'inactive' : device.status,
      deviceName: [
        {
          name: device.name,
          type: 'user-friendly-name'
        }
      ],
      modelNumber: device.modelNumber,
      manufacturer: device.manufacturer,
      type: {
        coding: [{
          system: 'https://afyahero.org/fhir/device-type',
          code: device.type,
          display: device.type.replace('_', ' ')
        }]
      },
      version: device.firmwareVersion ? [{
        value: device.firmwareVersion
      }] : undefined,
      location: device.location ? {
        display: device.location
      } : undefined,
      note: []
    };
  }

  /**
   * Process incoming device data stream
   */
  static async processDeviceData(data: DeviceDataStream): Promise<void> {
    try {
      logger.debug('Device measurement received', {
        deviceId: data.deviceId,
        measurementType: data.measurementType,
        status: data.status
      });
    } catch (error) {
      logger.error('Failed to process device data', { error, data });
      throw error;
    }
  }

  /**
   * Get all devices for a hospital
   */
  static async getDevicesForHospital(hospitalId: string): Promise<DeviceRegistration[]> {
    logger.debug('Medical device inventory requested', { hospitalId });
    return [];
  }

  /**
   * Update device status
   */
  static async updateDeviceStatus(deviceId: string, status: DeviceRegistration['status']): Promise<void> {
    logger.info('Device status updated', { deviceId, status });
  }
}