import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Controller(['health', 'api/v1/health'])
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    return this.runHealthChecks();
  }

  @Get('detailed')
  async checkDetailedHealth() {
    return this.runHealthChecks();
  }

  private async runHealthChecks() {
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

    let mlConnected = false;
    try {
      const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(`${mlUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data: any = await resp.json();
        mlConnected = data.models_ready ?? true;
      }
    } catch {
      mlConnected = false;
    }

    const isHealthy = postgresConnected && redisConnected;

    return {
      status: isHealthy ? 'ok' : 'degraded',
      service: 'NetSentry Core API',
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
      ml: {
        connected: mlConnected,
      },
    };
  }
}
