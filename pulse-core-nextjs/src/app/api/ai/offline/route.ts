/**
 * Offline AI API Endpoint - AfyaHero
 * 
 * Provides offline AI capabilities when network connectivity is unavailable.
 * All operations run locally on the device without requiring cloud connectivity.
 * 
 * Endpoints:
 * - POST /api/ai/offline/triage - Offline triage assessment
 * - POST /api/ai/offline/diagnosis - Offline differential diagnosis
 * - POST /api/ai/offline/protocol - Retrieve clinical protocols
 * - POST /api/ai/offline/drug-check - Check drug interactions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  performOfflineTriage,
  generateOfflineDiagnosis,
  getClinicalProtocol,
  checkDrugInteractionsOffline,
} from '@/lib/ai-offline-models';
import { getNetworkStatus } from '@/lib/network-utils';
import logger from '@/lib/logger';

interface OfflineTriageRequest {
  chiefComplaint: string;
  vitalSigns?: Record<string, number>;
  age: number;
  gender: string;
  isPregnant?: boolean;
  symptoms?: string[];
}

interface OfflineDiagnosisRequest {
  symptoms: string[];
  age: number;
  gender: string;
  vitalSigns?: Record<string, number>;
  duration?: number;
}

interface OfflineProtocolRequest {
  protocolName: string;
}

interface OfflineDrugCheckRequest {
  medications: string[];
  allergies?: string[];
  conditions?: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { action, ...params } = body;
    
    if (!action) {
      return NextResponse.json(
        { error: 'Action parameter is required', validActions: ['triage', 'diagnosis', 'protocol', 'drug-check'] },
        { status: 400 }
      );
    }
    
    let result: any;
    
    switch (action) {
      case 'triage': {
        const triageParams = params as OfflineTriageRequest;
        if (!triageParams.chiefComplaint || !triageParams.age) {
          return NextResponse.json(
            { error: 'chiefComplaint and age are required for triage' },
            { status: 400 }
          );
        }
        result = performOfflineTriage(triageParams);
        break;
      }
      
      case 'diagnosis': {
        const diagnosisParams = params as OfflineDiagnosisRequest;
        if (!diagnosisParams.symptoms || !diagnosisParams.age) {
          return NextResponse.json(
            { error: 'symptoms and age are required for diagnosis' },
            { status: 400 }
          );
        }
        result = generateOfflineDiagnosis(diagnosisParams);
        break;
      }
      
      case 'protocol': {
        const protocolParams = params as OfflineProtocolRequest;
        if (!protocolParams.protocolName) {
          return NextResponse.json(
            { error: 'protocolName is required' },
            { status: 400 }
          );
        }
        result = getClinicalProtocol(protocolParams.protocolName);
        break;
      }
      
      case 'drug-check': {
        const drugCheckParams = params as OfflineDrugCheckRequest;
        if (!drugCheckParams.medications) {
          return NextResponse.json(
            { error: 'medications array is required' },
            { status: 400 }
          );
        }
        result = checkDrugInteractionsOffline(drugCheckParams);
        break;
      }
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}`, validActions: ['triage', 'diagnosis', 'protocol', 'drug-check'] },
          { status: 400 }
        );
    }
    
    const latencyMs = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      offline: true,
      latencyMs,
      action,
      result,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('[Offline AI] Error processing request', { error });
    
    return NextResponse.json(
      { 
        error: 'Failed to process offline AI request',
        offline: true,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const networkStatus = getNetworkStatus();
  
  return NextResponse.json({
    service: 'AfyaHero Offline AI',
    version: '1.0.0',
    status: 'operational',
    networkStatus,
    capabilities: [
      {
        action: 'triage',
        description: 'Offline triage assessment using WHO ETAT guidelines',
        requiredParams: ['chiefComplaint', 'age'],
        optionalParams: ['vitalSigns', 'gender', 'isPregnant', 'symptoms'],
      },
      {
        action: 'diagnosis',
        description: 'Offline differential diagnosis using Bayesian inference',
        requiredParams: ['symptoms', 'age'],
        optionalParams: ['gender', 'vitalSigns', 'duration'],
      },
      {
        action: 'protocol',
        description: 'Retrieve clinical protocols (Kenya MOH/WHO guidelines)',
        requiredParams: ['protocolName'],
        availableProtocols: ['malaria_management', 'pneumonia_management', 'hypertensive_emergency'],
      },
      {
        action: 'drug-check',
        description: 'Check drug interactions offline',
        requiredParams: ['medications'],
        optionalParams: ['allergies', 'conditions'],
      },
    ],
    performance: {
      averageLatencyMs: '< 100ms',
      runsOffline: true,
      requiresCloudConnectivity: false,
    },
  });
}