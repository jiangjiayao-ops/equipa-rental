import { Injectable } from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId?: string, availableOnly = false) {
    return this.prisma.equipment.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(availableOnly ? { status: EquipmentStatus.AVAILABLE } : {}),
      },
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
