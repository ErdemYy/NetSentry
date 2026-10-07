import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SensorService, StartSensorDto, ProcessPcapDto } from './sensor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/sensor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SensorController {
  constructor(private readonly sensorService: SensorService) {}

  @Get('status')
  @Roles('ADMIN', 'ANALYST')
  async getStatus() {
    return this.sensorService.getStatus();
  }

  @Get('interfaces')
  @Roles('ADMIN', 'ANALYST')
  async getInterfaces() {
    return this.sensorService.getInterfaces();
  }

  @Post('start')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async startCapture(
    @Body() dto: StartSensorDto,
    @CurrentUser() user: any,
  ) {
    return this.sensorService.startCapture(dto, user?.id);
  }

  @Post('stop')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async stopCapture(@CurrentUser() user: any) {
    return this.sensorService.stopCapture(user?.id);
  }

  @Post('process-pcap')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async processPcap(
    @Body() dto: ProcessPcapDto,
    @CurrentUser() user: any,
  ) {
    return this.sensorService.processPcap(dto, user?.id);
  }
}
