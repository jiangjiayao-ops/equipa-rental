import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FiscalDocType, PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinanceService } from './finance.service';

class PaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class FiscalDto {
  @IsOptional()
  @IsEnum(FiscalDocType)
  type?: FiscalDocType;
}

class GenerateInvoiceDto {
  @IsOptional()
  @IsString()
  periodStart?: string;

  @IsOptional()
  @IsString()
  periodEnd?: string;
}

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('invoices')
  listInvoices() {
    return this.finance.listInvoices();
  }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string) {
    return this.finance.getInvoice(id);
  }

  @Post('contracts/:contractId/invoices')
  generateFromContract(
    @Param('contractId') contractId: string,
    @Body() body: GenerateInvoiceDto,
  ) {
    return this.finance.generateFromContract(
      contractId,
      body.periodStart,
      body.periodEnd,
    );
  }

  @Post('invoices/:id/payments')
  registerPayment(@Param('id') id: string, @Body() body: PaymentDto) {
    return this.finance.registerPayment(
      id,
      body.method,
      body.amount,
      body.paidAt,
      body.externalRef,
      body.notes,
    );
  }

  @Post('invoices/:id/fiscal')
  issueFiscal(@Param('id') id: string, @Body() body: FiscalDto) {
    return this.finance.issueFiscal(id, body.type ?? FiscalDocType.NFS_E);
  }
}
