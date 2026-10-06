import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [HealthModule, EventsModule],
})
export class AppModule {}
