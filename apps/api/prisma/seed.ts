import {
  BillingPeriod,
  ContractStatus,
  EquipmentStatus,
  FiscalDocStatus,
  FiscalDocType,
  InvoiceStatus,
  MobilizationStatus,
  MobilizationType,
  PaymentMethod,
  PrismaClient,
  ProposalStatus,
  Role,
  WorkOrderStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.payment.deleteMany();
  await prisma.fiscalDocument.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.maintenancePlan.deleteMany();
  await prisma.mobilizationOrder.deleteMany();
  await prisma.branchTransfer.deleteMany();
  await prisma.calendarBlock.deleteMany();
  await prisma.contractAmendment.deleteMany();
  await prisma.contractLine.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.proposalLine.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.rateCard.deleteMany();
  await prisma.equipmentCategory.deleteMany();
  await prisma.customerContact.deleteMany();
  await prisma.customerSite.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: 'Equipa Locações Industriais Ltda',
      tradeName: 'Equipa',
      cnpj: '12.345.678/0001-90',
    },
  });

  const [sp, rj, mg] = await Promise.all([
    prisma.branch.create({
      data: {
        organizationId: org.id,
        code: 'SP-01',
        name: 'Pátio Guarulhos',
        city: 'Guarulhos',
        state: 'SP',
      },
    }),
    prisma.branch.create({
      data: {
        organizationId: org.id,
        code: 'RJ-01',
        name: 'Pátio Duque de Caxias',
        city: 'Duque de Caxias',
        state: 'RJ',
      },
    }),
    prisma.branch.create({
      data: {
        organizationId: org.id,
        code: 'MG-01',
        name: 'Pátio Contagem',
        city: 'Contagem',
        state: 'MG',
      },
    }),
  ]);

  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'admin@equipa.com.br',
      passwordHash,
      name: 'Ana Admin',
      role: Role.ADMIN,
    },
  });

  const categories = await Promise.all(
    [
      { code: 'EXC', name: 'Escavadeira', nameEn: 'Excavator' },
      { code: 'LDR', name: 'Pá carregadeira', nameEn: 'Wheel loader' },
      { code: 'AER', name: 'Plataforma aérea', nameEn: 'Aerial platform' },
      { code: 'SKD', name: 'Mini carregadeira', nameEn: 'Skid steer' },
      { code: 'BRT', name: 'Britador móvel', nameEn: 'Mobile crusher' },
      { code: 'RET', name: 'Retroescavadeira', nameEn: 'Backhoe' },
    ].map((c) => prisma.equipmentCategory.create({ data: c })),
  );

  const byCode = Object.fromEntries(categories.map((c) => [c.code, c]));

  for (const cat of categories) {
    await prisma.rateCard.create({
      data: {
        categoryId: cat.id,
        name: `Tabela ${cat.name}`,
        weeklyRate: 8500,
        monthlyRate: 28000,
        yearlyRate: 280000,
      },
    });
  }

  const machines = [
    { code: 'EXC-210-01', category: 'EXC', branch: sp, brand: 'Caterpillar', model: '320 GC', year: 2021, hours: 4120, status: EquipmentStatus.AVAILABLE },
    { code: 'EXC-320-02', category: 'EXC', branch: sp, brand: 'Caterpillar', model: '320 GC', year: 2022, hours: 2890, status: EquipmentStatus.ON_RENT },
    { code: 'LDR-966-01', category: 'LDR', branch: sp, brand: 'Caterpillar', model: '966M', year: 2020, hours: 6100, status: EquipmentStatus.AVAILABLE },
    { code: 'AER-26-01', category: 'AER', branch: sp, brand: 'JLG', model: '600AJ', year: 2023, hours: 980, status: EquipmentStatus.IN_TRANSIT },
    { code: 'SKD-262-01', category: 'SKD', branch: sp, brand: 'Bobcat', model: 'S770', year: 2022, hours: 1540, status: EquipmentStatus.RESERVED },
    { code: 'BRT-QJ341', category: 'BRT', branch: rj, brand: 'Sandvik', model: 'QJ341', year: 2019, hours: 8200, status: EquipmentStatus.AVAILABLE },
    { code: 'RET-416-01', category: 'RET', branch: rj, brand: 'Caterpillar', model: '416F2', year: 2021, hours: 3300, status: EquipmentStatus.AVAILABLE },
    { code: 'EXC-140-01', category: 'EXC', branch: mg, brand: 'Volvo', model: 'EC140E', year: 2022, hours: 2100, status: EquipmentStatus.AVAILABLE },
    { code: 'LDR-950-01', category: 'LDR', branch: mg, brand: 'Komatsu', model: 'WA380', year: 2020, hours: 5400, status: EquipmentStatus.MAINTENANCE },
    { code: 'AER-18-01', category: 'AER', branch: mg, brand: 'Genie', model: 'S-85', year: 2021, hours: 1760, status: EquipmentStatus.AVAILABLE },
  ] as const;

  const equipmentRows = [];
  for (const m of machines) {
    const eq = await prisma.equipment.create({
      data: {
        code: m.code,
        categoryId: byCode[m.category].id,
        branchId: m.branch.id,
        brand: m.brand,
        model: m.model,
        year: m.year,
        serialNumber: `${m.code}-SN`,
        hourMeter: m.hours,
        status: m.status,
      },
    });
    equipmentRows.push(eq);
    await prisma.meterReading.create({
      data: { equipmentId: eq.id, hours: m.hours, source: 'seed' },
    });
  }

  const eqByCode = Object.fromEntries(equipmentRows.map((e) => [e.code, e]));

  const customer = await prisma.customer.create({
    data: {
      legalName: 'Construtora Horizonte Amazônia S.A.',
      tradeName: 'Horizonte Amazônia',
      document: '45.678.901/0001-23',
      email: 'compras@horizonteamazonia.com.br',
      phone: '+55 11 4002-8922',
      city: 'São Paulo',
      state: 'SP',
      contacts: {
        create: {
          name: 'Carlos Mendes',
          email: 'carlos.mendes@horizonteamazonia.com.br',
          phone: '+55 11 98888-1000',
          role: 'Compras',
        },
      },
      sites: {
        create: {
          name: 'Obra Guarulhos Norte',
          address: 'Av. Marginal Tietê, 4500',
          city: 'Guarulhos',
          state: 'SP',
        },
      },
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      legalName: 'Mineração Vale Verde Ltda',
      tradeName: 'Vale Verde',
      document: '98.765.432/0001-10',
      email: 'ops@valeverde.com.br',
      city: 'Contagem',
      state: 'MG',
    },
  });

  const proposal = await prisma.proposal.create({
    data: {
      number: 'PROP-2026-0001',
      customerId: customer.id,
      branchId: sp.id,
      status: ProposalStatus.ACCEPTED,
      validUntil: new Date('2026-02-01'),
      notes: 'Locação escavadeira 320 para obra Guarulhos',
      lines: {
        create: {
          equipmentId: eqByCode['EXC-320-02'].id,
          description: 'EXC-320-02 — Caterpillar 320 GC',
          billingPeriod: BillingPeriod.YEARLY,
          unitRate: 245000,
          mobFee: 8500,
          demobFee: 8500,
        },
      },
    },
  });

  await prisma.proposal.create({
    data: {
      number: 'PROP-2026-0002',
      customerId: customer2.id,
      branchId: mg.id,
      status: ProposalStatus.SENT,
      validUntil: new Date('2026-11-01'),
      lines: {
        create: {
          equipmentId: eqByCode['EXC-140-01'].id,
          description: 'EXC-140-01 — Volvo EC140E',
          billingPeriod: BillingPeriod.MONTHLY,
          unitRate: 28000,
          mobFee: 4500,
          demobFee: 4500,
        },
      },
    },
  });

  const contract = await prisma.contract.create({
    data: {
      number: 'CTR-2026-0001',
      customerId: customer.id,
      branchId: sp.id,
      proposalId: proposal.id,
      status: ContractStatus.ACTIVE,
      billingPeriod: BillingPeriod.MONTHLY,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2027-04-15'),
      depositAmount: 50000,
      notes: 'Contrato ativo após renovação com mudança de período',
      lines: {
        create: {
          equipmentId: eqByCode['EXC-320-02'].id,
          description: 'EXC-320-02 — Caterpillar 320 GC',
          billingPeriod: BillingPeriod.MONTHLY,
          unitRate: 28000,
          mobFee: 8500,
          demobFee: 8500,
        },
      },
      amendments: {
        create: {
          type: 'renewal_period_change',
          notes: 'renewal_period_change: YEARLY → MONTHLY',
          fromPeriod: BillingPeriod.YEARLY,
          toPeriod: BillingPeriod.MONTHLY,
        },
      },
    },
  });

  await prisma.calendarBlock.create({
    data: {
      equipmentId: eqByCode['EXC-320-02'].id,
      branchId: sp.id,
      contractId: contract.id,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2027-04-15'),
      reason: 'Contrato CTR-2026-0001',
    },
  });

  await prisma.calendarBlock.create({
    data: {
      equipmentId: eqByCode['SKD-262-01'].id,
      branchId: sp.id,
      startDate: new Date('2026-10-10'),
      endDate: new Date('2026-10-25'),
      reason: 'Reserva comercial',
    },
  });

  await prisma.mobilizationOrder.create({
    data: {
      contractId: contract.id,
      equipmentId: eqByCode['EXC-320-02'].id,
      branchId: sp.id,
      type: MobilizationType.TO_SITE,
      status: MobilizationStatus.COMPLETED,
      scheduledAt: new Date('2026-01-14'),
      completedAt: new Date('2026-01-15'),
      carrier: 'Transpesados SP',
      cost: 8500,
      siteAddress: 'Obra Guarulhos Norte',
    },
  });

  await prisma.mobilizationOrder.create({
    data: {
      contractId: contract.id,
      equipmentId: eqByCode['AER-26-01'].id,
      branchId: sp.id,
      type: MobilizationType.TO_SITE,
      status: MobilizationStatus.IN_PROGRESS,
      scheduledAt: new Date('2026-10-12'),
      carrier: 'Iça Fácil',
      cost: 3200,
      siteAddress: 'Obra Guarulhos Norte',
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      number: 'FAT-2026-0001',
      customerId: customer.id,
      contractId: contract.id,
      status: InvoiceStatus.PARTIALLY_PAID,
      issueDate: new Date('2026-02-01'),
      dueDate: new Date('2026-03-03'),
      totalAmount: 245000,
      notes: 'Fatura anual convertida + períodos mensais',
      lines: {
        create: [
          {
            description: 'Locação anual EXC-320-02 (período inicial)',
            quantity: 1,
            unitAmount: 245000,
            totalAmount: 245000,
          },
        ],
      },
      payments: {
        create: [
          {
            method: PaymentMethod.PIX,
            amount: 100000,
            paidAt: new Date('2026-02-05'),
            externalRef: 'E2EPIXHORIZONTE001',
          },
          {
            method: PaymentMethod.BOLETO,
            amount: 50000,
            paidAt: new Date('2026-10-08'),
            externalRef: 'BOL-FAT-2026-0001-02',
          },
        ],
      },
      fiscalDocs: {
        create: {
          type: FiscalDocType.NFS_E,
          status: FiscalDocStatus.AUTHORIZED,
          provider: 'mock',
          providerRef: `MOCK-NFSE-FAT-2026-0001-${Date.now()}`,
          accessKey: 'NFS-E-MOCK-KEY-FAT-2026-0001',
          authorizedAt: new Date(),
          payloadJson: JSON.stringify({ mock: true, invoice: 'FAT-2026-0001' }),
        },
      },
    },
  });

  await prisma.invoice.create({
    data: {
      number: 'FAT-2026-0002',
      customerId: customer.id,
      contractId: contract.id,
      status: InvoiceStatus.ISSUED,
      issueDate: new Date('2026-10-01'),
      dueDate: new Date('2026-10-31'),
      totalAmount: 28000,
      lines: {
        create: {
          description: 'Locação mensal EXC-320-02 — out/2026',
          quantity: 1,
          unitAmount: 28000,
          totalAmount: 28000,
        },
      },
    },
  });

  const plan = await prisma.maintenancePlan.create({
    data: {
      name: 'Revisão 250h — Pá carregadeira',
      equipmentCode: 'LDR-950-01',
      everyHours: 250,
      everyDays: 90,
    },
  });

  await prisma.workOrder.create({
    data: {
      planId: plan.id,
      equipmentId: eqByCode['LDR-950-01'].id,
      title: 'Troca de filtros e revisão hidráulica',
      status: WorkOrderStatus.OPEN,
      dueAt: new Date('2026-10-15'),
      notes: 'Máquina em pátio Contagem',
    },
  });

  await prisma.workOrder.create({
    data: {
      equipmentId: eqByCode['BRT-QJ341'].id,
      title: 'Inspeção preventiva britador',
      status: WorkOrderStatus.SCHEDULED,
      dueAt: new Date('2026-10-20'),
    },
  });

  console.log('Seed OK');
  console.log('Login: admin@equipa.com.br / admin123');
  console.log(`Invoice sample: ${invoice.number}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
