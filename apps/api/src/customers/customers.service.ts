import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export type CreateCustomerInput = {
  legalName: string;
  tradeName?: string | null;
  document: string;
  documentType?: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  street?: string | null;
  cep?: string | null;
  contactName?: string | null;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.customer.findMany({
      where: { deletedAt: null },
      include: {
        contacts: true,
        sites: true,
        _count: { select: { contracts: true, proposals: true } },
      },
      orderBy: { legalName: 'asc' },
    });
  }

  get(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        sites: true,
        contracts: true,
        proposals: true,
        invoices: true,
      },
    });
  }

  async create(input: CreateCustomerInput) {
    const legalName = input.legalName?.trim();
    const document = input.document?.trim();
    if (!legalName || !document) {
      throw new BadRequestException('Razão social e CNPJ/CPF são obrigatórios');
    }

    const digits = document.replace(/\D/g, '');
    const documentType =
      input.documentType || (digits.length <= 11 ? 'CPF' : 'CNPJ');

    const existing = await this.prisma.customer.findUnique({
      where: { document },
    });
    if (existing) {
      throw new ConflictException('Já existe cliente com este documento');
    }

    const city = input.city?.trim() || null;
    const state = input.state?.trim()?.toUpperCase() || null;
    const street = input.street?.trim() || null;

    return this.prisma.customer.create({
      data: {
        legalName,
        tradeName: input.tradeName?.trim() || legalName,
        document,
        documentType,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        city,
        state,
        contacts: input.contactName?.trim()
          ? {
              create: {
                name: input.contactName.trim(),
                email: input.email?.trim() || null,
                phone: input.phone?.trim() || null,
                role: 'commercial',
              },
            }
          : undefined,
        sites:
          street && city && state
            ? {
                create: {
                  name: 'Principal',
                  address: `${street}${input.cep ? ` · CEP ${input.cep}` : ''}`,
                  city,
                  state,
                },
              }
            : undefined,
      },
      include: {
        contacts: true,
        sites: true,
        _count: { select: { contracts: true, proposals: true } },
      },
    });
  }

  async getOrThrow(id: string) {
    const customer = await this.get(id);
    if (!customer || customer.deletedAt) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  async remove(
    id: string,
    actor: { userId: string; email: string },
    hard = false,
  ) {
    const customer = await this.getOrThrow(id);
    const openProps = await this.prisma.proposal.count({
      where: {
        customerId: id,
        deletedAt: null,
        status: { in: ['DRAFT', 'SENT', 'ACCEPTED'] },
      },
    });
    const openContracts = await this.prisma.contract.count({
      where: {
        customerId: id,
        deletedAt: null,
        status: { in: ['DRAFT', 'ACTIVE', 'SUSPENDED'] },
      },
    });

    if (hard) {
      if (openProps || openContracts) {
        throw new BadRequestException(
          'Exclusão permanente bloqueada: ainda há propostas ou contratos ativos. Use arquivar.',
        );
      }
      const anyHistory = await this.prisma.contract.count({
        where: { customerId: id },
      });
      if (anyHistory) {
        throw new BadRequestException(
          'Cliente possui histórico de contratos — use arquivar (soft-delete).',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.customerContact.deleteMany({ where: { customerId: id } });
        await tx.customerSite.deleteMany({ where: { customerId: id } });
        await tx.customer.delete({ where: { id } });
      });
      await this.audit.log({
        actorId: actor.userId,
        actorEmail: actor.email,
        action: 'DELETE_HARD',
        entityType: 'Customer',
        entityId: id,
        entityLabel: customer.legalName,
      });
      return { ok: true, mode: 'hard' as const, id, label: customer.legalName };
    }

    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: 'DELETE_SOFT',
      entityType: 'Customer',
      entityId: id,
      entityLabel: customer.legalName,
      detail:
        openProps || openContracts
          ? `archived with ${openProps} open proposals / ${openContracts} open contracts`
          : 'archived',
    });
    return { ok: true, mode: 'soft' as const, id, label: customer.legalName };
  }

  async update(id: string, input: CreateCustomerInput) {
    await this.getOrThrow(id);

    const legalName = input.legalName?.trim();
    const document = input.document?.trim();
    if (!legalName || !document) {
      throw new BadRequestException('Razão social e CNPJ/CPF são obrigatórios');
    }

    const digits = document.replace(/\D/g, '');
    const documentType =
      input.documentType || (digits.length <= 11 ? 'CPF' : 'CNPJ');

    const clash = await this.prisma.customer.findFirst({
      where: { document, NOT: { id } },
    });
    if (clash) {
      throw new ConflictException('Já existe cliente com este documento');
    }

    const city = input.city?.trim() || null;
    const state = input.state?.trim()?.toUpperCase() || null;
    const street = input.street?.trim() || null;
    const email = input.email?.trim() || null;
    const phone = input.phone?.trim() || null;
    const contactName = input.contactName?.trim() || null;
    const cep = input.cep?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          legalName,
          tradeName: input.tradeName?.trim() || legalName,
          document,
          documentType,
          email,
          phone,
          city,
          state,
        },
      });

      await tx.customerContact.deleteMany({ where: { customerId: id } });
      if (contactName) {
        await tx.customerContact.create({
          data: {
            customerId: id,
            name: contactName,
            email,
            phone,
            role: 'commercial',
          },
        });
      }

      await tx.customerSite.deleteMany({ where: { customerId: id } });
      if (street && city && state) {
        await tx.customerSite.create({
          data: {
            customerId: id,
            name: 'Principal',
            address: `${street}${cep ? ` · CEP ${cep}` : ''}`,
            city,
            state,
          },
        });
      }
    });

    return this.prisma.customer.findUniqueOrThrow({
      where: { id },
      include: {
        contacts: true,
        sites: true,
        _count: { select: { contracts: true, proposals: true } },
      },
    });
  }
}
