/**
 * Resource Allocation Optimization API
 * 
 * POST /api/admin/resource-allocation
 * 
 * Provides AI-driven resource allocation optimization for:
 * - Staff scheduling and deployment
 * - Bed capacity management
 * - Equipment and supply allocation
 * - Budget optimization recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:admin:resource-allocation');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['admin', 'super_admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    resourceType?: unknown;
    facilityId?: unknown;
    currentAllocation?: unknown;
    demandData?: unknown;
    constraints?: unknown;
    optimizationGoal?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const resourceType = typeof body.resourceType === 'string' ? body.resourceType : 'staff';
  const facilityId = typeof body.facilityId === 'string' ? body.facilityId : session.hospitalId;
  const currentAllocation = body.currentAllocation && typeof body.currentAllocation === 'object' ? body.currentAllocation as Record<string, unknown> : {};
  const demandData = body.demandData && typeof body.demandData === 'object' ? body.demandData as Record<string, unknown> : {};
  const constraints = body.constraints && typeof body.constraints === 'object' ? body.constraints as Record<string, unknown> : {};
  const optimizationGoal = typeof body.optimizationGoal === 'string' ? body.optimizationGoal : 'efficiency';

  try {
    let optimization: Record<string, unknown> = {};
    let prompt = '';
    let systemInstruction = '';

    switch (resourceType) {
      case 'staff':
        prompt = buildStaffOptimizationPrompt(currentAllocation, demandData, constraints, optimizationGoal);
        systemInstruction = buildStaffOptimizationSystemInstruction();
        break;
      case 'beds':
        prompt = buildBedOptimizationPrompt(currentAllocation, demandData, constraints, optimizationGoal);
        systemInstruction = buildBedOptimizationSystemInstruction();
        break;
      case 'equipment':
        prompt = buildEquipmentOptimizationPrompt(currentAllocation, demandData, constraints, optimizationGoal);
        systemInstruction = buildEquipmentOptimizationSystemInstruction();
        break;
      case 'supplies':
        prompt = buildSupplyOptimizationPrompt(currentAllocation, demandData, constraints, optimizationGoal);
        systemInstruction = buildSupplyOptimizationSystemInstruction();
        break;
      default:
        prompt = buildStaffOptimizationPrompt(currentAllocation, demandData, constraints, optimizationGoal);
        systemInstruction = buildStaffOptimizationSystemInstruction();
    }

    const response = await orchestrateAI({
      taskType: 'population_health',
      prompt,
      systemInstruction,
      patientId: undefined,
      clinicianId: session.id,
      facilityId,
      requireConsensus: false,
    });

    if (!response.success || !response.text) {
      return NextResponse.json({ error: 'Failed to generate resource optimization' }, { status: 500 });
    }

    try {
      optimization = JSON.parse(response.text);
    } catch (parseError) {
      optimization = { rawResponse: response.text };
    }

    return NextResponse.json({
      success: true,
      resourceType,
      optimization,
      metadata: {
        facilityId,
        optimizationGoal,
        generatedAt: new Date().toISOString(),
        generatedBy: session.name,
      },
    });
  } catch (error) {
    logger.error('[Resource Allocation] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate resource allocation optimization' }, { status: 500 });
  }
}

function buildStaffOptimizationPrompt(current: Record<string, unknown>, demand: Record<string, unknown>, constraints: Record<string, unknown>, goal: string): string {
  return `Optimize staff allocation for efficiency:

Current Staff Allocation:
${JSON.stringify(current, null, 2)}

Demand Data:
- Patient volume by department: ${JSON.stringify(demand.patientVolume || {}, null, 2)}
- Peak hours: ${demand.peakHours || 'Not specified'}
- Seasonal trends: ${demand.seasonalTrends || 'Not specified'}

Constraints:
- Budget limit: ${constraints.budget || 'Not specified'}
- Minimum staffing requirements: ${JSON.stringify(constraints.minimumStaffing || {}, null, 2)}
- Maximum shift length: ${constraints.maxShiftLength || '8 hours'}

Optimization Goal: ${goal}

Provide:
1. Recommended staff deployment by department and shift
2. Shift schedule optimization
3. Cross-training opportunities
4. Overtime minimization strategies
5. Cost-benefit analysis of changes

Return as JSON with fields: deployment, schedule, crossTraining, overtimeStrategies, costBenefit.`;
}

function buildStaffOptimizationSystemInstruction(): string {
  return `You are a healthcare operations management specialist for East African facilities.
Consider:
- Staff availability and qualifications
- Patient acuity patterns
- Local labor regulations
- Budget constraints
- Staff well-being and burnout prevention
Provide practical, implementable recommendations.`;
}

function buildBedOptimizationPrompt(current: Record<string, unknown>, demand: Record<string, unknown>, constraints: Record<string, unknown>, goal: string): string {
  return `Optimize bed capacity allocation:

Current Bed Allocation:
${JSON.stringify(current, null, 2)}

Demand Data:
- Average length of stay by department: ${JSON.stringify(demand.averageLOS || {}, null, 2)}
- Admission rates: ${JSON.stringify(demand.admissionRates || {}, null, 2)}
- Discharge patterns: ${demand.dischargePatterns || 'Not specified'}

Constraints:
- Total beds available: ${constraints.totalBeds || 'Not specified'}
- Department minimums: ${JSON.stringify(constraints.departmentMinimums || {}, null, 2)}
- ICU bed ratio: ${constraints.icuRatio || '10%'}

Optimization Goal: ${goal}

Provide:
1. Optimal bed distribution by department
2. Overflow bed strategies
3. Discharge acceleration opportunities
4. Bed turnover optimization
5. Capacity expansion recommendations

Return as JSON with fields: bedDistribution, overflowStrategies, dischargeAcceleration, turnoverOptimization, expansionRecommendations.`;
}

function buildBedOptimizationSystemInstruction(): string {
  return `You are a hospital bed management specialist.
Consider:
- Patient flow optimization
- Clinical appropriateness of bed assignments
- Infection control requirements
- Emergency surge capacity needs
- Patient satisfaction and privacy
Provide data-driven bed allocation strategies.`;
}

function buildEquipmentOptimizationPrompt(current: Record<string, unknown>, demand: Record<string, unknown>, constraints: Record<string, unknown>, goal: string): string {
  return `Optimize equipment allocation:

Current Equipment Allocation:
${JSON.stringify(current, null, 2)}

Demand Data:
- Utilization rates: ${JSON.stringify(demand.utilizationRates || {}, null, 2)}
- Downtime patterns: ${demand.downtimePatterns || 'Not specified'}
- Maintenance schedule: ${demand.maintenanceSchedule || 'Not specified'}

Constraints:
- Budget: ${constraints.budget || 'Not specified'}
- Maintenance requirements: ${constraints.maintenance || 'Not specified'}
- Training needs: ${constraints.training || 'Not specified'}

Optimization Goal: ${goal}

Provide:
1. Equipment sharing opportunities
2. Preventive maintenance scheduling
3. Upgrade priority recommendations
4. Cost-saving alternatives
5. Staff training requirements

Return as JSON with fields: sharingOpportunities, maintenanceSchedule, upgradePriorities, costSavingAlternatives, trainingRequirements.`;
}

function buildEquipmentOptimizationSystemInstruction(): string {
  return `You are a healthcare equipment management specialist.
Consider:
- Equipment lifecycle and depreciation
- Maintenance costs vs replacement
- Clinical criticality
- Staff training requirements
- Vendor reliability and support
Provide cost-effective equipment management strategies.`;
}

function buildSupplyOptimizationPrompt(current: Record<string, unknown>, demand: Record<string, unknown>, constraints: Record<string, unknown>, goal: string): string {
  return `Optimize medical supply allocation:

Current Supply Levels:
${JSON.stringify(current, null, 2)}

Demand Data:
- Consumption rates: ${JSON.stringify(demand.consumptionRates || {}, null, 2)}
- Seasonal variations: ${demand.seasonalVariations || 'Not specified'}
- Lead times: ${demand.leadTimes || 'Not specified'}

Constraints:
- Storage capacity: ${constraints.storage || 'Not specified'}
- Budget: ${constraints.budget || 'Not specified'}
- Expiry dates: ${constraints.expiryDates || 'Not specified'}

Optimization Goal: ${goal}

Provide:
1. Optimal reorder points and quantities
2. Stock rotation strategies
3. Expiry date management
4. Emergency stock recommendations
5. Cost optimization strategies

Return as JSON with fields: reorderPoints, stockRotation, expiryManagement, emergencyStock, costOptimization.`;
}

function buildSupplyOptimizationSystemInstruction(): string {
  return `You are a healthcare supply chain management specialist.
Consider:
- Just-in-time vs safety stock strategies
- Bulk purchasing discounts
- Storage limitations
- Expiry date management
- Emergency preparedness
Provide practical supply chain optimization for resource-limited settings.`;
}

/**
 * GET /api/admin/resource-allocation
 * 
 * Returns available resource types and optimization goals
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['admin', 'super_admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    name: 'Resource Allocation Optimization',
    version: '1.0.0',
    description: 'AI-driven resource allocation optimization for healthcare facilities',
    resourceTypes: [
      { type: 'staff', description: 'Staff scheduling and deployment optimization' },
      { type: 'beds', description: 'Bed capacity and utilization optimization' },
      { type: 'equipment', description: 'Medical equipment allocation and management' },
      { type: 'supplies', description: 'Medical supply chain and inventory optimization' },
    ],
    optimizationGoals: [
      { goal: 'efficiency', description: 'Maximize resource utilization' },
      { goal: 'cost', description: 'Minimize operational costs' },
      { goal: 'quality', description: 'Optimize for patient care quality' },
      { goal: 'balance', description: 'Balance efficiency, cost, and quality' },
    ],
  });
}
