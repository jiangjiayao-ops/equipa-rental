import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  plans() {
    return this.prisma.maintenancePlan.findMany({
      include: { workOrders: true },
      orderBy: { name: 'asc' },
    });
  }

  workOrders() {
    return this.prisma.workOrder.findMany({
      include: {
        equipment: { include: { branch: true } },
        plan: true,
      },
      orderBy: { dueAt: 'asc' },
    });
  }
}
