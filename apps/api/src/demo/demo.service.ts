import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async resetDemoState(actorId?: string) {
    this.logger.warn(`Demo state reset requested by actor: ${actorId || 'unknown'}`);

    // Execute transactional cleanup of transient telemetry while preserving Users, Roles, and AuditLogs
    await this.prisma.$transaction([
      this.prisma.incidentNote.deleteMany({}),
      this.prisma.threatIndicator.deleteMany({}),
      this.prisma.incident.deleteMany({}),
      this.prisma.detection.deleteMany({}),
      this.prisma.networkEvent.deleteMany({}),
      this.prisma.flow.deleteMany({}),
    ]);

    await this.auditService.createLog({
      userId: actorId,
      action: 'DEMO_RESET',
      targetResource: 'SystemTelemetry',
      details: {
        timestamp: new Date().toISOString(),
        tablesCleaned: ['Flow', 'Detection', 'Incident', 'IncidentNote', 'ThreatIndicator', 'NetworkEvent'],
      },
    });

    return {
      status: 'RESET_SUCCESS',
      message: 'Demo state successfully purged. User accounts and audit trail preserved.',
      resetAt: new Date().toISOString(),
    };
  }
}
