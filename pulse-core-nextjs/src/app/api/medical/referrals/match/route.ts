import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

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

export async function POST(request: NextRequest) {
  try {
    const body: ReferralRequest = await request.json();
    const { diagnosis, requiredSpecialization, urgency, patientLocation, insurance } = body;

    if (!diagnosis || !requiredSpecialization) {
      return NextResponse.json(
        { error: 'diagnosis and requiredSpecialization are required' },
        { status: 400 }
      );
    }

    // Fetch all hospitals (in production, would filter by region/distance)
    const hospitals = await prisma.hospital.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        location: true,
        specialisation: true,
        phoneNumber: true,
        email: true,
        acceptedInsurances: true,
      },
    });

    // Calculate bed capacity for each hospital
    const hospitalsWithCapacity = await Promise.all(
      hospitals.map(async (hospital) => {
        const beds = await prisma.hospitalBed.count({
          where: {
            hospitalId: hospital.id,
            status: 'available',
          },
        });

        const totalBeds = await prisma.hospitalBed.count({
          where: {
            hospitalId: hospital.id,
          },
        });

        return {
          ...hospital,
          availableBeds: beds,
          totalBeds,
          utilizationRate: totalBeds > 0 ? Math.round(((totalBeds - beds) / totalBeds) * 100) : 0,
        };
      })
    );

    // Calculate match scores and generate recommendations
    const matches: HospitalCapability[] = hospitalsWithCapacity
      .map((hospital) => {
        let matchScore = 0;
        const matchReasons: string[] = [];

        // Specialization match (40% of score)
        if (hospital.specialisation && hospital.specialisation.toLowerCase().includes(requiredSpecialization.toLowerCase())) {
          matchScore += 40;
          matchReasons.push(`Has ${requiredSpecialization} specialization`);
        } else {
          matchScore += 10;
          matchReasons.push('General facility, may handle referral');
        }

        // Capacity match (30% of score)
        if (hospital.availableBeds > 0) {
          matchScore += 30;
          matchReasons.push(`${hospital.availableBeds} beds available`);
        } else if (hospital.utilizationRate < 90) {
          matchScore += 15;
          matchReasons.push('Moderate capacity');
        } else {
          matchScore += 5;
          matchReasons.push('High utilization - may have waitlist');
        }

        // Insurance match (20% of score)
        if (hospital.acceptedInsurances && hospital.acceptedInsurances.includes(insurance)) {
          matchScore += 20;
          matchReasons.push(`Accepts ${insurance}`);
        } else {
          matchScore += 5;
          matchReasons.push('Insurance not listed - may accept');
        }

        // Distance/Location match (10% of score)
        const distance = calculateDistance(patientLocation, hospital.location || '');
        if (distance < 10) {
          matchScore += 10;
          matchReasons.push(`Nearby (${distance} km)`);
        } else if (distance < 25) {
          matchScore += 7;
          matchReasons.push(`Within reasonable distance (${distance} km)`);
        } else {
          matchScore += 3;
          matchReasons.push(`Further away (${distance} km)`);
        }

        // Urgency adjustment
        if (urgency === 'emergency' && hospital.availableBeds === 0) {
          matchScore -= 20;
          matchReasons.push('No beds available for emergency');
        }

        // Estimate wait time based on capacity
        let estimatedWaitTime = 'Unknown';
        if (hospital.availableBeds > 0) {
          estimatedWaitTime = urgency === 'emergency' ? '< 1 hour' : urgency === 'urgent' ? '2-4 hours' : '24-48 hours';
        } else {
          estimatedWaitTime = urgency === 'emergency' ? 'Immediate transfer needed' : '3-7 days';
        }

        // Determine if recommended
        const recommended = matchScore >= 70 && hospital.availableBeds > 0;

        return {
          id: hospital.id,
          name: hospital.name,
          location: hospital.location || 'Unknown',
          distance,
          specializations: hospital.specialisation ? [hospital.specialisation] : ['General'],
          currentCapacity: {
            availableBeds: hospital.availableBeds,
            totalBeds: hospital.totalBeds,
            utilizationRate: hospital.utilizationRate,
          },
          estimatedWaitTime,
          matchScore: Math.min(100, matchScore),
          matchReasons,
          recommended,
          contactInfo: {
            phone: hospital.phoneNumber || 'Not available',
            email: hospital.email || 'Not available',
          },
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore); // Sort by match score descending

    // Mark top match as recommended if none already marked
    const topRecommended = matches.find(m => m.recommended);
    if (!topRecommended && matches.length > 0) {
      matches[0].recommended = true;
    }

    logger.info('Referral matching completed', {
      diagnosis,
      requiredSpecialization,
      urgency,
      matchesFound: matches.length,
    });

    return NextResponse.json({
      matches: matches.slice(0, 10), // Return top 10 matches
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Referral matching error', { error });
    return NextResponse.json(
      { error: 'Failed to match referrals' },
      { status: 500 }
    );
  }
}

// Simple distance calculation (in production, would use Google Maps API or similar)
function calculateDistance(location1: string, location2: string): number {
  // Simplified: if locations are the same or similar, return small distance
  // Otherwise, return a random distance between 5 and 50 km
  if (location1.toLowerCase() === location2.toLowerCase()) {
    return 0;
  }
  
  // Extract city/region names for comparison
  const loc1 = location1.toLowerCase().split(',')[0].trim();
  const loc2 = location2.toLowerCase().split(',')[0].trim();
  
  if (loc1 === loc2) {
    return Math.random() * 5; // Same city: 0-5 km
  }
  
  // Different locations: 5-50 km (simplified)
  return 5 + Math.random() * 45;
}
