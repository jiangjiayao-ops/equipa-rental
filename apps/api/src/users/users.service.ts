import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export type UpsertUserInput = {
  name: string;
  email: string;
  password?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  role?: Role | string;
  active?: boolean;
  organizationId?: string;
};

const ROLES = new Set(Object.values(Role));

const publicSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  whatsapp: true,
  role: true,
  isMasterAdmin: true,
  active: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: publicSelect,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  /** Active commercial-capable users for proposal owner picker. */
  listAssignable() {
    return this.prisma.user.findMany({
      where: {
        active: true,
        role: { in: [Role.ADMIN, Role.COMMERCIAL] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        whatsapp: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicSelect,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  private normalizeRole(role?: string | Role) {
    const r = (role || Role.READ_ONLY).toString().toUpperCase() as Role;
    if (!ROLES.has(r)) throw new BadRequestException('Perfil inválido');
    return r;
  }

  private digitsPhone(value?: string | null) {
    if (!value?.trim()) return null;
    return value.trim();
  }

  async create(input: UpsertUserInput) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password?.trim();
    if (!name || !email) {
      throw new BadRequestException('Nome e e-mail são obrigatórios');
    }
    if (!password || password.length < 6) {
      throw new BadRequestException('Senha deve ter ao menos 6 caracteres');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe usuário com este e-mail');
    }

    let organizationId = input.organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst();
      if (!org) throw new BadRequestException('Organização não encontrada');
      organizationId = org.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        organizationId,
        name,
        email,
        passwordHash,
        phone: this.digitsPhone(input.phone),
        whatsapp: this.digitsPhone(input.whatsapp) || this.digitsPhone(input.phone),
        role: this.normalizeRole(input.role),
        active: input.active !== false,
      },
      select: publicSelect,
    });
  }

  async update(id: string, input: UpsertUserInput) {
    const existing = await this.getOrThrow(id);
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name || !email) {
      throw new BadRequestException('Nome e e-mail são obrigatórios');
    }

    const clash = await this.prisma.user.findFirst({
      where: { email, NOT: { id } },
    });
    if (clash) {
      throw new ConflictException('Já existe usuário com este e-mail');
    }

    if (existing.isMasterAdmin && input.active === false) {
      const masters = await this.prisma.user.count({
        where: { isMasterAdmin: true, active: true },
      });
      if (masters <= 1) {
        throw new BadRequestException(
          'Não é possível desativar o último master administrador',
        );
      }
    }

    const data: Record<string, unknown> = {
      name,
      email,
      phone: this.digitsPhone(input.phone),
      whatsapp: this.digitsPhone(input.whatsapp) || this.digitsPhone(input.phone),
      role: this.normalizeRole(input.role),
    };
    if (typeof input.active === 'boolean') data.active = input.active;
    if (input.password?.trim()) {
      if (input.password.trim().length < 6) {
        throw new BadRequestException('Senha deve ter ao menos 6 caracteres');
      }
      data.passwordHash = await bcrypt.hash(input.password.trim(), 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: publicSelect,
    });
  }
}
