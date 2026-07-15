/**
 * Profile Picture Upload API
 * Handles profile image uploads for staff profiles
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';
import { enforceApiGuard } from '@/lib/api-security';

// Max file size 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:upload:profile',
      roles: ['reception', 'medical', 'lab', 'pharmacy', 'admin'],
    });
    if (guard.response) return guard.response;
    const session = guard.session;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE * 2) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 2MB allowed' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG and WebP allowed' }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Update profile
    await prisma.profile.update({
      where: { id: session.id },
      data: {
        avatarUrl: dataUrl,
      },
    });

    logger.info('Profile picture uploaded successfully', { userId: session.id });

    return NextResponse.json({
      success: true,
      avatarUrl: dataUrl,
      message: 'Profile picture updated successfully',
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Profile upload error', { error: err.message });
    Sentry.captureException(err, { tags: { endpoint: '/api/upload/profile', method: 'POST' } });

    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * bodyParser: false is automatically applied in App Router for formData()
 * Old pages router config removed for Next.js 14 compatibility
 */


