'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Activity,
  Thermometer,
  Heart,
  Wind,
  Droplets,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Validation schema
const checkInSchema = z.object({
  // Patient demographics
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  shifNumber: z.string().optional(),

  // Triage information
  chiefComplaint: z.string().min(5, 'Chief complaint must be at least 5 characters'),

  // Vitals - all optional
  temperature: z.union([z.number().min(30).max(45), z.nan(), z.undefined()]).optional(),
  heartRate: z.union([z.number().min(30).max(220), z.nan(), z.undefined()]).optional(),
  respiratoryRate: z.union([z.number().min(5).max(60), z.nan(), z.undefined()]).optional(),
  systolicBP: z.union([z.number().min(60).max(250), z.nan(), z.undefined()]).optional(),
  diastolicBP: z.union([z.number().min(40).max(150), z.nan(), z.undefined()]).optional(),
  spO2: z.union([z.number().min(50).max(100), z.nan(), z.undefined()]).optional(),
  consciousness: z.enum(['alert', 'voice', 'pain', 'unresponsive']).optional(),

  // Additional info
  isPregnant: z.boolean().optional(),
  gestationalWeeks: z.union([z.number().min(0).max(42), z.nan(), z.undefined()]).optional(),
  painScore: z.union([z.number().min(0).max(10), z.nan(), z.undefined()]).optional(),
  knownAllergies: z.string().optional(),
  currentMedications: z.string().optional(),
  knownMedicalConditions: z.string().optional(),
});

type CheckInFormData = z.infer<typeof checkInSchema>;

const priorityColors = {
  1: 'bg-red-100 border-red-500 text-red-900',
  2: 'bg-orange-100 border-orange-500 text-orange-900',
  3: 'bg-yellow-100 border-yellow-500 text-yellow-900',
  4: 'bg-green-100 border-green-500 text-green-900',
  5: 'bg-blue-100 border-blue-500 text-blue-900',
};

const priorityLabels = {
  1: 'Immediate (Red)',
  2: 'Emergency (Orange)',
  3: 'Urgent (Yellow)',
  4: 'Semi-urgent (Green)',
  5: 'Non-urgent (Blue)',
};

const queuePriorityColors = {
  critical: 'bg-red-100 border-red-500 text-red-900',
  urgent: 'bg-orange-100 border-orange-500 text-orange-900',
  normal: 'bg-green-100 border-green-500 text-green-900',
};

export default function PatientCheckInForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    mode: 'onSubmit', // Only validate on submit
    defaultValues: {
      gender: 'MALE',
      consciousness: 'alert',
      isPregnant: false,
    },
  });

  const isPregnant = watch('isPregnant');

  const onSubmit = async (data: CheckInFormData) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/patients/register-with-triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          email: data.email || undefined,
          address: data.address || undefined,
          shifNumber: data.shifNumber || undefined,
          vitals: {
            temperature: data.temperature,
            heartRate: data.heartRate,
            respiratoryRate: data.respiratoryRate,
            systolicBP: data.systolicBP,
            diastolicBP: data.diastolicBP,
            spO2: data.spO2,
            consciousness: data.consciousness,
          },
          gestationalWeeks: data.isPregnant ? data.gestationalWeeks : undefined,
          knownAllergies: data.knownAllergies ? data.knownAllergies.split(',').map((a) => a.trim()) : undefined,
          currentMedications: data.currentMedications ? data.currentMedications.split(',').map((m) => m.trim()) : undefined,
          knownMedicalConditions: data.knownMedicalConditions ? data.knownMedicalConditions.split(',').map((c) => c.trim()) : undefined,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Registration failed');
      }

      setResult(responseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Patient Registered Successfully</h2>
              <p className="text-gray-600">Patient has been triaged and added to queue</p>
            </div>
          </div>

          {/* Patient Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Patient Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-2 font-medium">{result.patient.firstName} {result.patient.lastName}</span>
              </div>
              <div>
                <span className="text-gray-600">Phone:</span>
                <span className="ml-2 font-medium">{result.patient.phoneNumber}</span>
              </div>
              {result.patient.shifNumber && (
                <div>
                  <span className="text-gray-600">SHIF Number:</span>
                  <span className="ml-2 font-medium">{result.patient.shifNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Triage Results */}
          <div
            className={cn(
              'border-2 rounded-lg p-4 mb-4',
              priorityColors[result.triage.priority as keyof typeof priorityColors],
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Triage Priority</h3>
              <span className="text-2xl font-bold">{result.triage.priority}</span>
            </div>
            <p className="font-medium mb-2">{result.triage.priorityLabel}</p>
            <p className="text-sm opacity-90 mb-3">{result.triage.reasoning}</p>
            {result.triage.recommendedActions && result.triage.recommendedActions.length > 0 && (
              <div>
                <p className="font-medium text-sm mb-2">Recommended Actions:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {result.triage.recommendedActions.map((action: string, index: number) => (
                    <li key={index}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
            {(result.triage.pewsScore || result.triage.moewsScore) && (
              <div className="mt-3 pt-3 border-t border-current opacity-75">
                {result.triage.pewsScore && (
                  <p className="text-sm">PEWS Score: {result.triage.pewsScore}</p>
                )}
                {result.triage.moewsScore && (
                  <p className="text-sm">MOEWS Score: {result.triage.moewsScore}</p>
                )}
              </div>
            )}
          </div>

          {/* Queue Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Queue Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Token Number:</span>
                <span className="ml-2 font-bold text-lg">#{result.queue.tokenNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Priority:</span>
                <span className="ml-2 font-medium capitalize">{result.queue.priority}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 font-medium capitalize">{result.queue.status.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {result.requiresImmediateAttention && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Immediate Attention Required</p>
                <p className="text-sm text-red-700">This patient has been flagged as priority 1 and automatically escalated.</p>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              window.location.reload();
            }}
            className="mt-6 w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Register Next Patient
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Patient Check-in with AI Triage</h2>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Patient Demographics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Patient Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  {...register('firstName')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  style={{ backgroundColor: '#0A3A5E' }}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="text-sm text-red-600 mt-1">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  {...register('lastName')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                  placeholder="Doe"
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600 mt-1">{errors.lastName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  {...register('dateOfBirth')}
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                />
                {errors.dateOfBirth && (
                  <p className="text-sm text-red-600 mt-1">{errors.dateOfBirth.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                <select
                  {...register('gender')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('phoneNumber')}
                    type="tel"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                    placeholder="+254 700 000 000"
                  />
                </div>
                {errors.phoneNumber && (
                  <p className="text-sm text-red-600 mt-1">{errors.phoneNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                    placeholder="john.doe@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('address')}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                    placeholder="123 Main St, Nairobi"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SHIF Number</label>
                <input
                  {...register('shifNumber')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                  placeholder="SHIF123456"
                />
              </div>
            </div>
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint *</label>
            <textarea
              {...register('chiefComplaint')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
              placeholder="Describe the patient's main reason for visit..."
            />
            {errors.chiefComplaint && (
              <p className="text-sm text-red-600 mt-1">{errors.chiefComplaint.message}</p>
            )}
          </div>

          {/* Vitals */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Vital Signs
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
                <div className="relative">
                  <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('temperature', { valueAsNumber: true })}
                    type="number"
                    step="0.1"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                    placeholder="37.0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
                <div className="relative">
                  <Heart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('heartRate', { valueAsNumber: true })}
                    type="number"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                    placeholder="72"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate (/min)</label>
                <div className="relative">
                  <Wind className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('respiratoryRate', { valueAsNumber: true })}
                    type="number"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                    placeholder="16"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
                <div className="relative">
                  <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('spO2', { valueAsNumber: true })}
                    type="number"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                    placeholder="98"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Systolic BP (mmHg)</label>
                <input
                  {...register('systolicBP', { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                  placeholder="120"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diastolic BP (mmHg)</label>
                <input
                  {...register('diastolicBP', { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                  placeholder="80"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consciousness</label>
                <select
                  {...register('consciousness')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                >
                  <option value="alert">Alert</option>
                  <option value="voice">Responds to Voice</option>
                  <option value="pain">Responds to Pain</option>
                  <option value="unresponsive">Unresponsive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pain Score (0-10)</label>
                <input
                  {...register('painScore', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  {...register('isPregnant')}
                  type="checkbox"
                  id="isPregnant"
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="isPregnant" className="text-sm font-medium text-gray-700">
                  Patient is pregnant
                </label>
              </div>

              {isPregnant && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gestational Weeks</label>
                  <input
                    {...register('gestationalWeeks', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    max="42"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                    placeholder="28"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Known Allergies</label>
                <input
                  {...register('knownAllergies')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                  placeholder="Penicillin, Sulfa drugs (comma-separated)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
                <input
                  {...register('currentMedications')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                  placeholder="Paracetamol, Lisinopril (comma-separated)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Known Medical Conditions</label>
                <input
                  {...register('knownMedicalConditions')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-forest-mid/25"
                  placeholder="Hypertension, Diabetes (comma-separated)"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Register Patient & Run AI Triage'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
