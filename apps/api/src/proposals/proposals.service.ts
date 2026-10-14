import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingPeriod,
  BillingTiming,
  ContractStatus,
  EquipmentStatus,
  ProposalSendChannel,
  ProposalSendStatus,
  ProposalStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotifyService } from './notify.service';

export type ProposalLineInput = {
  equipmentId: string;
  description?: string;
  quantity?: number;
};

export type ProposalOptionInput = {
  label: string;
  billingPeriod: BillingPeriod;
  durationDays: number;
  unitRate: number;
  mobFee?: number;
  demobFee?: number;
  sortOrder?: number;
};

export type CreateProposalInput = {
  customerId: string;
  branchId: string;
  ownerId?: string | null;
  billingTiming?: BillingTiming;
  allowedHours?: number;
  hoursUnlimited?: boolean;
  validUntil?: string;
  notes?: string;
  lines: ProposalLineInput[];
  options: ProposalOptionInput[];
};

const ownerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  whatsapp: true,
  role: true,
} as const;

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyService,
    private readonly audit: AuditService,
  ) {}

  private includeAll() {
    return {
      customer: true,
      branch: true,
      owner: { select: ownerSelect },
      lines: { include: { equipment: true } },
      options: { orderBy: { sortOrder: 'asc' as const } },
      sendAttempts: { orderBy: { createdAt: 'desc' as const } },
      contracts: true,
      acceptedOption: true,
    };
  }

  /** Human number: PROP-YYYY-0001 (per calendar year). */
  private async nextProposalNumber() {
    const year = new Date().getFullYear();
    const prefix = `PROP-${year}-`;
    const latest = await this.prisma.proposal.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    let seq = 1;
    if (latest?.number) {
      const part = latest.number.slice(prefix.length);
      const n = Number(part);
      if (Number.isFinite(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async resolveOwnerId(preferred?: string | null, fallbackUserId?: string) {
    if (preferred) {
      const u = await this.prisma.user.findFirst({
        where: { id: preferred, active: true },
      });
      if (u) return u.id;
    }
    if (fallbackUserId) {
      const u = await this.prisma.user.findFirst({
        where: { id: fallbackUserId, active: true },
      });
      if (u) return u.id;
    }
    const admin = await this.prisma.user.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
    return admin?.id ?? null;
  }

  list() {
    return this.prisma.proposal.findMany({
      where: { deletedAt: null },
      include: this.includeAll(),
      orderBy: { number: 'desc' },
    });
  }

  async get(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: this.includeAll(),
    });
    if (!proposal || proposal.deletedAt) {
      throw new NotFoundException('Proposta não encontrada');
    }
    return proposal;
  }

  async remove(
    id: string,
    actor: { userId: string; email: string },
    hard = false,
  ) {
    const proposal = await this.get(id);
    const contractCount = await this.prisma.contract.count({
      where: { proposalId: id, deletedAt: null },
    });

    if (hard) {
      if (proposal.status !== ProposalStatus.DRAFT || contractCount > 0) {
        throw new BadRequestException(
          'Exclusão permanente só para rascunhos sem contrato. Use arquivar.',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.proposalSendAttempt.deleteMany({ where: { proposalId: id } });
        await tx.proposalOption.deleteMany({ where: { proposalId: id } });
        await tx.proposalLine.deleteMany({ where: { proposalId: id } });
        await tx.proposal.delete({ where: { id } });
      });
      await this.audit.log({
        actorId: actor.userId,
        actorEmail: actor.email,
        action: 'DELETE_HARD',
        entityType: 'Proposal',
        entityId: id,
        entityLabel: proposal.number,
      });
      return { ok: true, mode: 'hard' as const, id, label: proposal.number };
    }

    await this.prisma.proposal.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status:
          proposal.status === ProposalStatus.DRAFT
            ? ProposalStatus.CANCELLED
            : proposal.status === ProposalStatus.SENT
              ? ProposalStatus.CANCELLED
              : proposal.status,
      },
    });
    await this.audit.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: 'DELETE_SOFT',
      entityType: 'Proposal',
      entityId: id,
      entityLabel: proposal.number,
    });
    return { ok: true, mode: 'soft' as const, id, label: proposal.number };
  }

  async getByPublicToken(token: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { publicToken: token },
      include: {
        customer: {
          select: {
            legalName: true,
            tradeName: true,
            document: true,
            email: true,
            phone: true,
          },
        },
        branch: { select: { code: true, name: true, city: true, state: true } },
        owner: { select: ownerSelect },
        lines: {
          include: {
            equipment: { include: { branch: true, category: true } },
          },
        },
        options: { orderBy: { sortOrder: 'asc' } },
        acceptedOption: true,
        contracts: { select: { id: true, number: true, status: true } },
      },
    });
    if (!proposal || proposal.deletedAt) {
      throw new NotFoundException('Proposta não encontrada');
    }
    if (
      proposal.validUntil &&
      proposal.validUntil < new Date() &&
      proposal.status !== ProposalStatus.ACCEPTED
    ) {
      if (proposal.status !== ProposalStatus.EXPIRED) {
        await this.prisma.proposal.update({
          where: { id: proposal.id },
          data: { status: ProposalStatus.EXPIRED },
        });
        proposal.status = ProposalStatus.EXPIRED;
      }
    }
    return proposal;
  }

  async create(input: CreateProposalInput, actorUserId?: string) {
    if (!input.lines?.length) {
      throw new BadRequestException('Inclua ao menos um equipamento');
    }
    if (!input.options?.length) {
      throw new BadRequestException(
        'Inclua ao menos uma opção de período (ex.: 7 dias, 30 dias)',
      );
    }

    const equipmentIds = input.lines.map((l) => l.equipmentId);
    const equipment = await this.prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
    });
    if (equipment.length !== equipmentIds.length) {
      throw new BadRequestException('Equipamento inválido');
    }
    const eqMap = new Map(equipment.map((e) => [e.id, e]));

    const number = await this.nextProposalNumber();
    const ownerId = await this.resolveOwnerId(input.ownerId, actorUserId);
    const publicToken = randomBytes(24).toString('hex');
    const defaultPeriod = input.options[0].billingPeriod;

    const hoursUnlimited = Boolean(input.hoursUnlimited);
    const allowedHours = hoursUnlimited
      ? 0
      : input.allowedHours != null && input.allowedHours > 0
        ? input.allowedHours
        : 200;

    return this.prisma.proposal.create({
      data: {
        number,
        customerId: input.customerId,
        branchId: input.branchId,
        ownerId,
        status: ProposalStatus.DRAFT,
        billingTiming: input.billingTiming ?? BillingTiming.ADVANCE,
        allowedHours,
        hoursUnlimited,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        notes: input.notes,
        publicToken,
        lines: {
          create: input.lines.map((line) => {
            const eq = eqMap.get(line.equipmentId)!;
            return {
              equipmentId: eq.id,
              description:
                line.description ||
                `${eq.brand} ${eq.model} · ${eq.code}${eq.serialNumber ? ` · SN ${eq.serialNumber}` : ''}`,
              billingPeriod: defaultPeriod,
              unitRate: 0,
              quantity: line.quantity ?? 1,
              mobFee: 0,
              demobFee: 0,
            };
          }),
        },
        options: {
          create: input.options.map((opt, i) => ({
            label: opt.label,
            billingPeriod: opt.billingPeriod,
            durationDays: opt.durationDays,
            unitRate: opt.unitRate,
            mobFee: opt.mobFee ?? 0,
            demobFee: opt.demobFee ?? 0,
            sortOrder: opt.sortOrder ?? i,
          })),
        },
      },
      include: this.includeAll(),
    });
  }

  async updateBillingTiming(id: string, billingTiming: BillingTiming) {
    const proposal = await this.get(id);
    if (proposal.status !== ProposalStatus.DRAFT) {
      throw new BadRequestException(
        'Somente propostas em rascunho (DRAFT) podem ser editadas',
      );
    }
    return this.prisma.proposal.update({
      where: { id },
      data: { billingTiming },
      include: this.includeAll(),
    });
  }

  /** Full replace of commercial fields — DRAFT only. */
  async updateDraft(id: string, input: CreateProposalInput) {
    const proposal = await this.get(id);
    if (proposal.status !== ProposalStatus.DRAFT) {
      throw new BadRequestException(
        'Somente propostas em rascunho (DRAFT) podem ser editadas',
      );
    }
    if (!input.lines?.length) {
      throw new BadRequestException('Inclua ao menos um equipamento');
    }
    if (!input.options?.length) {
      throw new BadRequestException(
        'Inclua ao menos uma opção de período (ex.: 7 dias, 30 dias)',
      );
    }

    const [customer, branch] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: input.customerId } }),
      this.prisma.branch.findUnique({ where: { id: input.branchId } }),
    ]);
    if (!customer) throw new BadRequestException('Cliente inválido');
    if (!branch) throw new BadRequestException('Filial inválida');

    const equipmentIds = input.lines.map((l) => l.equipmentId);
    const equipment = await this.prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
    });
    if (equipment.length !== equipmentIds.length) {
      throw new BadRequestException('Equipamento inválido');
    }
    const eqMap = new Map(equipment.map((e) => [e.id, e]));
    const defaultPeriod = input.options[0].billingPeriod;
    const ownerId = await this.resolveOwnerId(
      input.ownerId,
      proposal.ownerId ?? undefined,
    );

    const hoursUnlimited = Boolean(input.hoursUnlimited);
    const allowedHours = hoursUnlimited
      ? 0
      : input.allowedHours != null && input.allowedHours > 0
        ? input.allowedHours
        : 200;

    return this.prisma.$transaction(async (tx) => {
      await tx.proposalLine.deleteMany({ where: { proposalId: id } });
      await tx.proposalOption.deleteMany({ where: { proposalId: id } });

      return tx.proposal.update({
        where: { id },
        data: {
          customerId: input.customerId,
          branchId: input.branchId,
          ownerId,
          billingTiming: input.billingTiming ?? BillingTiming.ADVANCE,
          allowedHours,
          hoursUnlimited,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          notes: input.notes,
          lines: {
            create: input.lines.map((line) => {
              const eq = eqMap.get(line.equipmentId)!;
              return {
                equipmentId: eq.id,
                description:
                  line.description ||
                  `${eq.brand} ${eq.model} · ${eq.code}${eq.serialNumber ? ` · SN ${eq.serialNumber}` : ''}`,
                billingPeriod: defaultPeriod,
                unitRate: 0,
                quantity: line.quantity ?? 1,
                mobFee: 0,
                demobFee: 0,
              };
            }),
          },
          options: {
            create: input.options.map((opt, i) => ({
              label: opt.label,
              billingPeriod: opt.billingPeriod,
              durationDays: opt.durationDays,
              unitRate: opt.unitRate,
              mobFee: opt.mobFee ?? 0,
              demobFee: opt.demobFee ?? 0,
              sortOrder: opt.sortOrder ?? i,
            })),
          },
        },
        include: this.includeAll(),
      });
    });
  }

  publicUrl(token: string) {
    const base = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    return `${base}/p/${token}`;
  }

  async send(id: string, channels?: ProposalSendChannel[]) {
    const proposal = await this.get(id);
    if (!proposal.publicToken) {
      const token = randomBytes(24).toString('hex');
      await this.prisma.proposal.update({
        where: { id },
        data: { publicToken: token },
      });
      proposal.publicToken = token;
    }

    if (
      proposal.status === ProposalStatus.ACCEPTED ||
      proposal.status === ProposalStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Proposta já finalizada; não é possível reenviar',
      );
    }

    const url = this.publicUrl(proposal.publicToken!);
    const wanted =
      channels?.length ?? 0
        ? channels!
        : [ProposalSendChannel.EMAIL, ProposalSendChannel.WHATSAPP];

    const subject = `Proposta ${proposal.number} — Equipa`;
    const text = [
      `Olá, ${proposal.customer.legalName},`,
      '',
      `Segue a proposta comercial ${proposal.number} da Equipa.`,
      `Acesse e escolha o período: ${url}`,
      '',
      proposal.notes ? `Observações: ${proposal.notes}` : '',
      proposal.validUntil
        ? `Válida até: ${proposal.validUntil.toISOString().slice(0, 10)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const attempts = [];

    for (const channel of wanted) {
      if (channel === ProposalSendChannel.EMAIL) {
        const to = proposal.customer.email;
        if (!to) {
          attempts.push(
            await this.prisma.proposalSendAttempt.create({
              data: {
                proposalId: id,
                channel,
                status: ProposalSendStatus.FAILED,
                provider: 'none',
                error: 'Cliente sem e-mail cadastrado',
                publicUrl: url,
              },
            }),
          );
          continue;
        }
        const result = await this.notify.sendEmail({ to, subject, text });
        attempts.push(
          await this.prisma.proposalSendAttempt.create({
            data: {
              proposalId: id,
              channel,
              status: ProposalSendStatus[result.status],
              toAddress: to,
              provider: result.provider,
              providerRef: result.providerRef,
              error: result.error,
              publicUrl: url,
              payloadJson: JSON.stringify({ subject, text }),
            },
          }),
        );
      }

      if (channel === ProposalSendChannel.WHATSAPP) {
        const to = proposal.customer.phone;
        if (!to) {
          attempts.push(
            await this.prisma.proposalSendAttempt.create({
              data: {
                proposalId: id,
                channel,
                status: ProposalSendStatus.FAILED,
                provider: 'none',
                error: 'Cliente sem telefone cadastrado',
                publicUrl: url,
              },
            }),
          );
          continue;
        }
        const result = await this.notify.sendWhatsApp({ to, body: text });
        attempts.push(
          await this.prisma.proposalSendAttempt.create({
            data: {
              proposalId: id,
              channel,
              status: ProposalSendStatus[result.status],
              toAddress: to,
              provider: result.provider,
              providerRef: result.providerRef,
              error: result.error,
              publicUrl: url,
              payloadJson: JSON.stringify({ text }),
            },
          }),
        );
      }
    }

    const updated = await this.prisma.proposal.update({
      where: { id },
      data: {
        status:
          proposal.status === ProposalStatus.DRAFT
            ? ProposalStatus.SENT
            : proposal.status,
        sentAt: new Date(),
      },
      include: this.includeAll(),
    });

    return {
      proposal: updated,
      publicUrl: url,
      notifyConfig: this.notify.configStatus(),
      attempts,
    };
  }

  async acceptPublic(token: string, optionId: string) {
    const proposal = await this.getByPublicToken(token);
    if (proposal.status === ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Proposta já aceita');
    }
    if (proposal.status === ProposalStatus.EXPIRED) {
      throw new BadRequestException('Proposta expirada');
    }
    if (
      proposal.status !== ProposalStatus.SENT &&
      proposal.status !== ProposalStatus.DRAFT
    ) {
      throw new BadRequestException('Proposta não está disponível para aceite');
    }

    const option = proposal.options.find((o) => o.id === optionId);
    if (!option) {
      throw new BadRequestException('Opção de período inválida');
    }
    if (!proposal.lines.length) {
      throw new BadRequestException('Proposta sem equipamentos');
    }
    const missing = proposal.lines.filter((l) => !l.equipmentId);
    if (missing.length) {
      throw new BadRequestException('Linhas sem equipamento');
    }

    const start = new Date();
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + option.durationDays);

    const contractCount = await this.prisma.contract.count();
    const contractNumber = `CTR-${String(contractCount + 1).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.proposalOption.updateMany({
        where: { proposalId: proposal.id },
        data: { selected: false },
      });
      await tx.proposalOption.update({
        where: { id: option.id },
        data: { selected: true },
      });

      const hoursNote = proposal.hoursUnlimited
        ? 'Horas: ilimitado'
        : `Horas: limite ${proposal.allowedHours}/período`;
      const contract = await tx.contract.create({
        data: {
          number: contractNumber,
          customerId: proposal.customerId,
          branchId: proposal.branchId,
          proposalId: proposal.id,
          status: ContractStatus.ACTIVE,
          billingPeriod: option.billingPeriod,
          billingTiming: proposal.billingTiming,
          allowedHours: proposal.allowedHours,
          hoursUnlimited: proposal.hoursUnlimited,
          startDate: start,
          endDate: end,
          notes: [
            `Aceite da proposta ${proposal.number}`,
            `Opção: ${option.label} (${option.durationDays} dias)`,
            hoursNote,
            proposal.notes ?? '',
          ]
            .filter(Boolean)
            .join(' · '),
          lines: {
            create: proposal.lines.map((line) => ({
              equipmentId: line.equipmentId!,
              description: `${line.description} · ${hoursNote}`,
              billingPeriod: option.billingPeriod,
              unitRate: option.unitRate,
              mobFee: option.mobFee,
              demobFee: option.demobFee,
            })),
          },
        },
        include: {
          customer: true,
          branch: true,
          lines: { include: { equipment: true } },
          proposal: true,
        },
      });

      for (const line of proposal.lines) {
        if (!line.equipmentId) continue;
        await tx.equipment.update({
          where: { id: line.equipmentId },
          data: { status: EquipmentStatus.ON_RENT },
        });
        await tx.calendarBlock.create({
          data: {
            equipmentId: line.equipmentId,
            branchId: proposal.branchId,
            contractId: contract.id,
            startDate: start,
            endDate: end,
            reason: 'CONTRACT',
          },
        });
      }

      const updated = await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: ProposalStatus.ACCEPTED,
          acceptedOptionId: option.id,
          acceptedAt: new Date(),
        },
        include: this.includeAll(),
      });

      return { proposal: updated, contract, publicUrl: this.publicUrl(token) };
    });
  }

  /** Manual convert kept for admin; prefers accepted option when present. */
  async convertToContract(
    id: string,
    startDate: string,
    endDate: string,
    billingTiming?: BillingTiming,
    optionId?: string,
  ) {
    const proposal = await this.get(id);
    const option =
      (optionId
        ? proposal.options.find((o) => o.id === optionId)
        : null) ??
      proposal.acceptedOption ??
      proposal.options[0];
    if (!option) {
      throw new BadRequestException('Proposta sem opção de período');
    }
    if (!proposal.lines.length) {
      throw new BadRequestException('Proposta sem linhas');
    }

    const timing = billingTiming ?? proposal.billingTiming;
    const count = await this.prisma.contract.count();
    const number = `CTR-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: {
          status: ProposalStatus.ACCEPTED,
          billingTiming: timing,
          acceptedOptionId: option.id,
          acceptedAt: new Date(),
        },
      });
      return tx.contract.create({
        data: {
          number,
          customerId: proposal.customerId,
          branchId: proposal.branchId,
          proposalId: proposal.id,
          status: ContractStatus.DRAFT,
          billingPeriod: option.billingPeriod,
          billingTiming: timing,
          allowedHours: proposal.allowedHours,
          hoursUnlimited: proposal.hoursUnlimited,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          notes: proposal.notes,
          lines: {
            create: proposal.lines.map((line) => ({
              equipmentId: line.equipmentId!,
              description: line.description,
              billingPeriod: option.billingPeriod,
              unitRate: option.unitRate,
              mobFee: option.mobFee,
              demobFee: option.demobFee,
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

  notifyConfig() {
    return this.notify.configStatus();
  }
}
