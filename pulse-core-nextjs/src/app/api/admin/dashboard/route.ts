import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { withAuthzAndTenant, AuthzContext } from '@/lib/middleware/withAuthzAndTenant';

interface WardRow {
  name: string;
  total: number;
  occupied: number;
  doctor: string;
}

interface Alert {
  id: number;
  type: 'warning' | 'info' | 'success' | 'error';
  message: string;
  time: string;
}

interface DashboardData {
  wards: WardRow[];
  alerts: Alert[];
  stats: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number;
    totalStaff: number;
    activeStaff: number;
  };
  metrics: {
    todayAdmissions: number;
    todayDischarges: number;
    emergencyVisits: number;
    pendingLabs: number;
  };
}

export const GET = withAuthzAndTenant(async (
  request: NextRequest,
  { hospitalId }: AuthzContext
) => {
  try {
    // Get bed occupancy data
    const beds = await prisma.hospitalBed.findMany({
      where: { hospitalId },
    });

    // Group beds by ward
    const wardMap = new Map<string, { total: number; occupied: number; doctor: string }>();
    
    beds.forEach((bed) => {
      const wardName = bed.wardName || 'Unassigned';
      const existing = wardMap.get(wardName) || { total: 0, occupied: 0, doctor: 'Unassigned' };
      existing.total++;
      if (bed.status === 'occupied') {
        existing.occupied++;
      }
      wardMap.set(wardName, existing);
    });

    const wards: WardRow[] = Array.from(wardMap.entries()).map(([name, data], index) => ({
      name,
      total: data.total,
      occupied: data.occupied,
      doctor: data.doctor,
    }));

    // Calculate stats
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter((b) => b.status === 'occupied').length;
    const availableBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Get staff counts
    const [totalStaff, activeStaff] = await Promise.all([
      prisma.profile.count({ where: { hospitalId } }),
      prisma.profile.count({ where: { hospitalId, status: 'active' } }),
    ]);

    // Get today's metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayAdmissions, todayDischarges, emergencyVisits, pendingLabs] = await Promise.all([
      prisma.appointment.count({
        where: {
          hospitalId,
          status: 'admitted',
          scheduledAt: { gte: today },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          status: 'completed',
          scheduledAt: { gte: today },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          type: 'emergency',
          scheduledAt: { gte: today },
        },
      }),
      prisma.labRequest.count({
        where: {
          hospitalId,
          status: { in: ['pending', 'in_progress'] },
        },
      }),
    ]);

    // Generate alerts based on data
    const alerts: Alert[] = [];
    
    if (occupancyRate >= 95) {
      alerts.push({
        id: 1,
        type: 'warning',
        message: `Critical bed occupancy at ${occupancyRate}%. Consider patient transfers.`,
        time: new Date().toISOString(),
      });
    } else if (occupancyRate >= 85) {
      alerts.push({
        id: 1,
        type: 'info',
        message: `High bed occupancy at ${occupancyRate}%. Monitor capacity closely.`,
        time: new Date().toISOString(),
      });
    }

    if (pendingLabs > 20) {
      alerts.push({
        id: 2,
        type: 'warning',
        message: `${pendingLabs} pending lab requests. Review turnaround times.`,
        time: new Date().toISOString(),
      });
    }

    if (availableBeds > 50 && occupancyRate < 50) {
      alerts.push({
        id: 3,
        type: 'success',
        message: `Good bed availability: ${availableBeds} beds free (${100 - occupancyRate}% available).`,
        time: new Date().toISOString(),
      });
    }

    // Default welcome alert
    if (alerts.length === 0) {
      alerts.push({
        id: 1,
        type: 'info',
        message: 'All systems operational. No critical alerts at this time.',
        time: new Date().toISOString(),
      });
    }

    const dashboardData: DashboardData = {
      wards,
      alerts,
      stats: {
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate,
        totalStaff,
        activeStaff,
      },
      metrics: {
        todayAdmissions,
        todayDischarges,
        emergencyVisits,
        pendingLabs,
      },
    };

    logger.info('Admin dashboard data retrieved', { hospitalId, occupancyRate });

    return NextResponse.json(dashboardData);
  } catch (error) {
    logger.error('Admin dashboard error', { error, hospitalId });
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}, ['admin']);
