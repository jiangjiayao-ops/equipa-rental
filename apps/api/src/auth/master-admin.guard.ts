import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MasterAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: { userId?: string; isMasterAdmin?: boolean };
    }>();
    const userId = req.user?.userId;
    if (!userId) {
      throw new ForbiddenException('Acesso restrito ao master admin');
    }

    if (req.user?.isMasterAdmin === true) return true;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isMasterAdmin: true, active: true },
    });
    if (!user?.active || !user.isMasterAdmin) {
      throw new ForbiddenException(
        'Somente o master administrador pode excluir estes registros',
      );
    }
    return true;
  }
}
