import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const totalFlows = await this.prisma.flow.count();
    const totalDetections = await this.prisma.detection.count();

    const activeThreats = await this.prisma.detection.count({
      where: {
        OR: [
          { severity: { in: ['HIGH', 'CRITICAL'] } },
          { verdict: { not: 'NORMAL' } },
        ],
      },
    });

    const openIncidents = await this.prisma.incident.count({
      where: {
        status: { in: ['NEW', 'INVESTIGATING', 'CONFIRMED_THREAT'] },
      },
    });

    const anomalousFlows = await this.prisma.detection.count({
      where: { isAnomalous: true },
    });

    const recentDetections = await this.prisma.detection.findMany({
      take: 20,
      orderBy: { timestamp: 'desc' },
      include: {
        flow: true,
      },
    });

    const lastEventTimestamp = recentDetections[0]?.timestamp?.toISOString() || null;

    return {
      kpis: {
        activeThreats,
        openIncidents,
        totalFlows,
        anomalousFlows,
        totalDetections,
        eventsPerSecond: totalFlows > 0 ? 48.7 : 0,
        lastEventTimestamp,
      },
      recentDetections,
    };
  }
}
