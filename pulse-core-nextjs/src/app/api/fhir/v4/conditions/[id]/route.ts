/**
 * GET /api/fhir/v4/conditions/[id]
 * 
 * Returns a FHIR R4 Condition resource for the given condition ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { mapConditionToFHIR } from '@/lib/fhir-mappers';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireRoles(request, ['medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    // Since we don't have a dedicated Condition model, we'll use clinical notes
    // or create a stub that can be extended later
    // For now, return a not-found with guidance
    
    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'information',
            code: 'not-supported',
            diagnostics: 'Condition resources can be derived from clinical notes - implement as needed',
          },
        ],
      },
      { status: 501 },
    );
  } catch (err) {
    logger.error('[FHIR Condition GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'exception',
            diagnostics: err instanceof Error ? err.message : String(err),
          },
        ],
      },
      { status: 500 },
    );
  }
}
