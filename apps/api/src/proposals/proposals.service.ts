import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingTiming, ContractStatus, ProposalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.proposal.findMany({
      include: {
        customer: true,
        branch: true,
        lines: { include: { equipment: true } },
      },
      orderBy: { number: 'desc' },
    });
  }

  get(id: string) {
    return this.prisma.proposal.findUnique({
      where: { id },
      include: {
        customer: true,
        branch: true,
        lines: { include: { equipment: true } },
        contracts: true,
      },
    });
  }

  async updateBillingTiming(id: string, billingTiming: BillingTiming) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    if (!Object.values(BillingTiming).includes(billingTiming)) {
      throw new BadRequestException('billingTiming inválido');
    }
    return this.prisma.proposal.update({
      where: { id },
      data: { billingTiming },
      include: {
        customer: true,
        branch: true,
        lines: { include: { equipment: true } },
        contracts: true,
      },
    });
  }

  /**
   * Convert an accepted (or any) proposal into a contract, copying billingTiming.
   */
  async convertToContract(
    id: string,
    startDate: string,
    endDate: string,
    billingTiming?: BillingTiming,
  ) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    if (!proposal.lines.length) {
      throw new BadRequestException('Proposta sem linhas');
    }

    const missingEquipment = proposal.lines.filter((l) => !l.equipmentId);
    if (missingEquipment.length) {
      throw new BadRequestException(
        'Todas as linhas precisam de equipamento para converter',
      );
    }

    const timing = billingTiming ?? proposal.billingTiming ?? BillingTiming.ADVANCE;
    const billingPeriod = proposal.lines[0].billingPeriod;
    const count = await this.prisma.contract.count();
    const number = `CTR-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: {
          status: ProposalStatus.ACCEPTED,
          billingTiming: timing,
        },
      });

      return tx.contract.create({
        data: {
          number,
          customerId: proposal.customerId,
          branchId: proposal.branchId,
          proposalId: proposal.id,
          status: ContractStatus.DRAFT,
          billingPeriod,
          billingTiming: timing,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          notes: proposal.notes,
          lines: {
            create: proposal.lines.map((line) => ({
              equipmentId: line.equipmentId!,
              description: line.description,
              billingPeriod: line.billingPeriod,
              unitRate: line.unitRate,
              mobFee: line.mobFee,
              demobFee: line.demobFee,
            })),
          },
        },
        include: {
          customer: true,
          branch: true,
          proposal: true,
          lines: { include: { equipment: true } },
        },
      });
    });
  }
}
