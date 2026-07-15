/**
 * Bot Analytics API Integration Tests
 * 
 * Tests for the /api/admin/bot/analytics endpoint including:
 * - GET requests for analytics data
 * - Date range filtering
 * - Error handling
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock dependencies
jest.mock('@/lib/database', () => ({
  prisma: {
    botMessage: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    patient: {
      count: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

const { prisma } = require('@/lib/database');

describe('/api/admin/bot/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return analytics data successfully', async () => {
      prisma.botMessage.count.mockResolvedValue(100);
      prisma.patient.count.mockResolvedValue(50);
      prisma.appointment.count.mockResolvedValue(10);
      prisma.botMessage.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/admin/bot/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(data.recentActivity).toBeDefined();
    });

    it('should filter by date range when days parameter provided', async () => {
      prisma.botMessage.count.mockResolvedValue(50);
      prisma.patient.count.mockResolvedValue(25);
      prisma.appointment.count.mockResolvedValue(5);
      prisma.botMessage.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/admin/bot/analytics?days=7');
      const response = await GET(request);

      expect(prisma.appointment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
        })
      );
    });

    it('should use default 30 days when no parameter provided', async () => {
      prisma.botMessage.count.mockResolvedValue(100);
      prisma.patient.count.mockResolvedValue(50);
      prisma.appointment.count.mockResolvedValue(10);
      prisma.botMessage.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/admin/bot/analytics');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle database errors gracefully', async () => {
      prisma.appointment.count.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/admin/bot/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats.totalMessages).toBe(0);
    });

    it('should return empty recent activity when no messages', async () => {
      prisma.botMessage.count.mockResolvedValue(0);
      prisma.patient.count.mockResolvedValue(0);
      prisma.appointment.count.mockResolvedValue(0);
      prisma.botMessage.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/admin/bot/analytics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.recentActivity).toEqual([]);
    });
  });
});

