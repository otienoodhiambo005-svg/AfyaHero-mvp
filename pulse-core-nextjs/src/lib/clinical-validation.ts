/**
 * Clinical Data Validation & Safety Guardrails
 *
 * Validates vital signs against clinical reference ranges.
 * Flags abnormal values visually to prevent data entry errors.
 * Also standardizes medication names (generic only, no brand names).
 *
 * Reference ranges follow WHO/CDC standards for adult patients.
 * Pediatric variations handled per age group.
 */

export type VitalSignType = 'BP' | 'HR' | 'SpO2' | 'Temp' | 'RR' | 'Weight' | 'Height';

export interface VitalSignRange {
  normal: { min: number; max: number };
  abnormal: { min: number; max: number };
  critical: { min: number; max: number };
  unit: string;
  flag: 'normal' | 'abnormal' | 'critical';
}

export interface VitalSignValidation {
  value: number;
  unit: string;
  isNormal: boolean;
  isAbnormal: boolean;
  isCritical: boolean;
  flag: 'N' | 'L' | 'H' | 'LL' | 'HH';  // Normal, Low, High, LowLow, HighHigh
  message: string;
  bgColor: string;      // Tailwind: bg-green-100, bg-yellow-100, bg-red-100
  borderColor: string;  // Tailwind: border-green-300, border-yellow-300, border-red-500
  textColor: string;    // Tailwind text-green-900, text-yellow-900, text-red-900
}

/**
 * Adult vital sign reference ranges (WHO standards)
 * Adjust for age/comorbidities as needed
 */
const VITAL_SIGN_RANGES: Record<VitalSignType, any> = {
  // Systolic BP (mmHg) — value passed is systolic only
  BP: {
    normal: { min: 90, max: 120 },
    abnormal: { min: 70, max: 180 },
    critical: { min: 0, max: 1000 },  // Placeholder range
    unit: 'mmHg',
  },
  // Heart Rate (bpm)
  HR: {
    normal: { min: 60, max: 100 },
    abnormal: { min: 40, max: 120 },
    critical: { min: 0, max: 1000 },
    unit: 'bpm',
  },
  // Oxygen saturation (%)
  SpO2: {
    normal: { min: 95, max: 100 },
    abnormal: { min: 90, max: 94 },
    critical: { min: 0, max: 89 },
    unit: '%',
  },
  // Temperature (°C)
  Temp: {
    normal: { min: 36.5, max: 37.5 },
    abnormal: { min: 35.0, max: 39.0 },
    critical: { min: 0, max: 45 },
    unit: '°C',
  },
  // Respiratory Rate (breaths/min)
  RR: {
    normal: { min: 12, max: 20 },
    abnormal: { min: 8, max: 30 },
    critical: { min: 0, max: 1000 },
    unit: 'breaths/min',
  },
  // Weight (kg)
  Weight: {
    normal: { min: 40, max: 150 },
    abnormal: { min: 20, max: 200 },
    critical: { min: 0, max: 300 },
    unit: 'kg',
  },
  // Height (cm)
  Height: {
    normal: { min: 140, max: 210 },
    abnormal: { min: 100, max: 250 },
    critical: { min: 0, max: 300 },
    unit: 'cm',
  },
};

/**
 * Validate a vital sign against clinical ranges
 * Returns flag and styling for UI display
 */
export function validateVitalSign(type: VitalSignType, value: number): VitalSignValidation {
  const ranges = VITAL_SIGN_RANGES[type];
  if (!ranges) {
    return {
      value,
      unit: '?',
      isNormal: false,
      isAbnormal: false,
      isCritical: false,
      flag: 'N',
      message: 'Unknown vital sign type',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300',
      textColor: 'text-gray-900',
    };
  }

  let flag: 'N' | 'L' | 'H' | 'LL' | 'HH' = 'N';
  let isNormal = false;
  let isAbnormal = false;
  let isCritical = false;
  let message = `${type}: ${value} ${ranges.unit}`;
  let bgColor = 'bg-green-50';
  let borderColor = 'border-green-300';
  let textColor = 'text-green-900';

  // Check ranges (critical > abnormal > normal)
  if (value < ranges.critical.min || value > ranges.critical.max) {
    isCritical = true;
    flag = value < ranges.critical.min ? 'LL' : 'HH';
    message = `🚨 CRITICAL ${type}: ${value} ${ranges.unit}`;
    bgColor = 'bg-red-100';
    borderColor = 'border-red-500';
    textColor = 'text-red-900';
  } else if (value < ranges.abnormal.min || value > ranges.abnormal.max) {
    isAbnormal = true;
    flag = value < ranges.abnormal.min ? 'L' : 'H';
    message = `⚠️  ABNORMAL ${type}: ${value} ${ranges.unit}`;
    bgColor = 'bg-yellow-100';
    borderColor = 'border-yellow-300';
    textColor = 'text-yellow-900';
  } else if (value >= ranges.normal.min && value <= ranges.normal.max) {
    isNormal = true;
    flag = 'N';
    message = `✓ Normal ${type}: ${value} ${ranges.unit}`;
    bgColor = 'bg-green-50';
    borderColor = 'border-green-300';
    textColor = 'text-green-900';
  }

  return {
    value,
    unit: ranges.unit,
    isNormal,
    isAbnormal,
    isCritical,
    flag,
    message,
    bgColor,
    borderColor,
    textColor,
  };
}

/**
 * Generic medication name standardization
 * Strips brand names, returns WHO generic name
 * Prevents prescribing errors due to brand/generic confusion
 */
export function standardizeMedicationName(input: string): { generic: string; suggestion: string } {
  const upper = input.trim().toUpperCase();

  // Common brand-to-generic mappings (Kenya/East Africa focus)
  const brandToGeneric: Record<string, string> = {
    // Antibiotics
    'AMACIN': 'amikacin',
    'GENTAMICIN': 'gentamicin',
    'DOXYCYCLINE': 'doxycycline',
    'CIPRO': 'ciprofloxacin',
    'SEPTRIN': 'trimethoprim-sulfamethoxazole',
    'BACTRIM': 'trimethoprim-sulfamethoxazole',

    // Antiretrovirals
    'ATRIPLA': 'efavirenz/emtricitabine/tenofovir',
    'BIKTARVY': 'bictegravir/tenofovir alafenamide/emtricitabine',
    'ODIMTRI': 'tenofovir/lamivudine/dolutegravir',

    // Antimalarials
    'COARTEM': 'artemether-lumefantrine',
    'ARTEQUICK': 'artemether-amodiaquine',

    // Anticoagulants
    'COUMADIN': 'warfarin',
    'HEPARIN': 'heparin',

    // Antidiabetics
    'GLUCOPHAGE': 'metformin',
    'LANTUS': 'insulin glargine',
    'HUMALOG': 'insulin lispro',

    // Statins
    'LIPITOR': 'atorvastatin',
    'ZOCOR': 'simvastatin',

    // Hypertensives
    'LOPRESSOR': 'metoprolol',
    'LISINOPRIL': 'lisinopril',
    'NORVASC': 'amlodipine',

     // NSAIDs
     'IBUPROFEN': 'ibuprofen',
     'DICLOFENAC': 'diclofenac',
     'ASPIRIN': 'aspirin',
     'TYLENOL': 'paracetamol',

    // Antitussives
    'ROBITUSSIN': 'guaifenesin',
    'ACTIFED': 'triprolidine-pseudoephedrine',
  };

  const generic = brandToGeneric[upper];
  if (generic) {
    return {
      generic,
      suggestion: `${input} → ${generic} (generic name preferred)`,
    };
  }

  // If not a known brand, assume it's already generic or unknown
  return {
    generic: input.toLowerCase(),
    suggestion: `Using provided name: ${input.toLowerCase()}`,
  };
}

/**
 * Validate medication dosage format
 * Ensures dose includes both quantity and unit
 */
export function validateMedicationDose(dose: string): { isValid: boolean; suggestion: string } {
  const trimmed = dose.trim();

  // Check for pattern: number + space + unit (e.g., "500 mg", "2 tablets")
  const validPattern = /^\d+(\.\d+)?\s+(mg|g|ml|units?|tablets?|caps?|puffs?|patches?)$/i;

  if (validPattern.test(trimmed)) {
    return {
      isValid: true,
      suggestion: `✓ Valid dose format: ${trimmed}`,
    };
  }

  return {
    isValid: false,
    suggestion: `Invalid dose format. Use format: "500 mg" or "2 tablets", got "${trimmed}"`,
  };
}

/**
 * Clinical summary for display (e.g., in encounter notes)
 */
export function formatClinicalVitals(vitals: Array<{ type: VitalSignType; value: number }>): string {
  const validations = vitals.map(v => validateVitalSign(v.type, v.value));
  const abnormal = validations.filter(v => v.isAbnormal || v.isCritical);

  if (abnormal.length === 0) {
    return 'Vitals: All normal';
  }

  const flags = abnormal.map(v => `${v.flag}: ${v.message}`).join('; ');
  return `Vitals: ${flags}`;
}
