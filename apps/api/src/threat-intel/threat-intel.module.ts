import { Module } from '@nestjs/common';
import { ThreatIntelService } from './threat-intel.service';
import { ThreatIntelController } from './threat-intel.controller';
import { AbuseIpDbProvider } from './abuseipdb.provider';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [ThreatIntelService, AbuseIpDbProvider],
  controllers: [ThreatIntelController],
  exports: [ThreatIntelService],
})
export class ThreatIntelModule {}
