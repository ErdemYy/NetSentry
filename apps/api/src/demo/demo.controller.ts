import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { DemoService } from './demo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/demo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('reset')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async resetDemo(@CurrentUser() user: any) {
    return this.demoService.resetDemoState(user?.id);
  }
}
