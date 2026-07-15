/**
 * GET /api/fhir/v4/metadata
 * 
 * Returns the FHIR R4 Capability Statement for the AfyaHero FHIR server.
 * Describes the supported resources, operations, and security.
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const baseUrl = new URL(request.url).origin;

    const capabilityStatement = {
      resourceType: 'CapabilityStatement',
      id: 'afyahero-fhir-server',
      status: 'active',
      date: new Date().toISOString().split('T')[0],
      kind: 'instance',
      implementation: {
        description: 'AfyaHero Hospital OS FHIR R4 Server',
        url: `${baseUrl}/api/fhir/v4`,
      },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json', 'application/fhir+xml'],
      rest: [
        {
          mode: 'server',
          security: {
            cors: true,
            service: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                    code: 'OAuth',
                    display: 'OAuth2',
                  },
                ],
              },
            ],
            description: 'Uses AfyaHero authentication system with role-based access control',
          },
          resource: [
            {
              type: 'Patient',
              interaction: [
                { code: 'read' },
                { code: 'search-type' },
              ],
              searchParam: [
                {
                  name: '_id',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/Resource-id',
                },
                {
                  name: 'identifier',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/Patient-identifier',
                },
                {
                  name: 'name',
                  type: 'string',
                  definition: 'http://hl7.org/fhir/SearchParameter/Patient-name',
                },
              ],
            },
            {
              type: 'Encounter',
              interaction: [
                { code: 'read' },
                { code: 'search-type' },
              ],
              searchParam: [
                {
                  name: '_id',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/Resource-id',
                },
                {
                  name: 'patient',
                  type: 'reference',
                  definition: 'http://hl7.org/fhir/SearchParameter/Encounter-patient',
                },
                {
                  name: 'status',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/Encounter-status',
                },
              ],
            },
            {
              type: 'MedicationRequest',
              interaction: [
                { code: 'read' },
                { code: 'search-type' },
              ],
              searchParam: [
                {
                  name: '_id',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/Resource-id',
                },
                {
                  name: 'patient',
                  type: 'reference',
                  definition: 'http://hl7.org/fhir/SearchParameter/MedicationRequest-patient',
                },
                {
                  name: 'status',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/MedicationRequest-status',
                },
              ],
            },
            {
              type: 'ServiceRequest',
              interaction: [
                { code: 'read' },
                { code: 'search-type' },
              ],
              searchParam: [
                {
                  name: '_id',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/Resource-id',
                },
                {
                  name: 'patient',
                  type: 'reference',
                  definition: 'http://hl7.org/fhir/SearchParameter/ServiceRequest-subject',
                },
                {
                  name: 'status',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/ServiceRequest-status',
                },
              ],
            },
            {
              type: 'Observation',
              interaction: [
                { code: 'read' },
                { code: 'search-type' },
              ],
              searchParam: [
                {
                  name: '_id',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/Resource-id',
                },
                {
                  name: 'patient',
                  type: 'reference',
                  definition: 'http://hl7.org/fhir/SearchParameter/Observation-subject',
                },
                {
                  name: 'category',
                  type: 'token',
                  definition: 'http://hl7.org/fhir/SearchParameter/Observation-category',
                },
              ],
            },
            {
              type: 'Condition',
              interaction: [
                { code: 'read' },
              ],
              documentation: 'Condition resources can be derived from clinical notes',
            },
            {
              type: 'Procedure',
              interaction: [
                { code: 'read' },
              ],
              documentation: 'Procedure resources can be derived from consultation records',
            },
            {
              type: 'Practitioner',
              interaction: [
                { code: 'read' },
              ],
            },
            {
              type: 'Organization',
              interaction: [
                { code: 'read' },
              ],
            },
          ],
          operation: [
            {
              name: 'validate',
              definition: 'http://hl7.org/fhir/OperationDefinition/Resource-validate',
            },
          ],
        },
      ],
    };

    return NextResponse.json(capabilityStatement, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
      },
    });
  } catch (err) {
    logger.error('[FHIR Metadata GET] Error', {
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
