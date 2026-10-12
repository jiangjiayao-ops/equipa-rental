import { Injectable } from '@nestjs/common';
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
}
