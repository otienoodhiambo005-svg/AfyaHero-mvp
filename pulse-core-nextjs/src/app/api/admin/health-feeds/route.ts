/**
 * Health News Feed Sources API — Prisma-backed
 * GET /api/admin/health-feeds — List all feed sources
 * POST /api/admin/health-feeds — Create feed source
 * PATCH /api/admin/health-feeds — Update feed source
 * DELETE /api/admin/health-feeds?id=xxx — Delete feed source
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import {
  enforceApiRateLimit,
  getSessionFromRequest,
  readJsonBody,
  requireString,
  validateNumber,
  validateStringArray,
  validateUrl,
} from '@/lib/api-security';
import logger from '@/lib/logger';

type FeedRole = 'all' | 'reception' | 'medical' | 'lab' | 'pharmacy' | 'admin';
const ALLOWED_ROLES = new Set<FeedRole>(['all', 'reception', 'medical', 'lab', 'pharmacy', 'admin']);

function getAdminSession(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== 'admin') return null;
  return session;
}

function parseRole(input: unknown): FeedRole {
  if (typeof input !== 'string') return 'all';
  const value = input.trim().toLowerCase() as FeedRole;
  return ALLOWED_ROLES.has(value) ? value : 'all';
}

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:admin:health-feeds');
  if (rateLimit) return rateLimit;
  if (!getAdminSession(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const items = await prisma.healthNewsFeedSource.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ items });
  } catch (error) {
    logger.error('Health feeds GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch feed sources.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:admin:health-feeds');
  if (rateLimit) return rateLimit;
  if (!getAdminSession(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await readJsonBody<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;

  const name = requireString(body.name, 'name', { min: 2, max: 160 });
  if (name instanceof NextResponse) return name;
  const url = validateUrl(body.url, 'url');
  if (url instanceof NextResponse) return url;

  const regionCodes = body.region_codes === undefined
    ? []
    : validateStringArray(body.region_codes, 'region_codes', { maxItems: 20, itemMaxLength: 10, normalize: (item: string) => item.toUpperCase() });
  if (regionCodes instanceof NextResponse) return regionCodes;

  const priority = body.priority === undefined
    ? 70
    : validateNumber(body.priority, 'priority', { min: 1, max: 100, integer: true });
  if (priority instanceof NextResponse) return priority;

  try {
    const item = await prisma.healthNewsFeedSource.create({
      data: {
        name,
        url,
        role: parseRole(body.role),
        regionCodes,
        priority,
        enabled: body.enabled !== false,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    logger.error('Health feeds POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to create feed source.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:admin:health-feeds');
  if (rateLimit) return rateLimit;
  if (!getAdminSession(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await readJsonBody<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;

  const id = requireString(body.id, 'id', { min: 2, max: 120 });
  if (id instanceof NextResponse) return id;

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') {
    const name = requireString(body.name, 'name', { min: 2, max: 160 });
    if (name instanceof NextResponse) return name;
    updates.name = name;
  }
  if (typeof body.url === 'string') {
    const url = validateUrl(body.url, 'url');
    if (url instanceof NextResponse) return url;
    updates.url = url;
  }
  if (body.role !== undefined) updates.role = parseRole(body.role);
  if (body.priority !== undefined) {
    const priority = validateNumber(body.priority, 'priority', { min: 1, max: 100, integer: true });
    if (priority instanceof NextResponse) return priority;
    updates.priority = priority;
  }
  if (body.region_codes !== undefined) {
    const regionCodes = validateStringArray(body.region_codes, 'region_codes', {
      maxItems: 20, itemMaxLength: 10, normalize: (item: string) => item.toUpperCase(),
    });
    if (regionCodes instanceof NextResponse) return regionCodes;
    updates.regionCodes = regionCodes;
  }
  if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No update fields provided.' }, { status: 400 });
  }

  try {
    const item = await prisma.healthNewsFeedSource.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json({ item });
  } catch (error) {
    logger.error('Health feeds PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update feed source.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:admin:health-feeds');
  if (rateLimit) return rateLimit;
  if (!getAdminSession(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = requireString(searchParams.get('id'), 'id', { min: 2, max: 120 });
  if (id instanceof NextResponse) return id;

  try {
    await prisma.healthNewsFeedSource.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Health feeds DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to delete feed source.' }, { status: 500 });
  }
}
