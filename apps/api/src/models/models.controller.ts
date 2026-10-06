import { Controller, Get } from '@nestjs/common';
import { ModelsService } from './models.service';

@Controller('api/v1/models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get('metrics')
  getModelMetrics() {
    return this.modelsService.getModelMetrics();
  }
}
