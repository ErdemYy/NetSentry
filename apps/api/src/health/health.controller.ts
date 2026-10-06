import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    let postgresConnected = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      postgresConnected = true;
    } catch {
      postgresConnected = false;
    }

    let redisConnected = false;
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6380', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 1000,
        lazyConnect: true,
      });
      await redis.connect();
      const pingRes = await redis.ping();
      redisConnected = pingRes === 'PONG';
      await redis.quit();
    } catch {
      redisConnected = false;
    }

    const isHealthy = postgresConnected && redisConnected;

    return {
      status: isHealthy ? 'ok' : 'degraded',
      service: 'NetSentry Core API',
      phase: 'PHASE_2_REALTIME_INFERENCE',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        connected: postgresConnected,
        provider: 'PostgreSQL',
      },
      redis: {
        connected: redisConnected,
        port: parseInt(process.env.REDIS_PORT || '6380', 10),
      },
    };
  }
}
