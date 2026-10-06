import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles('ADMIN')
  async getLogs(
    @Query('action') action?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.auditService.getLogs({
      action,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  }
}
