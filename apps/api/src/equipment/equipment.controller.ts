import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EquipmentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EquipmentService } from './equipment.service';

class UpsertEquipmentDto {
  @IsOptional()
  @IsString()
  code?: string | null;

  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  branchId!: string;

  @IsString()
  @MinLength(1)
  brand!: string;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number | null;

  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @IsOptional()
  @IsString()
  vin?: string | null;

  @IsOptional()
  @IsString()
  frameNumber?: string | null;

  @IsOptional()
  @IsString()
  plate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourMeter?: number | null;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

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

  @Get('categories')
  listCategories() {
    return this.equipment.listCategories();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.equipment.getOrThrow(id);
  }

  @Post()
  create(@Body() body: UpsertEquipmentDto) {
    return this.equipment.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpsertEquipmentDto) {
    return this.equipment.update(id, body);
  }
}
