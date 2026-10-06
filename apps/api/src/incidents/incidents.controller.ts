import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { IncidentsService, IncidentQueryDto } from './incidents.service';

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

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.incidentsService.updateStatus(id, status);
  }
}
