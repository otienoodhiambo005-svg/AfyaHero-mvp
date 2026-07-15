'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Hospital, MapPin, Clock, CheckCircle2, AlertTriangle, Loader2, Info, Star, Users, Bed } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HospitalCapability {
  id: string;
  name: string;
  location: string;
  distance: number;
  specializations: string[];
  currentCapacity: {
    availableBeds: number;
    totalBeds: number;
    utilizationRate: number;
  };
  estimatedWaitTime: string;
  matchScore: number;
  matchReasons: string[];
  recommended: boolean;
  contactInfo: {
    phone: string;
    email: string;
  };
}

interface ReferralRequest {
  diagnosis: string;
  requiredSpecialization: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  patientLocation: string;
  insurance: string;
}

interface ReferralMatchingPanelProps {
  diagnosis?: string;
  requiredSpecialization?: string;
  urgency?: 'routine' | 'urgent' | 'emergency';
  patientLocation?: string;
  insurance?: string;
  onReferralSelect?: (hospital: HospitalCapability) => void;
  className?: string;
}

export default function ReferralMatchingPanel({
  diagnosis,
  requiredSpecialization,
  urgency,
  patientLocation,
  insurance,
  onReferralSelect,
  className
}: ReferralMatchingPanelProps) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<HospitalCapability[]>([]);
  const [error, setError] = useState<string | null>(null);

  const findMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/medical/referrals/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis,
          requiredSpecialization,
          urgency,
          patientLocation,
          insurance,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to find referral matches');
      }

      const data = await response.json();
      setMatches(data.matches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find referral matches');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [diagnosis, requiredSpecialization, urgency, patientLocation, insurance]);

  useEffect(() => {
    if (diagnosis || requiredSpecialization) {
      findMatches();
    }
  }, [diagnosis, requiredSpecialization, findMatches]);

  const generateMockMatches = (): HospitalCapability[] => {
    return [
      {
        id: 'hosp-001',
        name: 'Kenyatta National Teaching & Referral Hospital',
        location: 'Nairobi',
        distance: 15,
        specializations: ['Cardiology', 'Neurology', 'Oncology', 'Trauma'],
        currentCapacity: {
          availableBeds: 8,
          totalBeds: 50,
          utilizationRate: 84
        },
        estimatedWaitTime: '2-4 hours',
        matchScore: 95,
        matchReasons: [
          'Specialized in required treatment',
          'Highest capacity for urgent cases',
          'Accepts your insurance',
          'Shortest travel time'
        ],
        recommended: true,
        contactInfo: {
          phone: '+254 720 000000',
          email: 'referrals@knth.go.ke'
        }
      },
      {
        id: 'hosp-002',
        name: 'Mater Misericordiae Hospital',
        location: 'Nairobi',
        distance: 18,
        specializations: ['Cardiology', 'Orthopedics', 'General Surgery'],
        currentCapacity: {
          availableBeds: 5,
          totalBeds: 30,
          utilizationRate: 83
        },
        estimatedWaitTime: '4-6 hours',
        matchScore: 88,
        matchReasons: [
          'Good capacity for required specialty',
          'Accepts your insurance',
          'Reasonable travel distance'
        ],
        recommended: false,
        contactInfo: {
          phone: '+254 720 000001',
          email: 'referrals@mater.ke'
        }
      },
      {
        id: 'hosp-003',
        name: 'Nairobi Hospital',
        location: 'Nairobi',
        distance: 22,
        specializations: ['Cardiology', 'Internal Medicine', 'Pediatrics'],
        currentCapacity: {
          availableBeds: 3,
          totalBeds: 40,
          utilizationRate: 92
        },
        estimatedWaitTime: '6-8 hours',
        matchScore: 82,
        matchReasons: [
          'Specialized in required treatment',
          'Accepts your insurance',
          'High utilization but available'
        ],
        recommended: false,
        contactInfo: {
          phone: '+254 720 000002',
          email: 'referrals@nairobihosp.co.ke'
        }
      },
      {
        id: 'hosp-004',
        name: 'Aga Khan University Hospital',
        location: 'Nairobi',
        distance: 25,
        specializations: ['Cardiology', 'Neurology', 'Oncology', 'Renal'],
        currentCapacity: {
          availableBeds: 2,
          totalBeds: 35,
          utilizationRate: 94
        },
        estimatedWaitTime: '8-12 hours',
        matchScore: 78,
        matchReasons: [
          'Excellent specialized care',
          'Accepts your insurance',
          'Longer wait time due to high demand'
        ],
        recommended: false,
        contactInfo: {
          phone: '+254 720 000003',
          email: 'referrals@aku.edu'
        }
      },
      {
        id: 'hosp-005',
        name: 'MP Shah Hospital',
        location: 'Nairobi',
        distance: 28,
        specializations: ['Cardiology', 'Orthopedics', 'Neurosurgery'],
        currentCapacity: {
          availableBeds: 6,
          totalBeds: 25,
          utilizationRate: 76
        },
        estimatedWaitTime: '3-5 hours',
        matchScore: 85,
        matchReasons: [
          'Good capacity',
          'Specialized in required treatment',
          'Accepts your insurance'
        ],
        recommended: false,
        contactInfo: {
          phone: '+254 720 000004',
          email: 'referrals@mpshah.co.ke'
        }
      }
    ];
  };

  const urgencyColors = {
    routine: 'bg-[#E8F4FB] border-[#89C4E8] text-[#0F4C75]',
    urgent: 'bg-[#FEF3C7] border-[#F59E0B] text-[#713F12]',
    emergency: 'bg-[#FEE2E2] border-[#EF4444] text-[#7F1D1D]'
  };

  const urgencyBadge = {
    routine: 'bg-[#3282B8] text-white',
    urgent: 'bg-[#F59E0B] text-white',
    emergency: 'bg-[#EF4444] text-white'
  };

  if (!diagnosis && !requiredSpecialization) return null;

  return (
    <div className={cn('rounded-card border border-content-border bg-content-bg p-5 shadow-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-card bg-[#3282B8]/10 text-[#3282B8]">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Hospital className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-ink">AI-Powered Referral Matching</h3>
            <p className="text-xs text-slate">Intelligent hospital recommendations based on capacity & specialization</p>
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-[#FEF3C7] border border-[#F59E0B] px-3 py-1 text-xs text-[#713F12] flex items-center gap-1">
            <Info className="h-3 w-3" />
            Fallback
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[#FEF3C7] border border-[#F59E0B] px-3 py-2 text-xs text-[#713F12]">
          {error}
        </div>
      )}

      {/* Referral Criteria */}
      <div className="mb-4 rounded-card border border-content-border bg-content-surface p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate mb-1">Diagnosis</p>
            <p className="text-sm font-semibold">{diagnosis || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-xs text-slate mb-1">Required Specialty</p>
            <p className="text-sm font-semibold">{requiredSpecialization || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-xs text-slate mb-1">Urgency</p>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', urgencyBadge[urgency || 'routine'])}>
              {urgency || 'routine'}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate mb-1">Insurance</p>
            <p className="text-sm font-semibold">{insurance || 'Not specified'}</p>
          </div>
        </div>
      </div>

      {/* Hospital Matches */}
      <div className="space-y-3">
        {matches.map((hospital, idx) => (
          <div
            key={hospital.id}
            className={cn(
              'rounded-card border p-4 transition-all hover:shadow-md',
              hospital.recommended ? 'bg-[#E8F4FB] border-[#3282B8]' : 'bg-content-bg border-content-border'
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">{hospital.name}</span>
                  {hospital.recommended && (
                    <span className="rounded-full bg-[#3282B8] text-white px-2 py-0.5 text-xs font-semibold">
                      Recommended
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-bold">{hospital.matchScore}%</span>
                    <span className="text-xs text-slate">match</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3 text-xs text-slate">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {hospital.location} ({hospital.distance}km)
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {hospital.estimatedWaitTime}
                  </div>
                </div>

                {/* Capacity Indicators */}
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Available Beds</p>
                    <div className="flex items-center gap-2">
                      <Bed className="h-4 w-4 text-slate" />
                      <span className="text-lg font-bold">{hospital.currentCapacity.availableBeds}/{hospital.currentCapacity.totalBeds}</span>
                    </div>
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate">Utilization</span>
                        <span>{hospital.currentCapacity.utilizationRate}%</span>
                      </div>
                      <div className="h-2 bg-content-bg/50 rounded-full overflow-hidden">
                        <div 
                          className={cn('h-full rounded-full transition-all',
                            hospital.currentCapacity.utilizationRate < 70 ? 'bg-emerald-500' :
                            hospital.currentCapacity.utilizationRate < 90 ? 'bg-amber-500' :
                            'bg-rose-500'
                          )}
                          style={{ width: `${hospital.currentCapacity.utilizationRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Specializations</p>
                    <div className="flex flex-wrap gap-1">
                      {hospital.specializations.slice(0, 3).map((spec, specIdx) => (
                        <span
                          key={specIdx}
                          className="rounded-full border border-current/30 bg-content-bg/50 px-2 py-0.5 text-xs"
                        >
                          {spec}
                        </span>
                      ))}
                      {hospital.specializations.length > 3 && (
                        <span className="text-xs text-slate">+{hospital.specializations.length - 3} more</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Contact</p>
                    <p className="text-xs">{hospital.contactInfo.phone}</p>
                  </div>
                </div>

                {/* Match Reasons */}
                <div className="mb-3">
                  <p className="text-xs font-semibold mb-1">Match Reasons</p>
                  <div className="space-y-1">
                    {hospital.matchReasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2 rounded-lg bg-content-bg/50 p-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                        <span className="text-sm">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => onReferralSelect?.(hospital)}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-card font-semibold text-sm transition-all',
                    hospital.recommended 
                      ? 'bg-[#3282B8] hover:bg-[#2A6E9E] text-white' 
                      : 'border border-content-border bg-content-surface hover:bg-content-surface/80'
                  )}
                >
                  {hospital.recommended ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Select This Hospital
                    </>
                  ) : (
                    <>
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="mt-4 pt-4 border-t border-content-border">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4" />
          <span className="text-sm font-semibold">AI Recommendations</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-content-surface p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <p className="text-sm">Recommended hospital has highest match score based on capacity, specialization, and insurance acceptance</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-content-surface p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <p className="text-sm">Call ahead to confirm bed availability and insurance coverage</p>
          </div>
        </div>
      </div>
    </div>
  );
}
