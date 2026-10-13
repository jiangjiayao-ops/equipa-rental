import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BillingTiming } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProposalsService } from './proposals.service';

class UpdateProposalDto {
  @IsEnum(BillingTiming)
  billingTiming!: BillingTiming;
}

class ConvertDto {
  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsEnum(BillingTiming)
  billingTiming?: BillingTiming;
}

@Controller('proposals')
@UseGuards(JwtAuthGuard)
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  list() {
    return this.proposals.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.proposals.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateProposalDto) {
    return this.proposals.updateBillingTiming(id, body.billingTiming);
  }

  @Post(':id/convert')
  convert(@Param('id') id: string, @Body() body: ConvertDto) {
    return this.proposals.convertToContract(
      id,
      body.startDate,
      body.endDate,
      body.billingTiming,
    );
  }
}
