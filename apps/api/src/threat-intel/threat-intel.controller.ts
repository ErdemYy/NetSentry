import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ThreatIntelService } from './threat-intel.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/threat-intel')
@UseGuards(JwtAuthGuard)
export class ThreatIntelController {
  constructor(private readonly threatIntelService: ThreatIntelService) {}

  @Get('status')
  getStatus() {
    return this.threatIntelService.getStatus();
  }

  @Get('lookup/:ip')
  async lookupIp(@Param('ip') ip: string, @CurrentUser() user: any) {
    return this.threatIntelService.lookupIp(ip, user?.id);
  }
}
