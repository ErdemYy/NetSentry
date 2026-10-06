import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AbuseIpDbProvider } from './abuseipdb.provider';
import { ThreatIntelReport } from './threat-intel.interface';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ThreatIntelService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThreatIntelService.name);
  private redisClient!: Redis;
  private readonly cacheTtlSeconds = 86400; // 24 hours
  private readonly errorCacheTtlSeconds = 3600; // 1 hour

  constructor(
    private readonly provider: AbuseIpDbProvider,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6380', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    this.redisClient = new Redis({
      host,
      port,
      password,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });

    this.redisClient.on('connect', () => {
      this.logger.log('ThreatIntel Redis cache connected.');
    });

    this.redisClient.on('error', (err) => {
      this.logger.warn(`ThreatIntel Redis cache connection error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  async lookupIp(ip: string, actorId?: string): Promise<ThreatIntelReport> {
    const cacheKey = `netsentry:threatintel:${this.provider.name}:${ip}`;

    // 1. Check Redis Cache
    try {
      const cachedData = await this.redisClient.get(cacheKey);
      if (cachedData) {
        const parsed: ThreatIntelReport = JSON.parse(cachedData);
        parsed.cached = true;
        this.logger.debug(`Cache HIT for Threat Intel lookup on ${ip}`);
        return parsed;
      }
    } catch (err: any) {
      this.logger.warn(`Redis cache read failed for ${ip}: ${err.message}`);
    }

    // 2. Fetch from Provider
    const report = await this.provider.lookupIp(ip);

    // 3. Write to Redis Cache
    try {
      const ttl = report.status === 'AVAILABLE' ? this.cacheTtlSeconds : this.errorCacheTtlSeconds;
      await this.redisClient.setex(cacheKey, ttl, JSON.stringify(report));
    } catch (err: any) {
      this.logger.warn(`Redis cache write failed for ${ip}: ${err.message}`);
    }

    // 4. Record Audit Log
    await this.auditService.createLog({
      userId: actorId,
      action: 'THREAT_INTEL_LOOKUP',
      targetResource: 'IP',
      targetId: ip,
      details: {
        provider: report.provider,
        status: report.status,
        score: report.reputationScore,
        cached: false,
      },
    });

    return report;
  }

  getStatus() {
    return {
      provider: this.provider.name,
      configured: this.provider.isConfigured(),
      rateLimitWindow: 'Daily quota enforced by provider',
      cacheTtlSeconds: this.cacheTtlSeconds,
    };
  }
}
