import { Module } from '@nestjs/common';
import { DetectionService } from './detection.service';
import { RedisConsumerService } from './redis-consumer.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [DetectionService, RedisConsumerService],
  exports: [DetectionService, RedisConsumerService],
})
export class DetectionModule {}
