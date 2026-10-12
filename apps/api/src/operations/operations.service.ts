import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  mobilizations() {
    return this.prisma.mobilizationOrder.findMany({
      include: {
        equipment: true,
        branch: true,
        contract: { include: { customer: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  transfers() {
    return this.prisma.branchTransfer.findMany({
      include: {
        equipment: true,
        fromBranch: true,
        toBranch: true,
      },
      orderBy: { transferredAt: 'desc' },
    });
  }
}
