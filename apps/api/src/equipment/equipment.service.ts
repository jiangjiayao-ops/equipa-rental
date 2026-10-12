import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId?: string) {
    return this.prisma.equipment.findMany({
      where: branchId ? { branchId } : undefined,
      include: { category: true, branch: true },
      orderBy: { code: 'asc' },
    });
  }

  get(id: string) {
    return this.prisma.equipment.findUnique({
      where: { id },
      include: {
        category: true,
        branch: true,
        meterReadings: { orderBy: { recordedAt: 'desc' }, take: 5 },
        contractLines: {
          include: { contract: { include: { customer: true } } },
          take: 5,
        },
      },
    });
  }
}
