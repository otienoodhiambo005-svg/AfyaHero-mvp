/**
 * FHIR CapabilityStatement (Metadata)
 * 
 * GET /api/fhir/metadata
 * 
 * Provides machine-readable description of FHIR API capabilities
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const capabilityStatement = {
    resourceType: 'CapabilityStatement',
    id: 'afyahero-fhir-capabilities',
    meta: {
      lastUpdated: new Date().toISOString(),
    },
    url: `${process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com'}/metadata`,
    version: '1.0.0',
    name: 'AfyaHero FHIR API',
    title: 'AfyaHero Healthcare System - FHIR API Capabilities',
    status: 'active',
    experimental: false,
    date: new Date().toISOString(),
    publisher: 'AfyaHero',
    description:
      'FHIR R4 compliant API for healthcare data exchange in AfyaHero healthcare system. Supports reading and querying of patient data, clinical observations, medications, and healthcare worker information.',
    kind: 'instance',
    fhirVersion: '4.0.1',
    format: ['application/fhir+json', 'application/json'],
    patchFormat: ['application/json-patch+json'],
    implementationGuide: [
      `${process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com'}/ImplementationGuide/afyahero-core`,
    ],
    software: {
      name: 'AfyaHero',
      version: '1.0.0',
      releaseDate: '2024-01-01',
    },
    implementation: {
      description: 'AfyaHero FHIR Server',
      url: process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com',
    },
    security: {
      cors: true,
      service: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
              code: 'OAuth',
              display: 'OAuth',
            },
          ],
          text: 'OAuth 2.0 Bearer Token',
        },
      ],
      description:
        'Supports cookie/JWT auth for staff users and AfyaHero developer app auth using x-afyahero-app-id + x-afyahero-app-key + signed timestamped requests. Developer apps are limited by configured fhir:read/fhir:write scopes and tenant mapping.',
    },
    rest: [
      {
        mode: 'server',
        documentation:
          'This server provides FHIR-compliant REST endpoints for healthcare data.',
        security: {
          cors: true,
          service: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                  code: 'OAuth',
                },
              ],
              text: 'OAuth2',
            },
          ],
          description:
            'Implements staff auth plus scoped developer API authentication for patient/chp/company app integrations.',
        },
        resource: [
          {
            type: 'Patient',
            profile: 'http://hl7.org/fhir/StructureDefinition/Patient',
            documentation:
              'Patient records including demographics, insurance, and contact information',
            interaction: [
              {
                code: 'read',
                documentation: 'Retrieve a specific patient by ID',
              },
              {
                code: 'search-type',
                documentation: 'Search for patients by name, ID, phone, etc.',
              },
              {
                code: 'create',
                documentation: 'Create a new patient record',
              },
              {
                code: 'update',
                documentation: 'Update an existing patient record',
              },
            ],
            searchParam: [
              {
                name: '_id',
                definition: 'http://hl7.org/fhir/SearchParameter/Resource-id',
                type: 'token',
                documentation: 'Patient ID',
              },
              {
                name: 'name',
                definition: 'http://hl7.org/fhir/SearchParameter/Patient-name',
                type: 'string',
                documentation: 'Patient name',
              },
              {
                name: 'phone',
                definition: 'http://hl7.org/fhir/SearchParameter/Patient-phone',
                type: 'token',
                documentation: 'Patient phone number',
              },
              {
                name: 'identifier',
                definition:
                  'http://hl7.org/fhir/SearchParameter/Patient-identifier',
                type: 'token',
                documentation: 'Patient ID number or insurance ID',
              },
            ],
          },
          {
            type: 'Observation',
            profile: 'http://hl7.org/fhir/StructureDefinition/Observation',
            documentation:
              'Observations including vital signs and laboratory results',
            interaction: [
              {
                code: 'read',
                documentation: 'Retrieve a specific observation',
              },
              {
                code: 'search-type',
                documentation:
                  'Search observations by patient, code, date, etc.',
              },
              {
                code: 'create',
                documentation: 'Create a new observation',
              },
            ],
            searchParam: [
              {
                name: 'subject',
                type: 'reference',
                documentation: 'Patient reference',
              },
              {
                name: 'code',
                type: 'token',
                documentation: 'Observation code (LOINC)',
              },
              {
                name: 'date',
                type: 'date',
                documentation: 'Observation date range',
              },
              {
                name: 'category',
                type: 'token',
                documentation: 'Observation category (vital-signs, laboratory)',
              },
            ],
          },
          {
            type: 'MedicationRequest',
            profile:
              'http://hl7.org/fhir/StructureDefinition/MedicationRequest',
            documentation: 'Prescriptions and medication orders',
            interaction: [
              {
                code: 'read',
                documentation: 'Retrieve a specific medication request',
              },
              {
                code: 'search-type',
                documentation: 'Search medication requests by patient, status',
              },
              {
                code: 'create',
                documentation: 'Create a new medication request',
              },
            ],
            searchParam: [
              {
                name: 'subject',
                type: 'reference',
                documentation: 'Patient reference',
              },
              {
                name: 'status',
                type: 'token',
                documentation: 'Medication request status',
              },
            ],
          },
          {
            type: 'Practitioner',
            profile: 'http://hl7.org/fhir/StructureDefinition/Practitioner',
            documentation: 'Healthcare worker/practitioner information',
            interaction: [
              {
                code: 'read',
                documentation: 'Retrieve a specific practitioner',
              },
              {
                code: 'search-type',
                documentation: 'Search practitioners by name, ID',
              },
            ],
            searchParam: [
              {
                name: '_id',
                type: 'token',
                documentation: 'Practitioner ID',
              },
              {
                name: 'name',
                type: 'string',
                documentation: 'Practitioner name',
              },
            ],
          },
          {
            type: 'Organization',
            profile: 'http://hl7.org/fhir/StructureDefinition/Organization',
            documentation: 'Healthcare facility/organization information',
            interaction: [
              {
                code: 'read',
                documentation: 'Retrieve a specific organization',
              },
              {
                code: 'search-type',
                documentation: 'Search organizations by name, type',
              },
            ],
            searchParam: [
              {
                name: '_id',
                type: 'token',
                documentation: 'Organization ID',
              },
              {
                name: 'name',
                type: 'string',
                documentation: 'Organization name',
              },
            ],
          },
        ],
        operation: [
          {
            name: 'validate',
            definition:
              'http://hl7.org/fhir/OperationDefinition/Resource-validate',
            documentation:
              'Validate a resource against its profile before saving',
          },
          {
            name: 'search',
            definition: 'http://hl7.org/fhir/OperationDefinition/Resource-search',
            documentation: 'Extended search capabilities',
          },
        ],
      },
    ],
  };

  return NextResponse.json(capabilityStatement, {
    status: 200,
    headers: {
      'Content-Type': 'application/fhir+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
