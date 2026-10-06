import { Controller, Get } from '@nestjs/common';
import { NetworkService } from './network.service';

@Controller('api/v1/network')
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Get('stats')
  getNetworkStats() {
    return this.networkService.getNetworkStats();
  }
}
