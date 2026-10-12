import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.branch.findMany({
      include: { _count: { select: { equipment: true } } },
      orderBy: { code: 'asc' },
    });
  }
}
