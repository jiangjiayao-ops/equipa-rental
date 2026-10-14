import { Global, Module } from '@nestjs/common';
import { MasterAdminGuard } from '../auth/master-admin.guard';
import { AuditLogsController } from './audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [AuditService, MasterAdminGuard],
  exports: [AuditService, MasterAdminGuard],
})
export class AuditModule {}
