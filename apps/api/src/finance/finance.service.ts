import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FiscalDocStatus,
  FiscalDocType,
  InvoiceStatus,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
