import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type UpdateBranchInput = {
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
        _count: { select: { equipment: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async get(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        organization: true,
        _count: { select: { equipment: true } },
      },
    });
    if (!branch) throw new NotFoundException('Filial não encontrada');
    return branch;
  }

  async update(id: string, input: UpdateBranchInput) {
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
        state: input.state,
        cep: input.cep,
        phone: input.phone,
        email: input.email,
      },
      include: {
        organization: true,
        _count: { select: { equipment: true } },
      },
    });
  }
}
