import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { DetectionModule } from './detection/detection.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ThreatsModule } from './threats/threats.module';
import { IncidentsModule } from './incidents/incidents.module';
import { NetworkModule } from './network/network.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ModelsModule } from './models/models.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ThreatIntelModule } from './threat-intel/threat-intel.module';
import { DemoModule } from './demo/demo.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 300, // 300 requests per minute per IP for general endpoints
      },
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    ThreatIntelModule,
    DemoModule,
    HealthModule,
    EventsModule,
    DetectionModule,
    DashboardModule,
    ThreatsModule,
    IncidentsModule,
    NetworkModule,
    AnalyticsModule,
    ModelsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
