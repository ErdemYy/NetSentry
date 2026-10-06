import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { IncidentsService, IncidentQueryDto } from './incidents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  getIncidents(@Query() query: IncidentQueryDto) {
    return this.incidentsService.getIncidents(query);
  }

  @Get(':id')
  getIncidentById(@Param('id') id: string) {
    return this.incidentsService.getIncidentById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.incidentsService.updateStatus(id, status, user?.id);
  }
}
