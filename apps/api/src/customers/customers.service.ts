import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.customer.findMany({
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
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    return customer;
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
