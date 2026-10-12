import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId?: string) {
    return this.prisma.calendarBlock.findMany({
      where: branchId ? { branchId } : undefined,
      include: {
        equipment: true,
        branch: true,
        contract: { include: { customer: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }
}
