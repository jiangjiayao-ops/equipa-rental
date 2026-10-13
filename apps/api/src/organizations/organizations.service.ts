import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type UpdateOrganizationInput = {
  name?: string;
  tradeName?: string | null;
  cnpj?: string;
  ie?: string | null;
  im?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  phone?: string | null;
  email?: string | null;
};

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent() {
    const org = await this.prisma.organization.findFirst({
      include: {
        branches: { orderBy: { code: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!org) throw new NotFoundException('Organização não encontrada');
    return org;
  }

  async updateCurrent(input: UpdateOrganizationInput) {
    const org = await this.getCurrent();
    return this.prisma.organization.update({
      where: { id: org.id },
      data: {
        name: input.name,
        tradeName: input.tradeName,
        cnpj: input.cnpj,
        ie: input.ie,
        im: input.im,
        street: input.street,
        city: input.city,
        state: input.state,
        cep: input.cep,
        phone: input.phone,
        email: input.email,
      },
      include: {
        branches: { orderBy: { code: 'asc' } },
      },
    });
  }
}
