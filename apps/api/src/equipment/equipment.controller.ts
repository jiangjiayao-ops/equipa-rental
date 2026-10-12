import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EquipmentService } from './equipment.service';

@Controller('equipment')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  list(@Query('branchId') branchId?: string) {
    return this.equipment.list(branchId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.equipment.get(id);
  }
}
