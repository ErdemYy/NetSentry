import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ThreatQueryDto {
  page?: number;
  limit?: number;
  severity?: string;
  attackCategory?: string;
  verdict?: string;
  isAnomalous?: boolean;
}

@Injectable()
export class ThreatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getThreats(query: ThreatQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.attackCategory) {
      where.attackCategory = query.attackCategory;
    }
    if (query.verdict) {
      where.verdict = query.verdict;
    }
    if (typeof query.isAnomalous === 'boolean') {
      where.isAnomalous = query.isAnomalous;
    } else if (typeof query.isAnomalous === 'string') {
      where.isAnomalous = query.isAnomalous === 'true';
    }

    const [items, total] = await Promise.all([
      this.prisma.detection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          flow: true,
          incident: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.detection.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getThreatById(id: string) {
    const detection = await this.prisma.detection.findFirst({
      where: {
        OR: [{ id }, { flowId: id }],
      },
      include: {
        flow: true,
        incident: {
          include: {
            notes: true,
            threatIndicators: true,
          },
        },
      },
    });

    if (!detection) {
      throw new NotFoundException(`Detection with identifier '${id}' not found`);
    }

    return detection;
  }
}
