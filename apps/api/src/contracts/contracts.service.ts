import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingPeriod, BillingTiming, ContractStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export type CreateContractInput = {
  customerId: string;
  branchId: string;
  billingPeriod: BillingPeriod;
  billingTiming?: BillingTiming;
  startDate: string;
  endDate: string;
  depositAmount?: number;
  notes?: string;
  proposalId?: string;
  lines: Array<{
    equipmentId: string;
    description: string;
    billingPeriod: BillingPeriod;
    unitRate: number;
    mobFee?: number;
    demobFee?: number;
  }>;
};

export type UpdateContractInput = {
  billingTiming?: BillingTiming;
  billingPeriod?: BillingPeriod;
  startDate?: string;
  endDate?: string;
  notes?: string;
  status?: ContractStatus;
  depositAmount?: number;
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.contract.findMany({
      where: { deletedAt: null },
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

  async getOrThrow(id: string) {
    const contract = await this.get(id);
    if (!contract || contract.deletedAt) {
      throw new NotFoundException('Contrato não encontrado');
    }
    return contract;
  }

  async remove(
    id: string,
    actor: { userId: string; email: string },
    hard = false,
  ) {
    const contract = await this.getOrThrow(id);
    const invoices = await this.prisma.invoice.count({
      where: { contractId: id },
    });

    if (hard) {
      if (contract.status !== ContractStatus.DRAFT || invoices > 0) {
        throw new BadRequestException(
          'Exclusão permanente só para contratos rascunho sem faturas. Use arquivar.',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.contractLine.deleteMany({ where: { contractId: id } });
        await tx.contractAmendment.deleteMany({ where: { contractId: id } });
        await tx.contract.delete({ where: { id } });
      });
      await this.audit.log({
        actorId: actor.userId,
        actorEmail: actor.email,
        action: 'DELETE_HARD',
        entityType: 'Contract',
        entityId: id,
        entityLabel: contract.number,
      });
      return { ok: true, mode: 'hard' as const, id, label: contract.number };
    }

    await this.prisma.contract.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status:
          contract.status === ContractStatus.CLOSED
            ? contract.status
            : ContractStatus.CANCELLED,
      },
    });
    await this.audit.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: 'DELETE_SOFT',
      entityType: 'Contract',
      entityId: id,
      entityLabel: contract.number,
    });
    return { ok: true, mode: 'soft' as const, id, label: contract.number };
  }

  async create(input: CreateContractInput) {
    if (!input.lines?.length) {
      throw new BadRequestException('Contrato precisa de ao menos uma linha');
    }
    const timing = input.billingTiming ?? BillingTiming.ADVANCE;
    if (!Object.values(BillingTiming).includes(timing)) {
      throw new BadRequestException('billingTiming inválido');
    }

    const count = await this.prisma.contract.count();
    const number = `CTR-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.contract.create({
      data: {
        number,
        customerId: input.customerId,
        branchId: input.branchId,
        proposalId: input.proposalId,
        status: ContractStatus.DRAFT,
        billingPeriod: input.billingPeriod,
        billingTiming: timing,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        depositAmount: input.depositAmount ?? 0,
        notes: input.notes,
        lines: {
          create: input.lines.map((line) => ({
            equipmentId: line.equipmentId,
            description: line.description,
            billingPeriod: line.billingPeriod,
            unitRate: line.unitRate,
            mobFee: line.mobFee ?? 0,
            demobFee: line.demobFee ?? 0,
          })),
        },
      },
      include: {
        customer: true,
        branch: true,
        lines: { include: { equipment: true } },
        amendments: true,
      },
    });
  }

  async update(id: string, input: UpdateContractInput) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contrato não encontrado');

    if (
      input.billingTiming !== undefined &&
      !Object.values(BillingTiming).includes(input.billingTiming)
    ) {
      throw new BadRequestException('billingTiming inválido');
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        billingTiming: input.billingTiming,
        billingPeriod: input.billingPeriod,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        notes: input.notes,
        status: input.status,
        depositAmount: input.depositAmount,
        ...(input.billingPeriod
          ? {
              lines: {
                updateMany: {
                  where: { contractId: id },
                  data: { billingPeriod: input.billingPeriod },
                },
              },
            }
          : {}),
      },
      include: {
        customer: true,
        branch: true,
        proposal: true,
        lines: { include: { equipment: true } },
        amendments: { orderBy: { createdAt: 'desc' } },
        invoices: true,
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
