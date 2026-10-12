import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
