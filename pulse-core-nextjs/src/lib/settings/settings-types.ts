/**
 * Settings Types for AfyaHero Dashboard Profiles
 * 
 * Comprehensive type definitions for user settings across all dashboards
 */

export interface UserProfileSettings {
  displayName: string;
  specialty?: string;
  phone?: string;
  email?: string;
  signature?: string;
  avatarUrl?: string;
  licenseNumber?: string;
  npiNumber?: string;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  consultationRequests: boolean;
  criticalResults: boolean;
  appointmentReminders: boolean;
  systemAlerts: boolean;
  marketingUpdates: boolean;
}

export interface ConsultationSettings {
  defaultDuration: number; // minutes
  bufferTime: number; // minutes between appointments
  autoAdmitWaitroom: boolean;
  defaultMode: 'video' | 'voice' | 'text';
  maxDailyConsultations: number;
  enableWaitingRoom: boolean;
  autoEndConsultation: boolean;
}

export interface PrescriptionSettings {
  defaultPharmacy?: string;
  requireDigitalSignature: boolean;
  allowGenericSubstitution: boolean;
  defaultQuantity: number;
  enableDrugInteractionCheck: boolean;
  defaultRefills: number;
}

export interface VideoSettings {
  defaultQuality: 'auto' | '720p' | '480p' | '360p';
  enableCamera: boolean;
  enableMicrophone: boolean;
  enableScreenShare: boolean;
  enableRecording: boolean;
  virtualBackground?: string;
  bandwidthAdaptive: boolean;
}

export interface AIAssistantSettings {
  enableScribe: boolean;
  transcriptionLanguage: string;
  autoGenerateNotes: boolean;
  includeTimestamps: boolean;
  speakerIdentification: boolean;
  scribeProvider: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
}

export interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  highContrast: boolean;
  screenReader: boolean;
  reduceMotion: boolean;
  colorBlindMode: boolean;
  textSpacing: 'normal' | 'wide' | 'wider';
}

export interface LanguageSettings {
  interface: string;
  patientCommunication: string;
  enableAutoTranslate: boolean;
  fallbackLanguage: string;
  preferredLanguage: string;
  autoDetect: boolean;
}

export interface SecuritySettings {
  requireMFA: boolean;
  sessionTimeout: number; // minutes
  loginNotifications: boolean;
  trustedDevices: string[];
  passwordExpiry: number; // days
}

export interface PrivacySettings {
  dataSharing: boolean;
  analyticsOptOut: boolean;
  marketingOptOut: boolean;
  profileVisibility: 'public' | 'private' | 'colleagues';
  showOnlineStatus: boolean;
}

export interface DoctorSettings {
  profile: UserProfileSettings;
  notifications: NotificationSettings;
  consultation: ConsultationSettings;
  prescription: PrescriptionSettings;
  video: VideoSettings;
  aiAssistant: AIAssistantSettings;
  accessibility: AccessibilitySettings;
  language: LanguageSettings;
  security: SecuritySettings;
  privacy: PrivacySettings;
}

export interface PharmacySettings {
  profile: UserProfileSettings;
  notifications: NotificationSettings;
  dispensing: {
    defaultQuantity: number;
    allowSubstitution: boolean;
    enableInteractionChecking: boolean;
    defaultLabelTemplate: string;
    enableBarcodeScanning: boolean;
  };
  inventory: {
    lowStockThreshold: number;
    expiryWarningDays: number;
    autoReorder: boolean;
    preferredSuppliers: string[];
  };
  insurance: {
    preferredInsurers: string[];
    autoClaimProcessing: boolean;
  };
  accessibility: AccessibilitySettings;
  language: LanguageSettings;
}

export interface LaboratorySettings {
  profile: UserProfileSettings;
  notifications: NotificationSettings;
  testing: {
    defaultPanels: string[];
    enableReflexTesting: boolean;
    criticalValueAlerts: boolean;
    autoValidateResults: boolean;
  };
  testPanels: {
    defaultPanel: string;
    autoAssign: boolean;
  };
  equipment: {
    calibrationSchedule: number; // days
    maintenanceAlerts: boolean;
    qcFrequency: number; // hours
    maintenanceSchedule: 'weekly' | 'monthly' | 'quarterly';
    alerts: boolean;
  };
  reporting: {
    format: 'pdf' | 'html' | 'fhir';
    includeReferenceRanges: boolean;
    enableCriticalFlags: boolean;
    autoGenerate: boolean;
  };
  quality: {
    autoQC: boolean;
    qcFrequency: 'daily' | 'weekly' | 'monthly';
  };
  samples: {
    autoLabel: boolean;
    tracking: 'barcode' | 'rfid' | 'manual';
  };
  database: {
    sync: boolean;
    syncFrequency: 'hourly' | 'daily' | 'weekly';
  };
  security: {
    twoFactorAuth: boolean;
    auditLog: boolean;
    sessionTimeout: number;
  };
  accessibility: AccessibilitySettings;
  language: LanguageSettings;
}

export interface AdminSettings {
  profile: UserProfileSettings;
  notifications: NotificationSettings;
  facility: {
    name: string;
    address: string;
    phone: string;
    email: string;
    licenseNumber: string;
    taxId: string;
  };
  staffing: {
    defaultRolePermissions: Record<string, string[]>;
    requireApprovalForNewUsers: boolean;
    sessionTimeout: number;
  };
  billing: {
    defaultPricing: Record<string, number>;
    insuranceContracts: string[];
    autoBilling: boolean;
  };
  reporting: {
    customTemplates: string[];
    autoGenerateReports: boolean;
    reportFrequency: 'daily' | 'weekly' | 'monthly';
  };
  accessibility: AccessibilitySettings;
  language: LanguageSettings;
}

export interface SuperAdminSettings {
  profile: UserProfileSettings;
  notifications: NotificationSettings;
  system: {
    featureFlags: Record<string, boolean>;
    maintenanceMode: boolean;
    apiVersion: string;
  };
  ai: {
    defaultProvider: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
    modelParameters: Record<string, any>;
    enableBiasMonitoring: boolean;
    trainingDataSources: string[];
  };
  security: SecuritySettings & {
    ipWhitelist: string[];
    rateLimiting: {
      enabled: boolean;
      requestsPerMinute: number;
    };
  };
  compliance: {
    dataRetentionDays: number;
    auditLogRetention: number;
    enableEncryption: boolean;
    backupFrequency: 'hourly' | 'daily' | 'weekly';
  };
  accessibility: AccessibilitySettings;
  language: LanguageSettings;
}

export interface ReceptionSettings {
  profile: UserProfileSettings;
  notifications: NotificationSettings;
  checkIn: {
    autoAssignQueue: boolean;
    defaultQueue: 'general' | 'urgent' | 'triage';
    requireInsuranceVerification: boolean;
    enablePatientSearch: boolean;
  };
  appointments: {
    defaultDuration: number;
    enableReminders: boolean;
    reminderAdvanceTime: number; // hours
    allowWalkIns: boolean;
  };
  accessibility: AccessibilitySettings;
  language: LanguageSettings;
}

export type DashboardSettings = 
  | DoctorSettings
  | PharmacySettings
  | LaboratorySettings
  | AdminSettings
  | SuperAdminSettings
  | ReceptionSettings;

export interface SettingsUpdate {
  section: string;
  data: Partial<any>;
  timestamp: string;
  userId: string;
}

export const DEFAULT_DOCTOR_SETTINGS: DoctorSettings = {
  profile: {
    displayName: '',
    specialty: '',
    phone: '',
    email: '',
    signature: '',
    licenseNumber: '',
    npiNumber: '',
  },
  notifications: {
    email: true,
    push: true,
    sms: false,
    consultationRequests: true,
    criticalResults: true,
    appointmentReminders: true,
    systemAlerts: true,
    marketingUpdates: false,
  },
  consultation: {
    defaultDuration: 30,
    bufferTime: 5,
    autoAdmitWaitroom: false,
    defaultMode: 'video',
    maxDailyConsultations: 20,
    enableWaitingRoom: true,
    autoEndConsultation: false,
  },
  prescription: {
    requireDigitalSignature: true,
    allowGenericSubstitution: true,
    defaultQuantity: 30,
    enableDrugInteractionCheck: true,
    defaultRefills: 0,
  },
  video: {
    defaultQuality: 'auto',
    enableCamera: true,
    enableMicrophone: true,
    enableScreenShare: true,
    enableRecording: false,
    bandwidthAdaptive: true,
  },
  aiAssistant: {
    enableScribe: true,
    transcriptionLanguage: 'en',
    autoGenerateNotes: true,
    includeTimestamps: true,
    speakerIdentification: true,
    scribeProvider: 'gemini',
  },
  accessibility: {
    fontSize: 'medium',
    highContrast: false,
    screenReader: false,
    reduceMotion: false,
    colorBlindMode: false,
    textSpacing: 'normal',
  },
  language: {
    interface: 'en',
    patientCommunication: 'en',
    enableAutoTranslate: true,
    fallbackLanguage: 'en',
    preferredLanguage: 'en',
    autoDetect: true,
  },
  security: {
    requireMFA: false,
    sessionTimeout: 30,
    loginNotifications: true,
    trustedDevices: [],
    passwordExpiry: 90,
  },
  privacy: {
    dataSharing: false,
    analyticsOptOut: false,
    marketingOptOut: false,
    profileVisibility: 'private',
    showOnlineStatus: true,
  },
};

export const DEFAULT_RECEPTION_SETTINGS: ReceptionSettings = {
  profile: {
    displayName: '',
    phone: '',
    email: '',
  },
  notifications: {
    email: true,
    push: true,
    sms: false,
    consultationRequests: false,
    criticalResults: false,
    appointmentReminders: true,
    systemAlerts: true,
    marketingUpdates: false,
  },
  checkIn: {
    autoAssignQueue: false,
    defaultQueue: 'general',
    requireInsuranceVerification: true,
    enablePatientSearch: true,
  },
  appointments: {
    defaultDuration: 30,
    enableReminders: true,
    reminderAdvanceTime: 24,
    allowWalkIns: true,
  },
  accessibility: {
    fontSize: 'medium',
    highContrast: false,
    screenReader: false,
    reduceMotion: false,
    colorBlindMode: false,
    textSpacing: 'normal',
  },
  language: {
    interface: 'en',
    patientCommunication: 'en',
    enableAutoTranslate: true,
    fallbackLanguage: 'en',
    preferredLanguage: 'en',
    autoDetect: true,
  },
};
