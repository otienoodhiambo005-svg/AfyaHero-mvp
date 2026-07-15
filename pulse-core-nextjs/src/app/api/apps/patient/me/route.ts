import { NextRequest, NextResponse } from 'next/server';
import { requirePatientAppPrincipal } from '@/lib/apps/patient/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requirePatientAppPrincipal(req, {
    scope: 'api:apps:patient:me',
    requiredScope: 'fhir:read',
  });
  if (auth.response) return auth.response;

  return NextResponse.json(
    {
      patient: {
        id: auth.principal.patientId,
        hospitalId: auth.principal.hospitalId,
      },
      app: {
        id: auth.principal.appId,
        authMethod: auth.principal.authMethod,
      },
    },
    { status: 200 },
  );
}
