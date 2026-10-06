import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { DetectionModule } from './detection/detection.module';

@Module({
  imports: [PrismaModule, HealthModule, EventsModule, DetectionModule],
})
export class AppModule {}
