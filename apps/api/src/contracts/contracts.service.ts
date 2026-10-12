import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.contract.findMany({
      include: {
        customer: true,
        branch: true,
        lines: { include: { equipment: true } },
        amendments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { number: 'desc' },
    });
  }

  get(id: string) {
    return this.prisma.contract.findUnique({
      where: { id },
      include: {
        customer: true,
        branch: true,
        proposal: true,
        lines: { include: { equipment: true } },
        amendments: { orderBy: { createdAt: 'desc' } },
        invoices: true,
        mobilizations: true,
      },
    });
  }

  async renewWithPeriodChange(
    id: string,
    toPeriod: BillingPeriod,
    newEndDate?: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');
    if (!Object.values(BillingPeriod).includes(toPeriod)) {
      throw new BadRequestException('Período inválido');
    }

    const fromPeriod = contract.billingPeriod;
    return this.prisma.$transaction(async (tx) => {
      await tx.contractAmendment.create({
        data: {
          contractId: id,
          type: 'renewal_period_change',
          notes: `renewal_period_change: ${fromPeriod} → ${toPeriod}`,
          fromPeriod,
          toPeriod,
        },
      });
      return tx.contract.update({
        where: { id },
        data: {
          billingPeriod: toPeriod,
          endDate: newEndDate ? new Date(newEndDate) : contract.endDate,
          lines: {
            updateMany: {
              where: { contractId: id },
              data: { billingPeriod: toPeriod },
            },
          },
        },
        include: {
          customer: true,
          branch: true,
          lines: { include: { equipment: true } },
          amendments: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  }
}
