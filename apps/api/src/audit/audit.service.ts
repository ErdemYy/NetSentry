import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogDto {
  userId?: string;
  action: string;
  targetResource: string;
  targetId?: string;
  ipAddress?: string;
  details?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createLog(dto: CreateAuditLogDto) {
    try {
      const record = await this.prisma.auditLog.create({
        data: {
          userId: dto.userId || null,
          action: dto.action,
          targetResource: dto.targetResource,
          targetId: dto.targetId || null,
          ipAddress: dto.ipAddress || null,
          details: dto.details ? (dto.details as any) : undefined,
        },
      });
      this.logger.log(`[AUDIT] Action: ${dto.action} on ${dto.targetResource} by User: ${dto.userId || 'anonymous'}`);
      return record;
    } catch (err: any) {
      this.logger.error(`Failed to create audit log: ${err.message}`);
      return null;
    }
  }

  async getLogs(filter?: { action?: string; limit?: number; offset?: number }) {
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;
    const where: any = {};

    if (filter?.action) {
      where.action = filter.action;
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      }),
    ]);

    return { total, limit, offset, logs };
  }
}
