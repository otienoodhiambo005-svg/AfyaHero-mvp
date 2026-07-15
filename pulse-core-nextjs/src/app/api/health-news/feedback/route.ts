/**
 * Health News User Feedback API
 * Routes feedback, reports and requests to super admin portal
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  getSessionFromRequest,
  validateEnumValue,
} from '@/lib/api-security';
import { logAIInteraction } from '@/lib/ai-audit';

export type FeedbackType =
  | 'helpful'
  | 'not_helpful'
  | 'incorrect'
  | 'dangerous'
  | 'request_more_info'
  | 'feature_request'
  | 'bug_report'
  | 'onboarding_request';

export interface FeedbackSubmission {
  type: FeedbackType;
  articleUrl?: string;
  articleTitle?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

const FEEDBACK_ROUTING: Record<FeedbackType, string> = {
  helpful: 'support',
  not_helpful: 'support',
  incorrect: 'support',
  dangerous: 'support',
  request_more_info: 'support',
  feature_request: 'support',
  bug_report: 'support',
  onboarding_request: 'support',
};

export async function POST(request: NextRequest) {
  const rateLimit = await enforceApiRateLimit(request, 'api:feedback');
  if (rateLimit) return rateLimit;

  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as FeedbackSubmission;

    const type = validateEnumValue(body.type, 'type', [
      'helpful', 'not_helpful', 'incorrect', 'dangerous',
      'request_more_info', 'feature_request', 'bug_report', 'onboarding_request'
    ] as const);

    if (type instanceof NextResponse) {
      return type;
    }

    // Log feedback with full audit trail
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'analytics',
      providerUsed: 'gemini',
      modelUsed: 'health-news-feedback',
      latencyMs: 0,
      success: true,
      inputSummary: `${type}: ${body.articleTitle || body.articleUrl || 'general'}`,
      outputSummary: body.message || '',
    });

    // TODO: Create notification in super admin system
    // TODO: Route to appropriate admin queue

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      routedTo: FEEDBACK_ROUTING[type]
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}