import { Injectable, Logger } from '@nestjs/common';
import { IThreatIntelProvider, ThreatIntelReport } from './threat-intel.interface';
import { SsrfValidator } from './ssrf.validator';

@Injectable()
export class AbuseIpDbProvider implements IThreatIntelProvider {
  readonly name = 'ABUSEIPDB' as const;
  private readonly logger = new Logger(AbuseIpDbProvider.name);
  private readonly apiKey = process.env.ABUSEIPDB_API_KEY || '';
  private readonly endpoint = 'https://api.abuseipdb.com/api/v2/check';
  private readonly timeoutMs = 4000;

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async lookupIp(ip: string): Promise<ThreatIntelReport> {
    const now = new Date().toISOString();

    // 1. SSRF Protection: Prevent querying private/internal infrastructure
    if (SsrfValidator.isPrivateOrReserved(ip)) {
      this.logger.debug(`Skipped internal IP ${ip} to prevent SSRF.`);
      return {
        indicator: ip,
        indicatorType: 'IP',
        provider: this.name,
        providerVersion: 'v2',
        status: 'INVALID_TARGET',
        isMalicious: false,
        message: 'RFC 1918 / Private / Reserved IP address skipped to prevent SSRF vulnerabilities.',
        queriedAt: now,
        cached: false,
      };
    }

    // 2. Configuration check
    if (!this.isConfigured()) {
      return {
        indicator: ip,
        indicatorType: 'IP',
        provider: this.name,
        providerVersion: 'v2',
        status: 'NOT_CONFIGURED',
        isMalicious: false,
        message: 'AbuseIPDB API key is not configured in environment (ABUSEIPDB_API_KEY).',
        queriedAt: now,
        cached: false,
      };
    }

    // 3. Live External API Fetch with strict timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const url = `${this.endpoint}?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Key: this.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        this.logger.warn(`AbuseIPDB rate limit exceeded when querying ${ip}.`);
        return {
          indicator: ip,
          indicatorType: 'IP',
          provider: this.name,
          providerVersion: 'v2',
          status: 'RATE_LIMITED',
          isMalicious: false,
          message: 'AbuseIPDB API quota exceeded for the current window.',
          queriedAt: now,
          cached: false,
        };
      }

      if (!response.ok) {
        this.logger.error(`AbuseIPDB returned HTTP ${response.status} ${response.statusText}`);
        return {
          indicator: ip,
          indicatorType: 'IP',
          provider: this.name,
          providerVersion: 'v2',
          status: 'UNAVAILABLE',
          isMalicious: false,
          message: `AbuseIPDB service returned HTTP ${response.status}.`,
          queriedAt: now,
          cached: false,
        };
      }

      const body = await response.json();
      const data = body?.data;

      if (!data) {
        return {
          indicator: ip,
          indicatorType: 'IP',
          provider: this.name,
          providerVersion: 'v2',
          status: 'UNAVAILABLE',
          isMalicious: false,
          message: 'Malformed response structure from AbuseIPDB.',
          queriedAt: now,
          cached: false,
        };
      }

      const score = typeof data.abuseConfidenceScore === 'number' ? data.abuseConfidenceScore : 0;
      const isMalicious = score >= 25 || (data.totalReports && data.totalReports > 2);

      return {
        indicator: ip,
        indicatorType: 'IP',
        provider: this.name,
        providerVersion: 'v2',
        status: 'AVAILABLE',
        reputationScore: score,
        isMalicious,
        totalReports: data.totalReports || 0,
        lastReportedAt: data.lastReportedAt || null,
        countryCode: data.countryCode || 'UNKNOWN',
        isp: data.isp || 'UNKNOWN',
        details: {
          usageType: data.usageType,
          domain: data.domain,
          hostnames: data.hostnames,
          isWhitelisted: data.isWhitelisted,
        },
        queriedAt: now,
        cached: false,
      };
    } catch (err: any) {
      this.logger.error(`Error querying AbuseIPDB for ${ip}: ${err.message}`);
      return {
        indicator: ip,
        indicatorType: 'IP',
        provider: this.name,
        providerVersion: 'v2',
        status: 'UNAVAILABLE',
        isMalicious: false,
        message: err.name === 'AbortError' ? 'AbuseIPDB request timed out (4000ms).' : `Network error: ${err.message}`,
        queriedAt: now,
        cached: false,
      };
    }
  }
}
