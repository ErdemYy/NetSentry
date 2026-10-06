import { Controller, Get, Param, Query } from '@nestjs/common';
import { ThreatsService, ThreatQueryDto } from './threats.service';

@Controller('api/v1/threats')
export class ThreatsController {
  constructor(private readonly threatsService: ThreatsService) {}

  @Get()
  getThreats(@Query() query: ThreatQueryDto) {
    return this.threatsService.getThreats(query);
  }

  @Get(':id')
  getThreatById(@Param('id') id: string) {
    return this.threatsService.getThreatById(id);
  }
}
