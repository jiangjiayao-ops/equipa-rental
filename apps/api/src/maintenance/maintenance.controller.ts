import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('plans')
  plans() {
    return this.maintenance.plans();
  }

  @Get('work-orders')
  workOrders() {
    return this.maintenance.workOrders();
  }
}
