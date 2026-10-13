import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EquipmentService } from './equipment.service';

@Controller('equipment')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  list(
    @Query('branchId') branchId?: string,
    @Query('availableOnly') availableOnly?: string,
  ) {
    return this.equipment.list(
      branchId,
      availableOnly === '1' || availableOnly === 'true',
    );
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.equipment.get(id);
  }
}
