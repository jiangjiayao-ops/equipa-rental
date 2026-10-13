import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  BillingPeriod,
  BillingTiming,
  ProposalSendChannel,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProposalPdfService } from './proposal-pdf.service';
import { ProposalsService } from './proposals.service';

class LineDto {
  @IsString()
  equipmentId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;
}

class OptionDto {
  @IsString()
  label!: string;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @IsNumber()
  @Min(1)
  durationDays!: number;

  @IsNumber()
  @Min(0)
  unitRate!: number;

  @IsOptional()
  @IsNumber()
  mobFee?: number;

  @IsOptional()
  @IsNumber()
  demobFee?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class CreateProposalDto {
  @IsString()
  customerId!: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsEnum(BillingTiming)
  billingTiming?: BillingTiming;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options!: OptionDto[];
}

class UpdateProposalDto {
  @IsOptional()
  @IsEnum(BillingTiming)
  billingTiming?: BillingTiming;
}

class SendDto {
  @IsOptional()
  @IsArray()
  @IsEnum(ProposalSendChannel, { each: true })
  channels?: ProposalSendChannel[];
}

class ConvertDto {
  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsEnum(BillingTiming)
  billingTiming?: BillingTiming;

  @IsOptional()
  @IsString()
  optionId?: string;
}

@Controller('proposals')
@UseGuards(JwtAuthGuard)
export class ProposalsController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly pdf: ProposalPdfService,
  ) {}

  @Get()
  list() {
    return this.proposals.list();
  }

  @Get('notify-config')
  notifyConfig() {
    return this.proposals.notifyConfig();
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async pdfDownload(
    @Param('id') id: string,
    @Query('locale') locale: string | undefined,
    @Res() res: Response,
  ) {
    const proposal = await this.proposals.get(id);
    const buf = await this.pdf.build(
      id,
      locale === 'en' ? 'en' : 'pt-BR',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${proposal.number}.pdf"`,
    );
    res.send(buf);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.proposals.get(id);
  }

  @Post()
  create(@Body() body: CreateProposalDto) {
    return this.proposals.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateProposalDto) {
    if (!body.billingTiming) {
      return this.proposals.get(id);
    }
    return this.proposals.updateBillingTiming(id, body.billingTiming);
  }

  @Post(':id/send')
  send(@Param('id') id: string, @Body() body: SendDto) {
    return this.proposals.send(id, body.channels);
  }

  @Post(':id/convert')
  convert(@Param('id') id: string, @Body() body: ConvertDto) {
    return this.proposals.convertToContract(
      id,
      body.startDate,
      body.endDate,
      body.billingTiming,
      body.optionId,
    );
  }
}
