import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { DetectionService } from './detection.service';
import { DetectionResult, NetworkFlow, ThreatFeedEvent } from '@netsentry/shared';

@Injectable()
export class RedisConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisConsumerService.name);
  private redisClient!: Redis;
  private isRunning = false;
  private readonly streamKey = 'netsentry:detections';
  private readonly groupName = 'netsentry-api-group';
  private readonly consumerName = `api-consumer-${process.pid}`;
  private readonly dlqKey = 'netsentry:detections:dlq';
  private readonly retryMap = new Map<string, number>();
  private readonly maxRetries = 3;

  constructor(private readonly detectionService: DetectionService) {}

  async onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6380', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    this.logger.log(`Connecting to Redis stream at ${host}:${port}...`);
    this.redisClient = new Redis({
      host,
      port,
      password,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis client connected successfully.');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    await this.setupConsumerGroup();
    this.startConsumerLoop();
  }

  async onModuleDestroy() {
    this.isRunning = false;
    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger.log('Redis client disconnected.');
    }
  }

  private async setupConsumerGroup() {
    try {
      await this.redisClient.xgroup('CREATE', this.streamKey, this.groupName, '0', 'MKSTREAM');
      this.logger.log(`Consumer group '${this.groupName}' created on stream '${this.streamKey}'.`);
    } catch (err: any) {
      if (err.message && err.message.includes('BUSYGROUP')) {
        this.logger.log(`Consumer group '${this.groupName}' already exists.`);
      } else {
        this.logger.warn(`Failed to create consumer group: ${err.message}`);
      }
    }
  }

  private async startConsumerLoop() {
    this.isRunning = true;
    this.logger.log(`Starting Redis stream consumer loop on '${this.streamKey}' as '${this.consumerName}'...`);

    while (this.isRunning) {
      try {
        const response: any = await this.redisClient.xreadgroup(
          'GROUP',
          this.groupName,
          this.consumerName,
          'COUNT',
          10,
          'BLOCK',
          2000,
          'STREAMS',
          this.streamKey,
          '>',
        );

        if (!response || response.length === 0) {
          continue;
        }

        for (const [stream, messages] of response) {
          for (const [messageId, fieldList] of messages) {
            await this.handleMessage(messageId, fieldList);
          }
        }
      } catch (err: any) {
        if (!this.isRunning) break;
        this.logger.error(`Error in consumer loop: ${err.message}`);
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  private async handleMessage(messageId: string, fieldList: string[]) {
    try {
      const fields: Record<string, string> = {};
      for (let i = 0; i < fieldList.length; i += 2) {
        fields[fieldList[i]] = fieldList[i + 1];
      }

      if (!fields.payload) {
        throw new Error(`Message ${messageId} missing 'payload' field`);
      }

      const detection: DetectionResult = JSON.parse(fields.payload);
      const flow: NetworkFlow | undefined = fields.flow ? JSON.parse(fields.flow) : undefined;
      const event: ThreatFeedEvent | undefined = fields.event ? JSON.parse(fields.event) : undefined;

      await this.detectionService.processDetection(detection, flow, event);

      // Acknowledge processed message
      await this.redisClient.xack(this.streamKey, this.groupName, messageId);
      this.retryMap.delete(messageId);
    } catch (err: any) {
      const currentRetries = (this.retryMap.get(messageId) || 0) + 1;
      this.retryMap.set(messageId, currentRetries);
      this.logger.error(`Failed to process message ${messageId} (Attempt ${currentRetries}): ${err.message}`);

      if (currentRetries >= this.maxRetries) {
        this.logger.warn(`Message ${messageId} exceeded max retries. Moving to DLQ.`);
        await this.redisClient.xadd(
          this.dlqKey,
          '*',
          'originalId',
          messageId,
          'error',
          err.message,
          'timestamp',
          new Date().toISOString(),
        );
        await this.redisClient.xack(this.streamKey, this.groupName, messageId);
        this.retryMap.delete(messageId);
      }
    }
  }
}
