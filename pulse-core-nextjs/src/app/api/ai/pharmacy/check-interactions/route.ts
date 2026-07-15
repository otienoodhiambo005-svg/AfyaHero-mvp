import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import { checkDrugInteractions } from '@/lib/predictive-risk-models';
import logger from '@/lib/logger';

interface CheckInteractionsBody {
  drugs?: string[];
  allergies?: string[];
  conditions?: string[];
}

function normalizeSeverity(
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated',
): 'low' | 'medium' | 'high' {
  if (severity === 'minor') return 'low';
  if (severity === 'moderate') return 'medium';
  return 'high';
}

export async function POST(req: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(req);
    if (firewall) return firewall;

    const trustedOrigin = enforceTrustedOrigin(req);
    if (trustedOrigin) return trustedOrigin;

    const limited = await enforceApiRateLimit(req, 'api:ai:pharmacy:check-interactions');
    if (limited) return limited;

    const auth = requireRoles(req, ['pharmacy', 'admin', 'medical', 'super_admin']);
    if (auth instanceof NextResponse) return auth;

    const body = await readJsonBody<CheckInteractionsBody>(req);
    if (body instanceof NextResponse) return body;

    const drugs = Array.isArray(body.drugs)
      ? body.drugs.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
      : [];
    if (drugs.length < 2) {
      return NextResponse.json({ interactions: [], requiresReview: false, safetyNotes: [] }, { status: 200 });
    }

    const result = checkDrugInteractions({
      medications: drugs,
      allergies: Array.isArray(body.allergies) ? body.allergies : [],
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
    });

    const interactions = result.interactions.map((interaction) => ({
      drug_a: interaction.drug1,
      drug_b: interaction.drug2,
      severity: normalizeSeverity(interaction.severity),
      summary: interaction.description,
      confidence: interaction.severity === 'contraindicated' ? 0.98 : interaction.severity === 'major' ? 0.93 : 0.86,
      recommendation: interaction.recommendation,
    }));

    const safetyNotes = result.allergies.map((allergy) => ({
      drug: allergy.drug,
      reaction: allergy.reaction,
      severity: allergy.severity,
    }));

    return NextResponse.json(
      {
        interactions,
        safetyNotes,
        requiresReview: result.requiresReview,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('Failed to check pharmacy interactions', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to check interactions' }, { status: 500 });
  }
}

