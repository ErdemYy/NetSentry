import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentStatus } from '@prisma/client';

export interface IncidentQueryDto {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
}

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getIncidents(query: IncidentQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.severity) {
      where.severity = query.severity;
    }

    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          detection: {
            include: {
              flow: true,
            },
          },
          notes: {
            take: 3,
            orderBy: { createdAt: 'desc' },
          },
          threatIndicators: true,
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getIncidentById(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        detection: {
          include: {
            flow: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        threatIndicators: true,
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID '${id}' not found`);
    }

    return incident;
  }

  async updateStatus(id: string, status: string) {
    const validStatuses = ['NEW', 'INVESTIGATING', 'CONFIRMED_THREAT', 'FALSE_POSITIVE', 'RESOLVED'];
    const upperStatus = status.toUpperCase();
    if (!validStatuses.includes(upperStatus)) {
      throw new BadRequestException(`Invalid incident status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
    }

    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incident with ID '${id}' not found`);
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: upperStatus as IncidentStatus,
        updatedAt: new Date(),
      },
    });
  }
}
