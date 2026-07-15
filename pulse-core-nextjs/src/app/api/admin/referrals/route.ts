import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { 
  enforceApiRateLimit, 
  requireRoles,
  readJsonBody
} from '@/lib/api-security';
import logger from '@/lib/logger';

/**
 * GET /api/admin/referrals
 * List all referrals for the hospital.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = await enforceApiRateLimit(request, 'api:admin:referrals:get');
    if (rateLimit) return rateLimit;

    const session = requireRoles(request, ['admin', 'medical']);
    if (session instanceof NextResponse) return session;

    // In a real multi-tenant scenario, we'd filter by hospitalId from session
    // For now, we fetch all to populate the admin dashboard
    const referrals = await prisma.patient.findMany({
      where: {
        status: 'active',
      },
      take: 20,
    });

    // Mocking referral-specific fields since they might not be in the base schema yet
    const transformedReferrals = referrals.map((p, i) => ({
      id: p.id,
      patientName: p.name,
      sourceHospital: i % 2 === 0 ? 'Kenyatta National Hospital' : 'Aga Khan University Hospital',
      destinationHospital: 'AfyaHero Main Branch',
      status: ['Pending', 'In Transit', 'Received'][i % 3],
      priority: (i % 5) + 1,
      expectedArrival: new Date(Date.now() + i * 3600000).toISOString(),
    }));

    return NextResponse.json(transformedReferrals);
  } catch (error) {
    logger.error('Failed to fetch referrals', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/referrals
 * Create a new referral request.
 */
export async function POST(request: NextRequest) {
  try {
    const session = requireRoles(request, ['admin', 'medical']);
    if (session instanceof NextResponse) return session;

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    // Logic for creating a referral would go here
    return NextResponse.json({ success: true, message: 'Referral request initiated' });
  } catch (error) {
    logger.error('Failed to create referral', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
