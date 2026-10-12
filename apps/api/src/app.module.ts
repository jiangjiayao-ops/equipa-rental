import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { CalendarModule } from './calendar/calendar.module';
import { ContractsModule } from './contracts/contracts.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EquipmentModule } from './equipment/equipment.module';
import { FinanceModule } from './finance/finance.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { OperationsModule } from './operations/operations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProposalsModule } from './proposals/proposals.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DashboardModule,
    BranchesModule,
    EquipmentModule,
    CustomersModule,
    ProposalsModule,
    ContractsModule,
    CalendarModule,
    OperationsModule,
    FinanceModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
