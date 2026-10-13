import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingPeriod,
  BillingTiming,
  FiscalDocStatus,
  FiscalDocType,
  InvoiceStatus,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** First rental period covered by the contract, capped by endDate. */
export function computeFirstPeriod(
  startDate: Date,
  endDate: Date,
  billingPeriod: BillingPeriod,
): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(startDate);
  const periodEnd = new Date(startDate);
  if (billingPeriod === BillingPeriod.WEEKLY) {
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);
  } else if (billingPeriod === BillingPeriod.YEARLY) {
    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
  } else {
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  }
  // Period end is exclusive of next period start; use last day of coverage
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);
  if (periodEnd > endDate) {
    return { periodStart, periodEnd: new Date(endDate) };
  }
  return { periodStart, periodEnd };
}

/**
 * ADVANCE: issue/due at period start (pay in advance).
 * ARREARS: issue/due at period end (pay after the period).
 */
export function computeInvoiceDates(
  billingTiming: BillingTiming,
  periodStart: Date,
  periodEnd: Date,
): { issueDate: Date; dueDate: Date } {
  if (billingTiming === BillingTiming.ARREARS) {
    return { issueDate: new Date(periodEnd), dueDate: new Date(periodEnd) };
  }
  return { issueDate: new Date(periodStart), dueDate: new Date(periodStart) };
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  listInvoices() {
    return this.prisma.invoice.findMany({
      include: {
        customer: true,
        contract: true,
        payments: true,
        fiscalDocs: true,
        lines: true,
      },
      orderBy: { number: 'desc' },
    });
  }

  getInvoice(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        contract: true,
        payments: { orderBy: { paidAt: 'asc' } },
        fiscalDocs: { orderBy: { createdAt: 'desc' } },
        lines: true,
      },
    });
  }

  /**
   * Generate a commercial invoice from a contract using billingTiming
   * to set issue/due dates for the first (or provided) rental period.
   */
  async generateFromContract(
    contractId: string,
    periodStartIso?: string,
    periodEndIso?: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { lines: true, customer: true },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');
    if (!contract.lines.length) {
      throw new BadRequestException('Contrato sem linhas para faturar');
    }

    let periodStart: Date;
    let periodEnd: Date;
    if (periodStartIso && periodEndIso) {
      periodStart = new Date(periodStartIso);
      periodEnd = new Date(periodEndIso);
    } else {
      ({ periodStart, periodEnd } = computeFirstPeriod(
        contract.startDate,
        contract.endDate,
        contract.billingPeriod,
      ));
    }

    const { issueDate, dueDate } = computeInvoiceDates(
      contract.billingTiming,
      periodStart,
      periodEnd,
    );

    const lineTotals = contract.lines.map((line) => {
      const totalAmount = line.unitRate + (line.mobFee ?? 0);
      return {
        description: `${line.description} (${contract.billingPeriod}, ${contract.billingTiming})`,
        quantity: 1,
        unitAmount: totalAmount,
        totalAmount,
      };
    });
    const totalAmount = lineTotals.reduce((sum, l) => sum + l.totalAmount, 0);

    const count = await this.prisma.invoice.count();
    const number = `FAT-${String(count + 1).padStart(4, '0')}`;
    const timingLabel =
      contract.billingTiming === BillingTiming.ARREARS
        ? 'pay in arrears / após o período'
        : 'pay in advance / antecipado';

    return this.prisma.invoice.create({
      data: {
        number,
        customerId: contract.customerId,
        contractId: contract.id,
        status: InvoiceStatus.ISSUED,
        issueDate,
        dueDate,
        billingTiming: contract.billingTiming,
        periodStart,
        periodEnd,
        totalAmount,
        notes: `Gerada do contrato ${contract.number} · billingTiming=${contract.billingTiming} (${timingLabel})`,
        lines: { create: lineTotals },
      },
      include: {
        customer: true,
        contract: true,
        payments: true,
        fiscalDocs: true,
        lines: true,
      },
    });
  }

  async registerPayment(
    invoiceId: string,
    method: PaymentMethod,
    amount: number,
    paidAt: string,
    externalRef?: string,
    notes?: string,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (![PaymentMethod.PIX, PaymentMethod.BOLETO].includes(method)) {
      throw new BadRequestException('Método deve ser PIX ou BOLETO');
    }

    await this.prisma.payment.create({
      data: {
        invoiceId,
        method,
        amount,
        paidAt: new Date(paidAt),
        externalRef,
        notes,
      },
    });

    const paidTotal =
      invoice.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
    let status: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
    if (paidTotal >= invoice.totalAmount) status = InvoiceStatus.PAID;
    else if (paidTotal <= 0) status = InvoiceStatus.ISSUED;

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
      include: {
        customer: true,
        contract: true,
        payments: { orderBy: { paidAt: 'asc' } },
        fiscalDocs: true,
        lines: true,
      },
    });
  }

  async issueFiscal(invoiceId: string, type: FiscalDocType = FiscalDocType.NFS_E) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');

    const providerRef = `MOCK-${type}-FAT-${invoice.number}-${Date.now()}`;
    return this.prisma.fiscalDocument.create({
      data: {
        invoiceId,
        type,
        status: FiscalDocStatus.AUTHORIZED,
        provider: 'mock',
        providerRef,
        accessKey: `${type}-MOCK-KEY-${invoice.number}`,
        authorizedAt: new Date(),
        payloadJson: JSON.stringify({
          mock: true,
          invoice: invoice.number,
          type,
          issuedAt: new Date().toISOString(),
        }),
      },
    });
  }
}
