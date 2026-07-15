/**
 * Settings API Integration Tests
 * 
 * Tests for the /api/settings endpoint including:
 * - GET requests for retrieving settings
 * - POST requests for saving settings
 * - Authentication and authorization
 * - Error handling
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
jest.mock('@/lib/api-security', () => ({
  enforceApiGuard: jest.fn(),
  readJsonBody: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  prisma: {
    userSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  error: jest.fn(),
}));

const { enforceApiGuard, readJsonBody } = require('@/lib/api-security');
const { prisma } = require('@/lib/database');

describe('/api/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 if not authenticated', async () => {
      enforceApiGuard.mockResolvedValue({
        response: new Response('Unauthorized', { status: 401 }),
        session: null,
      });

      const request = new NextRequest('http://localhost:3000/api/settings?role=doctor');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 if role parameter is missing', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      const request = new NextRequest('http://localhost:3000/api/settings');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('role');
    });

    it('should return 400 if role is invalid', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      const request = new NextRequest('http://localhost:3000/api/settings?role=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid role');
    });

    it('should return empty settings if not found', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      prisma.userSettings.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/settings?role=doctor');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.settings).toEqual({});
    });

    it('should return settings if found', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      const mockSettings = { notifications: { email: true } };
      prisma.userSettings.findUnique.mockResolvedValue({
        settings: mockSettings,
      });

      const request = new NextRequest('http://localhost:3000/api/settings?role=doctor');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.settings).toEqual(mockSettings);
      expect(prisma.userSettings.findUnique).toHaveBeenCalledWith({
        where: {
          profileId_role: {
            profileId: 'user-1',
            role: 'doctor',
          },
        },
      });
    });

    it('should handle database errors', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      prisma.userSettings.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/settings?role=doctor');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to retrieve settings');
    });
  });

  describe('POST', () => {
    it('should return 401 if not authenticated', async () => {
      enforceApiGuard.mockResolvedValue({
        response: new Response('Unauthorized', { status: 401 }),
        session: null,
      });

      const request = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        body: JSON.stringify({ role: 'doctor', settings: {} }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 if role parameter is missing', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      readJsonBody.mockResolvedValue({ settings: {} });

      const request = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        body: JSON.stringify({ settings: {} }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('role');
    });

    it('should return 400 if settings parameter is missing', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      readJsonBody.mockResolvedValue({ role: 'doctor' });

      const request = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        body: JSON.stringify({ role: 'doctor' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('settings');
    });

    it('should create new settings if not found', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical', hospitalId: 'hospital-1' },
      });

      readJsonBody.mockResolvedValue({ role: 'doctor', settings: { notifications: { email: true } } });
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.userSettings.create.mockResolvedValue({
        settings: { notifications: { email: true } },
      });

      const request = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        body: JSON.stringify({ role: 'doctor', settings: { notifications: { email: true } } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.userSettings.create).toHaveBeenCalledWith({
        data: {
          profileId: 'user-1',
          role: 'doctor',
          settings: { notifications: { email: true } },
          hospitalId: 'hospital-1',
        },
      });
    });

    it('should update existing settings if found', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical', hospitalId: 'hospital-1' },
      });

      readJsonBody.mockResolvedValue({ role: 'doctor', settings: { notifications: { email: false } } });
      prisma.userSettings.findUnique.mockResolvedValue({
        id: 'settings-1',
        settings: { notifications: { email: true } },
      });
      prisma.userSettings.update.mockResolvedValue({
        settings: { notifications: { email: false } },
      });

      const request = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        body: JSON.stringify({ role: 'doctor', settings: { notifications: { email: false } } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.userSettings.update).toHaveBeenCalledWith({
        where: {
          profileId_role: {
            profileId: 'user-1',
            role: 'doctor',
          },
        },
        data: {
          settings: { notifications: { email: false } },
          hospitalId: 'hospital-1',
        },
      });
    });

    it('should handle database errors', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      readJsonBody.mockResolvedValue({ role: 'doctor', settings: {} });
      prisma.userSettings.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        body: JSON.stringify({ role: 'doctor', settings: {} }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to save settings');
    });

    it('should handle invalid JSON body', async () => {
      enforceApiGuard.mockResolvedValue({
        response: null,
        session: { id: 'user-1', email: 'test@example.com', role: 'medical' },
      });

      readJsonBody.mockResolvedValue(new Response('Invalid JSON', { status: 400 }));

      const request = new NextRequest('http://localhost:3000/api/settings', {
        method: 'POST',
        body: 'invalid json',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
