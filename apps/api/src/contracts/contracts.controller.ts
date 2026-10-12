import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BillingPeriod } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContractsService } from './contracts.service';

class RenewDto {
  @IsEnum(BillingPeriod)
  toPeriod!: BillingPeriod;

  @IsOptional()
  @IsString()
  newEndDate?: string;
}

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  list() {
    return this.contracts.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contracts.get(id);
  }

  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() body: RenewDto) {
    return this.contracts.renewWithPeriodChange(id, body.toPeriod, body.newEndDate);
  }
}
