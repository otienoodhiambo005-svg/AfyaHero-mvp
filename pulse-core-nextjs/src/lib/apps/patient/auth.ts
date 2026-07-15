import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiRateLimit, enforceRequestFirewall } from '@/lib/api-security';
import { requireAppPrincipal } from '@/lib/apps/auth-principals';
import { requireV1AppPrincipal } from '@/lib/v1-app-auth';

const patientIdHeaderSchema = z.object({
  patientId: z.string().trim().min(1).max(128),
});

export interface PatientAppPrincipal {
  appId: string;
  hospitalId: string;
  patientId: string;
  authMethod: 'token' | 'signed_headers';
}

export type PatientAppGuardResult =
  | { principal: PatientAppPrincipal; response?: undefined }
  | { principal?: undefined; response: NextResponse };

function patientError(status: 401 | 403 | 429, message: string) {
  return NextResponse.json(
    {
      error: {
        status,
        message,
      },
    },
    { status },
  );
}

export async function requirePatientAppPrincipal(
  req: NextRequest,
  options?: { scope?: string; requiredScope?: 'fhir:read' | 'fhir:write' },
): Promise<PatientAppGuardResult> {
  const firewall = enforceRequestFirewall(req);
  if (firewall) return { response: firewall };

  const limited = await enforceApiRateLimit(req, options?.scope ?? 'api:apps:patient');
  if (limited) {
    return { response: patientError(429, 'Too many requests for patient app principal.') };
  }

  const hasBearerAuth = req.headers.get('authorization')?.toLowerCase().startsWith('bearer ') ?? false;

  if (hasBearerAuth) {
    const tokenPrincipal = requireV1AppPrincipal(req, {
      appTypes: ['patient_app'],
      requiredScope: options?.requiredScope ?? 'fhir:read',
    });
    if ('response' in tokenPrincipal) {
      return {
        response: tokenPrincipal.response.status === 401
          ? patientError(401, 'Patient app authentication required.')
          : patientError(403, 'Patient app scope or type is insufficient.'),
      };
    }
    if (tokenPrincipal.principal.subjectType !== 'patient' || !tokenPrincipal.principal.subjectId) {
      return { response: patientError(403, 'Token subject must be a patient for this route group.') };
    }
    return {
      principal: {
        appId: tokenPrincipal.principal.appId,
        hospitalId: tokenPrincipal.principal.hospitalId,
        patientId: tokenPrincipal.principal.subjectId,
        authMethod: 'token',
      },
    };
  }

  const fallbackAuth = requireAppPrincipal(req, {
    allowedKinds: ['patient_app'],
    requiredScope: options?.requiredScope ?? 'fhir:read',
  });
  if ('response' in fallbackAuth) {
    return {
      response: fallbackAuth.response.status === 401
        ? patientError(401, 'Patient app signed-header authentication required.')
        : patientError(403, 'Patient app signed-header scope or type is insufficient.'),
    };
  }

  const parsedHeader = patientIdHeaderSchema.safeParse({
    patientId: req.headers.get('x-afyahero-patient-id'),
  });
  if (!parsedHeader.success) {
    return { response: patientError(403, 'Missing or invalid patient context header.') };
  }

  return {
    principal: {
      appId: fallbackAuth.principal.appId,
      hospitalId: fallbackAuth.principal.hospitalId,
      patientId: parsedHeader.data.patientId,
      authMethod: 'signed_headers',
    },
  };
}
