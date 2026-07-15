/**
 * FHIR API Route - /api/fhir/[resource]
 * 
 * Provides FHIR-compliant REST endpoints for reading and writing
 * healthcare resources in HL7 FHIR R4 format.
 * 
 * Ref: https://www.hl7.org/fhir/http.html
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, enforceApiRateLimit } from '@/lib/api-security';
import type { UserSession } from '@/types';
import {
  mapPatientToFHIR,
  mapVitalsToFHIR,
  mapPractitionerToFHIR,
  mapOrganizationToFHIR,
} from '@/lib/fhir/fhir-mappers';
import { FHIRBundle, FHIRBundleEntry, FHIROperationOutcome, FHIRPatient, FHIRObservation, FHIRPractitioner, FHIROrganization, FHIRResource } from '@/lib/fhir/fhir-types';
import logger from '@/lib/logger';
import { prisma } from '@/lib/database';
import { Prisma } from '@prisma/client';
import {
  authenticateDeveloperApp,
  hasDeveloperScope,
  verifyDeveloperAppSignature,
  type DeveloperAppAuth,
} from '@/lib/external-api-auth';

// Supported FHIR resources
const SUPPORTED_RESOURCES = ['Patient', 'Observation', 'MedicationRequest', 'Practitioner', 'Organization', 'Condition', 'Encounter', 'AllergyIntolerance', 'DiagnosticReport', 'Procedure', 'Immunization'];

// Global resources that don't require hospital_id filtering
const GLOBAL_RESOURCES = new Set(['Organization']);

type FhirAccessContext = {
  principalType: 'staff' | 'developer_app';
  principalId: string;
  hospitalId: string;
  session: UserSession | null;
  developerApp: DeveloperAppAuth | null;
};

function enforceTenantAccess(context: FhirAccessContext, resource: string): NextResponse<FHIROperationOutcome> | null {
  if (GLOBAL_RESOURCES.has(resource)) return null;
  if (!context.hospitalId) {
    return createOperationOutcomeResponse('Forbidden — no hospital affiliation', 403);
  }
  return null;
}

function resolveAuthContext(req: NextRequest): {
  context: FhirAccessContext | null;
} {
  const session = getSessionFromRequest(req);
  if (session?.hospitalId) {
    return {
      context: {
        principalType: 'staff',
        principalId: session.id,
        hospitalId: session.hospitalId,
        session,
        developerApp: null,
      },
    };
  }

  const developerApp = authenticateDeveloperApp(req);
  if (!developerApp) return { context: null };
  const signature = verifyDeveloperAppSignature(req, developerApp);
  if (!signature.ok) return { context: null };

  return {
    context: {
      principalType: 'developer_app',
      principalId: developerApp.appId,
      hospitalId: developerApp.hospitalId,
      session: null,
      developerApp,
    },
  };
}

/**
 * GET /api/fhir/[resource]
 * 
 * Search or retrieve FHIR resources
 */
export async function GET(
  req: NextRequest,
  routeContext: { params: Promise<{ resource: string }> },
): Promise<NextResponse<FHIRBundle | FHIROperationOutcome>> {
  const limited = await enforceApiRateLimit(req, 'fhir-read');
  if (limited) return limited as NextResponse<FHIRBundle | FHIROperationOutcome>;

  const { context } = resolveAuthContext(req);
  if (!context) {
    return createOperationOutcomeResponse('Unauthorized', 401) as NextResponse<FHIRBundle | FHIROperationOutcome>;
  }
  if (context.developerApp && !hasDeveloperScope(context.developerApp, 'fhir:read')) {
    return createOperationOutcomeResponse('Forbidden — missing fhir:read scope', 403) as NextResponse<FHIRBundle | FHIROperationOutcome>;
  }

  const { resource } = await routeContext.params;

  if (!SUPPORTED_RESOURCES.includes(resource)) {
    return createOperationOutcomeResponse(
      `Unsupported resource: ${resource}. Supported: ${SUPPORTED_RESOURCES.join(', ')}`,
      400,
    );
  }

  const requestId = req.headers.get('x-request-id') || `req-${Date.now()}`;
  const requestLogger = logger.child({ requestId, resource, operation: 'GET' });

  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('_id');

    if (id) {
      return await retrieveResource(resource, id, context, requestLogger);
    }

    return await searchResources(resource, searchParams, context, requestLogger);
  } catch (error: unknown) {
    requestLogger.error(`Error processing GET ${resource}`, { error: error instanceof Error ? error.message : String(error) });
    return createOperationOutcomeResponse('Internal server error', 500);
  }
}

/**
 * POST /api/fhir/[resource]
 * 
 * Create a new FHIR resource
 */
export async function POST(
  req: NextRequest,
  routeContext: { params: Promise<{ resource: string }> },
): Promise<NextResponse<FHIRPatient | FHIRObservation | FHIRPractitioner | FHIROrganization | FHIROperationOutcome>> {
  const limited = await enforceApiRateLimit(req, 'fhir-write');
  if (limited) return limited as NextResponse<FHIRPatient | FHIRObservation | FHIRPractitioner | FHIROrganization | FHIROperationOutcome>;

  const { context } = resolveAuthContext(req);
  if (!context) {
    return createOperationOutcomeResponse('Unauthorized', 401) as NextResponse<FHIRPatient | FHIRObservation | FHIRPractitioner | FHIROrganization | FHIROperationOutcome>;
  }
  if (context.developerApp && !hasDeveloperScope(context.developerApp, 'fhir:write')) {
    return createOperationOutcomeResponse('Forbidden — missing fhir:write scope', 403) as NextResponse<FHIRPatient | FHIRObservation | FHIRPractitioner | FHIROrganization | FHIROperationOutcome>;
  }

  const { resource } = await routeContext.params;

  if (!SUPPORTED_RESOURCES.includes(resource)) {
    return createOperationOutcomeResponse(
      `Unsupported resource: ${resource}. Supported: ${SUPPORTED_RESOURCES.join(', ')}`,
      400,
    ) as NextResponse<FHIRPatient | FHIRObservation | FHIRPractitioner | FHIROrganization | FHIROperationOutcome>;
  }

  const requestId = req.headers.get('x-request-id') || `req-${Date.now()}`;
  const requestLogger = logger.child({ requestId, resource, operation: 'POST' });

  try {
    const body = await req.json();
    return await createResource(resource, body, context, requestLogger);
  } catch (error: unknown) {
    requestLogger.error(`Error processing POST ${resource}`, { error: error instanceof Error ? error.message : String(error) });
    return createOperationOutcomeResponse('Invalid request body', 400);
  }
}

/**
 * PUT /api/fhir/[resource]/[id]
 * 
 * Update a FHIR resource
 */
export async function PUT(
  req: NextRequest,
  routeContext: { params: Promise<{ resource: string }> },
): Promise<NextResponse<FHIROperationOutcome>> {
  const limited = await enforceApiRateLimit(req, 'fhir-write');
  if (limited) return limited as NextResponse<FHIROperationOutcome>;

  const { context } = resolveAuthContext(req);
  if (!context) {
    return createOperationOutcomeResponse('Unauthorized', 401);
  }
  if (context.developerApp && !hasDeveloperScope(context.developerApp, 'fhir:write')) {
    return createOperationOutcomeResponse('Forbidden — missing fhir:write scope', 403);
  }

  const { resource } = await routeContext.params;
  const requestId = req.headers.get('x-request-id') || `req-${Date.now()}`;
  const requestLogger = logger.child({ requestId, resource, operation: 'PUT' });

  try {
    const body = await req.json();

    if (body.resourceType !== resource) {
      return createOperationOutcomeResponse('Resource type mismatch', 400);
    }

    const idFromQuery = req.nextUrl.searchParams.get('_id');
    const idFromBody = typeof body.id === 'string' ? body.id : undefined;
    const id = idFromQuery ?? idFromBody;
    if (!id) {
      return createOperationOutcomeResponse('Missing resource id. Provide _id query parameter or body.id', 400);
    }

    return await updateResource(resource, id, body, context, requestLogger);
  } catch (error: unknown) {
    requestLogger.error(`Error processing PUT ${resource}`, { error: error instanceof Error ? error.message : String(error) });
    return createOperationOutcomeResponse('Invalid request', 400);
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────

function mapToFHIR(resourceType: string, data: Record<string, unknown>): FHIRResource {
  switch (resourceType) {
    case 'Patient':
      return mapPatientToFHIR(data as never) as FHIRResource;
    case 'Practitioner':
      return mapPractitionerToFHIR(data as never) as FHIRResource;
    case 'Organization':
      return mapOrganizationToFHIR(data as never) as FHIRResource;
    case 'Observation': {
      const bpSystolic = data.bp_systolic as number | undefined;
      const bpDiastolic = data.bp_diastolic as number | undefined;
      const vitalsData = {
        bp: bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : (data.blood_pressure as string) ?? '',
        pulse: Number(data.pulse ?? data.heart_rate ?? 0),
        temp: Number(data.temperature ?? data.temp_c ?? 0),
        spo2: Number(data.spo2 ?? 0),
        rr: data.respiratory_rate ? Number(data.respiratory_rate) : Number(data.resp_rate ?? 0),
        weight: Number(data.weight_kg ?? data.weight ?? 0),
        height: Number(data.height_cm ?? data.height ?? 0),
        recordedAt: String(data.recorded_at ?? data.recordedAt ?? ''),
        recordedBy: String(data.recorded_by ?? data.recordedBy ?? ''),
      };
      return mapVitalsToFHIR(String(data.patient_id ?? data.patientId ?? ''), vitalsData)[0] as FHIRResource;
    }
    default:
      return { resourceType: 'Basic', id: String(data.id) } as FHIRResource;
  }
}

async function retrieveResource(
  resourceType: string,
  id: string,
  context: FhirAccessContext,
  requestLogger: ReturnType<typeof logger.child>,
): Promise<NextResponse<FHIRBundle | FHIROperationOutcome>> {
  requestLogger.debug(`Retrieving ${resourceType}/${id}`);

  const tenantCheck = enforceTenantAccess(context, resourceType);
  if (tenantCheck) return tenantCheck;

  try {
    switch (resourceType) {
      case 'Patient': {
        const patient = await prisma.patient.findFirst({
          where: { id, hospitalId: context.hospitalId },
        });
        if (!patient) return createOperationOutcomeResponse('Patient not found', 404);
        return NextResponse.json(mapPatientToFHIR(patient as never), {
          status: 200,
          headers: createFHIRHeaders(),
        }) as unknown as NextResponse<FHIRBundle | FHIROperationOutcome>;
      }

      case 'Practitioner': {
        const practitioner = await prisma.profile.findFirst({
          where: { id, hospitalId: context.hospitalId },
        });
        if (!practitioner) return createOperationOutcomeResponse('Practitioner not found', 404);
        return NextResponse.json(mapPractitionerToFHIR(practitioner as never), {
          status: 200,
          headers: createFHIRHeaders(),
        }) as unknown as NextResponse<FHIRBundle | FHIROperationOutcome>;
      }

      case 'Organization': {
        const org = await prisma.hospital.findUnique({ where: { id } });
        if (!org) return createOperationOutcomeResponse('Organization not found', 404);
        return NextResponse.json(mapOrganizationToFHIR(org as never), {
          status: 200,
          headers: createFHIRHeaders(),
        }) as unknown as NextResponse<FHIRBundle | FHIROperationOutcome>;
      }

      case 'Observation': {
        const vital = await prisma.clinicalVital.findFirst({
          where: { id, hospitalId: context.hospitalId },
        });
        if (!vital) return createOperationOutcomeResponse('Observation not found', 404);
        const observations = mapVitalsToFHIR(vital.patientId, {
          bp: vital.bloodPressure ?? '',
          pulse: vital.heartRate ?? 0,
          temp: vital.tempC ? Number(vital.tempC) : 0,
          spo2: vital.spo2 ?? 0,
          rr: vital.respRate ?? 0,
          weight: vital.weight ? Number(vital.weight) : 0,
          height: vital.height ? Number(vital.height) : 0,
          recordedAt: vital.recordedAt.toISOString(),
          recordedBy: vital.recordedBy ?? '',
        });
        return NextResponse.json(observations[0] || observations, {
          status: 200,
          headers: createFHIRHeaders(),
        }) as unknown as NextResponse<FHIRBundle | FHIROperationOutcome>;
      }

      default:
        return createOperationOutcomeResponse(`Unsupported resource: ${resourceType}`, 400);
    }
  } catch (err: unknown) {
    requestLogger.error(`Failed to retrieve ${resourceType}/${id}`, { error: err instanceof Error ? err.message : String(err) });
    return createOperationOutcomeResponse('Internal server error', 500);
  }
}

async function searchResources(
  resourceType: string,
  params: URLSearchParams,
  context: FhirAccessContext,
  requestLogger: ReturnType<typeof logger.child>,
): Promise<NextResponse<FHIRBundle | FHIROperationOutcome>> {
  requestLogger.debug(`Searching ${resourceType}`, { params: Object.fromEntries(params) });

  const tenantCheck = enforceTenantAccess(context, resourceType);
  if (tenantCheck) return tenantCheck;

  try {
    const count = params.get('_count');
    const limit = count ? parseInt(count, 10) : 100;
    let items: unknown[] = [];

    switch (resourceType) {
      case 'Patient': {
        const name = params.get('name');
        const gender = params.get('gender');
        const birthdate = params.get('birthdate');
        const where: Prisma.PatientWhereInput = { hospitalId: context.hospitalId };
        if (name) where.name = { contains: name, mode: 'insensitive' };
        if (gender) where.gender = { equals: gender === 'male' ? 'M' : 'F' };
        if (birthdate) where.dob = { equals: new Date(birthdate) };
        items = await prisma.patient.findMany({ where, take: limit });
        break;
      }
      case 'Observation': {
        const subject = params.get('subject');
        const patientId = subject?.replace('Patient/', '');
        const where: Prisma.ClinicalVitalWhereInput = { hospitalId: context.hospitalId };
        if (patientId) where.patientId = patientId;
        items = await prisma.clinicalVital.findMany({ where, take: limit });
        break;
      }
      case 'Practitioner': {
        const name = params.get('name');
        const where: Prisma.ProfileWhereInput = { hospitalId: context.hospitalId };
        if (name) where.fullName = { contains: name, mode: 'insensitive' };
        items = await prisma.profile.findMany({ where, take: limit });
        break;
      }
      case 'Organization': {
        items = await prisma.hospital.findMany({ take: limit });
        break;
      }
      default:
        return createOperationOutcomeResponse(`Unsupported resource: ${resourceType}`, 400);
    }

    const entries: FHIRBundleEntry[] = items.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        resource: mapToFHIR(resourceType, record),
        fullUrl: `${process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com'}/${resourceType}/${record.id}`,
      };
    });

    const bundle: FHIRBundle = {
      resourceType: 'Bundle',
      id: `search-${Date.now()}`,
      type: 'searchset',
      timestamp: new Date().toISOString(),
      total: items.length,
      entry: entries,
      link: [{
        relation: 'self',
        url: `${process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com'}/${resourceType}?${params.toString()}`,
      }],
    };

    return NextResponse.json(bundle, {
      status: 200,
      headers: createFHIRHeaders(),
    }) as NextResponse<FHIRBundle | FHIROperationOutcome>;
  } catch (err: unknown) {
    requestLogger.error(`Search error for ${resourceType}`, { error: err instanceof Error ? err.message : String(err) });
    return createOperationOutcomeResponse('Internal server error', 500) as NextResponse<FHIRBundle | FHIROperationOutcome>;
  }
}

function createOperationOutcomeResponse(
  message: string,
  status: number,
): NextResponse<FHIROperationOutcome> {
  const outcome: FHIROperationOutcome = {
    resourceType: 'OperationOutcome',
    id: `outcome-${Date.now()}`,
    issue: [
      {
        severity: status >= 400 ? 'error' : 'information',
        code: getIssueCode(status),
        details: {
          text: message,
        },
      },
    ],
  };

  return NextResponse.json(outcome, {
    status,
    headers: createFHIRHeaders(),
  });
}

function getIssueCode(status: number): string {
  switch (status) {
    case 400:
      return 'invalid';
    case 401:
      return 'security';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 409:
      return 'conflict';
    case 422:
      return 'invalid';
    case 500:
      return 'exception';
    default:
      return 'processing';
  }
}

// ─── CREATE / UPDATE Operations ─────────────────────────────────────────

async function createResource(
  resourceType: string,
  body: Record<string, unknown>,
  context: FhirAccessContext,
  requestLogger: ReturnType<typeof logger.child>,
): Promise<NextResponse<FHIRPatient | FHIRObservation | FHIRPractitioner | FHIROrganization | FHIROperationOutcome>> {
  requestLogger.info(`Creating ${resourceType} resource`);

  const tenantCheck = enforceTenantAccess(context, resourceType);
  if (tenantCheck) return tenantCheck;

  try {
    switch (resourceType) {
      case 'Patient': {
        const names = body.name as Array<{ given: string[]; family: string }> | undefined;
        const identifiers = body.identifier as Array<{ system?: string; value: string }> | undefined;
        const telecoms = body.telecom as Array<{ system: string; value: string }> | undefined;
        const extensions = body.extension as Array<{ url?: string; valueCode?: string; valueString?: string }> | undefined;
        const patient = await prisma.patient.create({
          data: {
            name: `${names?.[0]?.given?.join(' ') ?? ''} ${names?.[0]?.family ?? ''}`.trim() || 'Unknown',
            gender: body.gender === 'male' ? 'M' : body.gender === 'female' ? 'F' : undefined,
            dob: body.birthDate ? new Date(body.birthDate as string) : new Date(),
            phone: telecoms?.find(t => t.system === 'phone')?.value,
            idNumber: identifiers?.find(i => i.system?.includes('national'))?.value,
            bloodGroup: extensions?.find(e => e.url?.includes('blood-group'))?.valueCode,
            allergies: extensions?.find(e => e.url?.includes('allergies'))?.valueString?.split(', ') ?? [],
            hospitalId: context.hospitalId,
          },
        });
        return NextResponse.json(mapPatientToFHIR(patient as never), {
          status: 201,
          headers: {
            ...createFHIRHeaders(),
            Location: `${process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com'}/Patient/${patient.id}`,
          },
        });
      }

      case 'Practitioner': {
        const names = body.name as Array<{ given: string[]; family: string }> | undefined;
        const telecoms = body.telecom as Array<{ system: string; value: string }> | undefined;
        const qualifications = body.qualification as Array<{ code?: { text?: string } }> | undefined;
        const practitioner = await prisma.profile.create({
          data: {
            fullName: `${names?.[0]?.given?.join(' ') ?? ''} ${names?.[0]?.family ?? ''}`.trim() || 'Unknown',
            email: telecoms?.find(t => t.system === 'email')?.value ?? '',
            phone: telecoms?.find(t => t.system === 'phone')?.value,
            title: qualifications?.[0]?.code?.text,
            role: 'medical',
            status: 'active',
            hospitalId: context.hospitalId,
          },
        });
        return NextResponse.json(mapPractitionerToFHIR(practitioner as never), {
          status: 201,
          headers: {
            ...createFHIRHeaders(),
            Location: `${process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com'}/Practitioner/${practitioner.id}`,
          },
        });
      }

      case 'Organization': {
        const telecoms = body.telecom as Array<{ system: string; value: string }> | undefined;
        const types = body.type as Array<{ coding?: Array<{ display?: string }> }> | undefined;
        const org = await prisma.hospital.create({
          data: {
            name: (body.name as string) || 'Unknown',
            phoneNumber: telecoms?.find(t => t.system === 'phone')?.value,
            email: telecoms?.find(t => t.system === 'email')?.value,
            specialisation: types?.[0]?.coding?.[0]?.display,
          },
        });
        return NextResponse.json(mapOrganizationToFHIR(org as never), {
          status: 201,
          headers: {
            ...createFHIRHeaders(),
            Location: `${process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com'}/Organization/${org.id}`,
          },
        });
      }

      case 'Observation': {
        const components = body.component as Array<{ code?: { coding?: Array<{ code?: string }> }; valueQuantity?: { value?: number } }> | undefined;
        const valueQuantity = body.valueQuantity as { code?: string; value?: number } | undefined;
        const bpSystolic = components?.find(c => c.code?.coding?.[0]?.code === '8480-6')?.valueQuantity?.value;
        const bpDiastolic = components?.find(c => c.code?.coding?.[0]?.code === '8462-4')?.valueQuantity?.value;
        const vital = await prisma.clinicalVital.create({
          data: {
            patientId: (body.subject as { reference?: string } | undefined)?.reference?.replace('Patient/', '') ?? '',
            recordedBy: (body.performer as Array<{ reference?: string }> | undefined)?.[0]?.reference?.replace('Practitioner/', ''),
            bloodPressure: bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : undefined,
            heartRate: valueQuantity?.code === '8867-4' ? valueQuantity.value : undefined,
            tempC: valueQuantity?.code === '8310-5' ? valueQuantity.value : undefined,
            spo2: valueQuantity?.code === '59408-5' ? valueQuantity.value : undefined,
            weight: valueQuantity?.code === '3141-9' ? valueQuantity.value : undefined,
            height: valueQuantity?.code === '8302-2' ? valueQuantity.value : undefined,
            respRate: undefined,
            hospitalId: context.hospitalId,
          },
        });
        const observations = mapVitalsToFHIR(vital.patientId, {
          bp: vital.bloodPressure ?? '',
          pulse: vital.heartRate ?? 0,
          temp: vital.tempC ? Number(vital.tempC) : 0,
          spo2: vital.spo2 ?? 0,
          rr: vital.respRate ?? 0,
          weight: vital.weight ? Number(vital.weight) : 0,
          height: vital.height ? Number(vital.height) : 0,
          recordedAt: vital.recordedAt.toISOString(),
          recordedBy: vital.recordedBy ?? '',
        });
        return NextResponse.json(observations[0], {
          status: 201,
          headers: {
            ...createFHIRHeaders(),
            Location: `${process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com'}/Observation/${vital.id}`,
          },
        });
      }

      default:
        return createOperationOutcomeResponse(`Cannot create ${resourceType}`, 400);
    }
  } catch (err: unknown) {
    requestLogger.error(`Error creating ${resourceType}`, { error: err instanceof Error ? err.message : String(err) });
    return createOperationOutcomeResponse('Internal server error', 500);
  }
}

async function updateResource(
  resourceType: string,
  id: string,
  body: Record<string, unknown>,
  context: FhirAccessContext,
  requestLogger: ReturnType<typeof logger.child>,
): Promise<NextResponse<FHIROperationOutcome>> {
  requestLogger.info(`Updating ${resourceType}/${id}`);

  const tenantCheck = enforceTenantAccess(context, resourceType);
  if (tenantCheck) return tenantCheck;

  try {
    switch (resourceType) {
      case 'Patient': {
        const names = body.name as Array<{ given: string[]; family: string }> | undefined;
        const telecoms = body.telecom as Array<{ system: string; value: string }> | undefined;
        const updateData: Record<string, unknown> = {};
        if (names?.[0]) updateData.name = `${names[0].given.join(' ')} ${names[0].family}`;
        if (body.gender) updateData.gender = body.gender === 'male' ? 'M' : body.gender === 'female' ? 'F' : body.gender;
        if (body.birthDate) updateData.dob = new Date(body.birthDate as string);
        if (telecoms?.find(t => t.system === 'phone')) updateData.phone = telecoms.find(t => t.system === 'phone')!.value;

        const updated = await prisma.patient.updateMany({
          where: { id, hospitalId: context.hospitalId },
          data: updateData,
        });
        if (updated.count === 0) return createOperationOutcomeResponse('Patient not found', 404);
        break;
      }

      case 'Practitioner': {
        const names = body.name as Array<{ given: string[]; family: string }> | undefined;
        const telecoms = body.telecom as Array<{ system: string; value: string }> | undefined;
        const updateData: Record<string, unknown> = {};
        if (names?.[0]) updateData.fullName = `${names[0].given.join(' ')} ${names[0].family}`;
        if (telecoms?.find(t => t.system === 'email')) updateData.email = telecoms.find(t => t.system === 'email')!.value;
        if (telecoms?.find(t => t.system === 'phone')) updateData.phone = telecoms.find(t => t.system === 'phone')!.value;

        const updated = await prisma.profile.updateMany({
          where: { id, hospitalId: context.hospitalId },
          data: updateData,
        });
        if (updated.count === 0) return createOperationOutcomeResponse('Practitioner not found', 404);
        break;
      }

      case 'Organization': {
        const telecoms = body.telecom as Array<{ system: string; value: string }> | undefined;
        const updateData: Record<string, unknown> = {};
        if (body.name) updateData.name = body.name;
        if (telecoms?.find(t => t.system === 'phone')) updateData.phoneNumber = telecoms.find(t => t.system === 'phone')!.value;
        if (telecoms?.find(t => t.system === 'email')) updateData.email = telecoms.find(t => t.system === 'email')!.value;

        const updated = await prisma.hospital.updateMany({
          where: { id },
          data: updateData,
        });
        if (updated.count === 0) return createOperationOutcomeResponse('Organization not found', 404);
        break;
      }

      case 'Observation': {
        const components = body.component as Array<{ code?: { coding?: Array<{ code?: string }> }; valueQuantity?: { value?: number } }> | undefined;
        const valueQuantity = body.valueQuantity as { code?: string; value?: number } | undefined;
        const updateData: Record<string, unknown> = {};
        const bpSystolic = components?.find(c => c.code?.coding?.[0]?.code === '8480-6')?.valueQuantity?.value;
        const bpDiastolic = components?.find(c => c.code?.coding?.[0]?.code === '8462-4')?.valueQuantity?.value;
        if (bpSystolic && bpDiastolic) updateData.bloodPressure = `${bpSystolic}/${bpDiastolic}`;
        if (valueQuantity?.code === '8867-4') updateData.heartRate = valueQuantity.value;
        if (valueQuantity?.code === '8310-5') updateData.tempC = valueQuantity.value;
        if (valueQuantity?.code === '59408-5') updateData.spo2 = valueQuantity.value;
        if (valueQuantity?.code === '3141-9') updateData.weight = valueQuantity.value;
        if (valueQuantity?.code === '8302-2') updateData.height = valueQuantity.value;

        const updated = await prisma.clinicalVital.updateMany({
          where: { id, hospitalId: context.hospitalId },
          data: updateData,
        });
        if (updated.count === 0) return createOperationOutcomeResponse('Observation not found', 404);
        break;
      }

      default:
        return createOperationOutcomeResponse(`Cannot update ${resourceType}`, 400);
    }

    requestLogger.info(`Updated ${resourceType}/${id}`);

    return NextResponse.json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'information',
        code: 'informational',
        details: { text: `${resourceType} updated successfully` },
      }],
    }, {
      status: 200,
      headers: createFHIRHeaders(),
    });
  } catch (err: unknown) {
    requestLogger.error(`Error updating ${resourceType}/${id}`, { error: err instanceof Error ? err.message : String(err) });
    return createOperationOutcomeResponse('Internal server error', 500);
  }
}

function createFHIRHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/fhir+json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
  };
}
