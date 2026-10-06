import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    PrismaModule,
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
})
export class AppModule {}
