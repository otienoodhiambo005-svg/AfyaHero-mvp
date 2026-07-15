/**
 * Bot Analytics API Route
 * Provides analytics data for WhatsApp and USSD bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Get date range from query params (default to last 30 days)
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // NOTE: Bot messaging models not yet implemented in schema.
    // Returning placeholder data until bot message tracking is added.
    // TODO: Add BotMessage model to schema and implement real analytics.

    // Get appointments booked via bot (using metadata field if available)
    const appointmentsBooked = await prisma.appointment.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    }) || 0;

    const stats = {
      totalMessages: 0,
      whatsappMessages: 0,
      ussdSessions: 0,
      activeUsers: 0,
      appointmentsBooked,
      prescriptionsViewed: 0,
      labResultsViewed: 0,
    };

    logger.info('[Bot Analytics] Analytics retrieved (placeholder)', {
      stats,
      note: 'BotMessage model not yet implemented in schema',
    });

    return NextResponse.json({
      stats,
      recentActivity: [],
    });
  } catch (error) {
    logger.error('[Bot Analytics] Error retrieving analytics', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Return default stats on error
    return NextResponse.json({
      stats: {
        totalMessages: 0,
        whatsappMessages: 0,
        ussdSessions: 0,
        activeUsers: 0,
        appointmentsBooked: 0,
        prescriptionsViewed: 0,
        labResultsViewed: 0,
      },
      recentActivity: [],
    });
  }
}
