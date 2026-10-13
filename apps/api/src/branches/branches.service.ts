import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type BranchProfileInput = {
  code?: string;
  name?: string;
  legalName?: string | null;
  tradeName?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  im?: string | null;
  street?: string | null;
  city?: string;
  state?: string;
  cep?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type CreateBranchInput = BranchProfileInput & {
  code: string;
  name: string;
  city: string;
  state: string;
};

const OPEN_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.ACTIVE,
  ContractStatus.SUSPENDED,
];

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.branch.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            cnpj: true,
          },
        },
        _count: {
          select: {
            equipment: true,
            contracts: true,
            proposals: true,
            calendarBlocks: true,
            mobilizations: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async get(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        organization: true,
        _count: {
          select: {
            equipment: true,
            contracts: true,
            proposals: true,
            calendarBlocks: true,
            mobilizations: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });
    if (!branch) throw new NotFoundException('Filial não encontrada');
    return branch;
  }

  async create(input: CreateBranchInput) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const city = input.city.trim();
    const state = input.state.trim().toUpperCase();
    if (!code || !name || !city || !state) {
      throw new BadRequestException(
        'Código, nome do pátio, cidade e UF são obrigatórios',
      );
    }

    const org = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!org) throw new NotFoundException('Organização não encontrada');

    const existing = await this.prisma.branch.findUnique({
      where: {
        organizationId_code: { organizationId: org.id, code },
      },
    });
    if (existing) {
      throw new ConflictException(`Já existe filial com código ${code}`);
    }

    return this.prisma.branch.create({
      data: {
        organizationId: org.id,
        code,
        name,
        legalName: input.legalName ?? null,
        tradeName: input.tradeName ?? null,
        cnpj: input.cnpj ?? null,
        ie: input.ie ?? null,
        im: input.im ?? null,
        street: input.street ?? null,
        city,
        state,
        cep: input.cep ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
      },
      include: {
        organization: true,
        _count: {
          select: {
            equipment: true,
            contracts: true,
            proposals: true,
            calendarBlocks: true,
            mobilizations: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });
  }

  async update(id: string, input: BranchProfileInput) {
    await this.get(id);
    return this.prisma.branch.update({
      where: { id },
      data: {
        name: input.name,
        legalName: input.legalName,
        tradeName: input.tradeName,
        cnpj: input.cnpj,
        ie: input.ie,
        im: input.im,
        street: input.street,
        city: input.city,
        state: input.state?.toUpperCase(),
        cep: input.cep,
        phone: input.phone,
        email: input.email,
      },
      include: {
        organization: true,
        _count: {
          select: {
            equipment: true,
            contracts: true,
            proposals: true,
            calendarBlocks: true,
            mobilizations: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });
  }

  /**
   * Safe delete: refuse if any FK-linked operational data remains.
   * Blocks on equipment, any contracts (incl. closed — FK required),
   * proposals, calendar blocks, mobilizations, or transfers.
   * Also refuses deleting the organization's last branch.
   */
  async remove(id: string) {
    const branch = await this.get(id);

    const totalBranches = await this.prisma.branch.count({
      where: { organizationId: branch.organizationId },
    });
    if (totalBranches <= 1) {
      throw new BadRequestException(
        'Não é possível remover a única filial da organização',
      );
    }

    const openContracts = await this.prisma.contract.count({
      where: {
        branchId: id,
        status: { in: OPEN_CONTRACT_STATUSES },
      },
    });

    const blockers: string[] = [];
    const c = branch._count;
    if (c.equipment > 0) blockers.push(`${c.equipment} equipamento(s)`);
    if (openContracts > 0) blockers.push(`${openContracts} contrato(s) aberto(s)`);
    if (c.contracts > openContracts) {
      blockers.push(
        `${c.contracts - openContracts} contrato(s) encerrado(s) ainda vinculados`,
      );
    }
    if (c.proposals > 0) blockers.push(`${c.proposals} proposta(s)`);
    if (c.calendarBlocks > 0) blockers.push(`${c.calendarBlocks} bloqueio(s) de agenda`);
    if (c.mobilizations > 0) blockers.push(`${c.mobilizations} mobilização(ões)`);
    const transfers = c.transfersFrom + c.transfersTo;
    if (transfers > 0) blockers.push(`${transfers} transferência(s)`);

    if (blockers.length) {
      throw new BadRequestException(
        `Não é possível remover a filial ${branch.code}: ainda há ${blockers.join(', ')}. Remova ou realoque esses registros antes.`,
      );
    }

    await this.prisma.branch.delete({ where: { id } });
    return { ok: true, id, code: branch.code };
  }
}
