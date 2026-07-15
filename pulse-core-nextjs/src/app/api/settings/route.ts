import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const VALID_ROLES = ['doctor', 'pharmacy', 'laboratory', 'admin', 'superadmin', 'reception'] as const;

interface SettingsPayload {
  role?: string;
  settings?: Record<string, any>;
}

async function enforceAuthContext(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:settings',
    requireAuth: true,
  });
  if (guard.response) {
    return { response: guard.response, session: null };
  }
  if (!guard.session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
  }
  return { response: null, session: guard.session };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await enforceAuthContext(request);
    if (ctx.response) return ctx.response;
    const session = ctx.session!;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    if (!role) {
      return NextResponse.json({ error: 'Missing required parameter: role' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return NextResponse.json({ error: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    const userSettings = await prisma.userSettings.findUnique({
      where: {
        profileId_role: {
          profileId: session.id,
          role,
        },
      },
    });

    if (!userSettings) {
      return NextResponse.json({ settings: {} });
    }

    return NextResponse.json({ settings: userSettings.settings });
  } catch (error) {
    logger.error('[settings] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await enforceAuthContext(request);
    if (ctx.response) return ctx.response;
    const session = ctx.session!;

    const body = await readJsonBody<SettingsPayload>(request);
    if (body instanceof NextResponse) return body;
    const { role, settings } = body;

    if (!role) {
      return NextResponse.json({ error: 'Missing required field: role' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return NextResponse.json({ error: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid field: settings' }, { status: 400 });
    }

    const existingSettings = await prisma.userSettings.findUnique({
      where: {
        profileId_role: {
          profileId: session.id,
          role,
        },
      },
    });

    if (existingSettings) {
      const updatedSettings = await prisma.userSettings.update({
        where: {
          profileId_role: {
            profileId: session.id,
            role,
          },
        },
        data: {
          settings,
          hospitalId: session.hospitalId,
        },
      });
      return NextResponse.json({ success: true, settings: updatedSettings.settings });
    } else {
      const newSettings = await prisma.userSettings.create({
        data: {
          profileId: session.id,
          role,
          settings,
          hospitalId: session.hospitalId,
        },
      });
      return NextResponse.json({ success: true, settings: newSettings.settings });
    }
  } catch (error) {
    logger.error('[settings] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
