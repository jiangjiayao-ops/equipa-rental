import { Injectable } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async today() {
    const [equipment, branches, overdueInvoices, mobilizations, workOrders, contracts] =
      await Promise.all([
        this.prisma.equipment.findMany({
          include: { category: true, branch: true },
          orderBy: { code: 'asc' },
        }),
        this.prisma.branch.findMany({
          include: { _count: { select: { equipment: true } } },
          orderBy: { code: 'asc' },
        }),
        this.prisma.invoice.findMany({
          where: {
            status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
            dueDate: { lt: new Date() },
          },
          include: { customer: true, contract: true },
          orderBy: { dueDate: 'asc' },
        }),
        this.prisma.mobilizationOrder.findMany({
          where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
          include: { equipment: true, branch: true, contract: true },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
        }),
        this.prisma.workOrder.findMany({
          where: { status: { in: ['SCHEDULED', 'OPEN'] } },
          include: { equipment: true },
          orderBy: { dueAt: 'asc' },
          take: 10,
        }),
        this.prisma.contract.count({ where: { status: 'ACTIVE' } }),
      ]);

    const statusCounts = equipment.reduce<Record<string, number>>((acc, eq) => {
      acc[eq.status] = (acc[eq.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      fleet: {
        total: equipment.length,
        available: statusCounts.AVAILABLE ?? 0,
        onRent: statusCounts.ON_RENT ?? 0,
        inTransit: statusCounts.IN_TRANSIT ?? 0,
        maintenance: statusCounts.MAINTENANCE ?? 0,
        reserved: statusCounts.RESERVED ?? 0,
        byStatus: statusCounts,
      },
      branches: branches.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        city: b.city,
        state: b.state,
        equipmentCount: b._count.equipment,
      })),
      activeContracts: contracts,
      overdueInvoices,
      mobilizations,
      maintenanceDue: workOrders,
    };
  }
}
