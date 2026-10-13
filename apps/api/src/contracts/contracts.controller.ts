import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BillingPeriod, BillingTiming, ContractStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContractsService } from './contracts.service';

class ContractLineDto {
  @IsString()
  equipmentId!: string;

  @IsString()
  description!: string;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @IsNumber()
  @Min(0)
  unitRate!: number;

  @IsOptional()
  @IsNumber()
  mobFee?: number;

  @IsOptional()
  @IsNumber()
  demobFee?: number;
}

class CreateContractDto {
  @IsString()
  customerId!: string;

  @IsString()
  branchId!: string;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @IsOptional()
  @IsEnum(BillingTiming)
  billingTiming?: BillingTiming;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  proposalId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractLineDto)
  lines!: ContractLineDto[];
}

class UpdateContractDto {
  @IsOptional()
  @IsEnum(BillingTiming)
  billingTiming?: BillingTiming;

  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;
}

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

  @Post()
  create(@Body() body: CreateContractDto) {
    return this.contracts.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateContractDto) {
    return this.contracts.update(id, body);
  }

  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() body: RenewDto) {
    return this.contracts.renewWithPeriodChange(id, body.toPeriod, body.newEndDate);
  }
}
