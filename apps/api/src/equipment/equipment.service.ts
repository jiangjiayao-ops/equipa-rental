import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export type UpsertEquipmentInput = {
  code?: string | null;
  categoryId: string;
  branchId: string;
  brand: string;
  model: string;
  year?: number | null;
  serialNumber?: string | null;
  vin?: string | null;
  frameNumber?: string | null;
  plate?: string | null;
  hourMeter?: number | null;
  status?: EquipmentStatus | string | null;
  notes?: string | null;
};

const STATUSES = new Set(Object.values(EquipmentStatus));

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(branchId?: string, availableOnly = false) {
    return this.prisma.equipment.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(availableOnly ? { status: EquipmentStatus.AVAILABLE } : {}),
      },
      include: { category: true, branch: true },
      orderBy: { code: 'asc' },
    });
  }

  listCategories() {
    return this.prisma.equipmentCategory.findMany({
      orderBy: { name: 'asc' },
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

  async getOrThrow(id: string) {
    const equipment = await this.get(id);
    if (!equipment || equipment.deletedAt) {
      throw new NotFoundException('Equipamento não encontrado');
    }
    return equipment;
  }

  /**
   * mode: sold | retired | unavailable (soft) | hard
   * Soft sets status + deletedAt (hidden from active fleet).
   */
  async remove(
    id: string,
    actor: { userId: string; email: string },
    mode: 'sold' | 'retired' | 'unavailable' | 'hard' = 'retired',
  ) {
    const equipment = await this.getOrThrow(id);

    if (mode === 'hard') {
      const used =
        (await this.prisma.proposalLine.count({
          where: { equipmentId: id },
        })) +
        (await this.prisma.contractLine.count({
          where: { equipmentId: id },
        }));
      if (used > 0) {
        throw new BadRequestException(
          'Exclusão permanente bloqueada: equipamento já usado em propostas/contratos. Use sold/retired.',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.meterReading.deleteMany({ where: { equipmentId: id } });
        await tx.equipment.delete({ where: { id } });
      });
      await this.audit.log({
        actorId: actor.userId,
        actorEmail: actor.email,
        action: 'DELETE_HARD',
        entityType: 'Equipment',
        entityId: id,
        entityLabel: equipment.code,
      });
      return { ok: true, mode: 'hard' as const, id, label: equipment.code };
    }

    const status =
      mode === 'sold'
        ? EquipmentStatus.SOLD
        : mode === 'unavailable'
          ? EquipmentStatus.UNAVAILABLE
          : EquipmentStatus.RETIRED;

    await this.prisma.equipment.update({
      where: { id },
      data: { status, deletedAt: new Date() },
    });
    await this.audit.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: 'RETIRE',
      entityType: 'Equipment',
      entityId: id,
      entityLabel: equipment.code,
      detail: `mode=${mode} status=${status}`,
    });
    return {
      ok: true,
      mode: mode as 'sold' | 'retired' | 'unavailable',
      id,
      label: equipment.code,
      status,
    };
  }

  private async nextCode() {
    const count = await this.prisma.equipment.count();
    for (let i = count + 1; i < count + 1000; i++) {
      const code = `EQ-${String(i).padStart(4, '0')}`;
      const exists = await this.prisma.equipment.findUnique({ where: { code } });
      if (!exists) return code;
    }
    return `EQ-${Date.now().toString(36).toUpperCase()}`;
  }

  private normalize(input: UpsertEquipmentInput) {
    const brand = input.brand?.trim();
    const model = input.model?.trim();
    if (!brand || !model) {
      throw new BadRequestException('Marca e modelo são obrigatórios');
    }
    if (!input.categoryId?.trim()) {
      throw new BadRequestException('Categoria é obrigatória');
    }
    if (!input.branchId?.trim()) {
      throw new BadRequestException('Filial é obrigatória');
    }

    let year: number | null = null;
    if (input.year != null && String(input.year) !== '') {
      year = Number(input.year);
      if (!Number.isFinite(year) || year < 1950 || year > 2100) {
        throw new BadRequestException('Ano de fabricação inválido');
      }
    }

    let status: EquipmentStatus = EquipmentStatus.AVAILABLE;
    if (input.status) {
      const s = String(input.status).toUpperCase() as EquipmentStatus;
      if (!STATUSES.has(s)) {
        throw new BadRequestException('Status inválido');
      }
      status = s;
    }

    const hourMeter =
      input.hourMeter != null && String(input.hourMeter) !== ''
        ? Number(input.hourMeter)
        : 0;
    if (!Number.isFinite(hourMeter) || hourMeter < 0) {
      throw new BadRequestException('Horímetro inválido');
    }

    return {
      brand,
      model,
      categoryId: input.categoryId.trim(),
      branchId: input.branchId.trim(),
      year,
      serialNumber: input.serialNumber?.trim() || null,
      vin: input.vin?.trim() || null,
      frameNumber: input.frameNumber?.trim() || null,
      plate: input.plate?.trim() || null,
      hourMeter,
      status,
      notes: input.notes?.trim() || null,
      code: input.code?.trim() || null,
    };
  }

  async create(input: UpsertEquipmentInput) {
    const data = this.normalize(input);

    const [category, branch] = await Promise.all([
      this.prisma.equipmentCategory.findUnique({
        where: { id: data.categoryId },
      }),
      this.prisma.branch.findUnique({ where: { id: data.branchId } }),
    ]);
    if (!category) throw new BadRequestException('Categoria inválida');
    if (!branch) throw new BadRequestException('Filial inválida');

    const code = data.code || (await this.nextCode());
    const existing = await this.prisma.equipment.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Já existe equipamento com código ${code}`);
    }

    return this.prisma.equipment.create({
      data: {
        code,
        categoryId: data.categoryId,
        branchId: data.branchId,
        brand: data.brand,
        model: data.model,
        year: data.year,
        serialNumber: data.serialNumber,
        vin: data.vin,
        frameNumber: data.frameNumber,
        plate: data.plate,
        hourMeter: data.hourMeter,
        status: data.status,
        notes: data.notes,
      },
      include: { category: true, branch: true },
    });
  }

  async update(id: string, input: UpsertEquipmentInput) {
    await this.getOrThrow(id);
    const data = this.normalize(input);

    const [category, branch] = await Promise.all([
      this.prisma.equipmentCategory.findUnique({
        where: { id: data.categoryId },
      }),
      this.prisma.branch.findUnique({ where: { id: data.branchId } }),
    ]);
    if (!category) throw new BadRequestException('Categoria inválida');
    if (!branch) throw new BadRequestException('Filial inválida');

    if (data.code) {
      const clash = await this.prisma.equipment.findFirst({
        where: { code: data.code, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException(`Já existe equipamento com código ${data.code}`);
      }
    }

    return this.prisma.equipment.update({
      where: { id },
      data: {
        ...(data.code ? { code: data.code } : {}),
        categoryId: data.categoryId,
        branchId: data.branchId,
        brand: data.brand,
        model: data.model,
        year: data.year,
        serialNumber: data.serialNumber,
        vin: data.vin,
        frameNumber: data.frameNumber,
        plate: data.plate,
        hourMeter: data.hourMeter,
        status: data.status,
        notes: data.notes,
      },
      include: { category: true, branch: true },
    });
  }
}
