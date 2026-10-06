export interface ThreatIntelReport {
  indicator: string;
  indicatorType: 'IP' | 'DOMAIN' | 'HASH';
  provider: 'ABUSEIPDB' | 'VIRUSTOTAL' | 'NONE';
  providerVersion?: string;
  status: 'AVAILABLE' | 'NOT_CONFIGURED' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'INVALID_TARGET';
  reputationScore?: number; // 0 - 100 percentage
  isMalicious: boolean;
  totalReports?: number;
  lastReportedAt?: string;
  countryCode?: string;
  isp?: string;
  details?: Record<string, any>;
  message?: string;
  queriedAt: string;
  cached: boolean;
  expiresAt?: string;
}

export interface IThreatIntelProvider {
  readonly name: 'ABUSEIPDB' | 'VIRUSTOTAL';
  isConfigured(): boolean;
  lookupIp(ip: string): Promise<ThreatIntelReport>;
}
