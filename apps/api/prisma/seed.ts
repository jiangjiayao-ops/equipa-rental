/**
 * Production-oriented seed:
 * - Org + branches + admin user
 * - Real fleet/customers/contracts from fleet-seed-raw.tsv
 * Does NOT load the old dummy Caterpillar/Bobcat demo fleet.
 */
import {
  BillingPeriod,
  BillingTiming,
  ContractStatus,
  EquipmentStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type FleetRow = {
  brand: string;
  model: string;
  serial: string;
  year: string;
  customer_name: string;
  customer_cnpj: string;
  date_a: string;
  date_b: string;
  term: string;
  end_date: string;
  monthly_rate_brl: string;
  field_12: string;
  field_25: string;
  hour_limit: string;
};

function findTsvPath(): string {
  const candidates = [
    path.resolve(__dirname, 'data/fleet-seed-raw.tsv'),
    path.resolve(__dirname, '../../../prisma/data/fleet-seed-raw.tsv'),
    '/cursor/stores/self/internal/fleet-seed-raw.tsv',
    '/cursor/stores/bc-01a11afc-ee81-70a3-851f-0de627ce71b1/internal/fleet-seed-raw.tsv',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`fleet-seed-raw.tsv not found. Tried:\n${candidates.join('\n')}`);
}

function parseTsv(filePath: string): FleetRow[] {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split('\t');
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split('\t');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? '').trim();
    });
    return row as FleetRow;
  });
}

/** Parse dates like 2026.04.06 or 2026-04-06 */
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const normalized = raw.replace(/\./g, '-');
  const d = new Date(`${normalized}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseYear(raw: string): number | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

function stableCode(brand: string, model: string, serial: string, index: number): string {
  if (serial) {
    const clean = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return `${brand.slice(0, 4).toUpperCase()}-${clean}`.slice(0, 40);
  }
  const slug = `${brand}-${model}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${String(index + 1).padStart(3, '0')}`.slice(0, 40);
}

function categoryFor(brand: string, model: string): { code: string; name: string; nameEn: string } {
  const m = model.toUpperCase();
  if (brand.toUpperCase() === 'HANGCHA' || m.startsWith('CPCD')) {
    return { code: 'FORK', name: 'Empilhadeira', nameEn: 'Forklift' };
  }
  if (m.startsWith('SR')) {
    return { code: 'ROLLER', name: 'Rolo compactador', nameEn: 'Compactor roller' };
  }
  return { code: 'LDR', name: 'Pá carregadeira', nameEn: 'Wheel loader' };
}

function buildNotes(row: FleetRow): string {
  const parts: string[] = [
    `term=${row.term || '24 months'}`,
    `billing=MONTHLY (monthly_rate_brl=${row.monthly_rate_brl})`,
  ];
  if (row.hour_limit) {
    parts.push(
      row.hour_limit.toLowerCase() === 'unlimited'
        ? 'hour_limit=Unlimited'
        : `hour_limit=${row.hour_limit}h/period (stored in notes; no dedicated schema field)`,
    );
  }
  // field_12 / field_25: no dedicated columns — keep explicitly
  if (row.field_12) {
    parts.push(`field_12=${row.field_12} (assumed payment day of month)`);
  }
  if (row.field_25) {
    parts.push(`field_25=${row.field_25} (source column; meaning unclear — retained)`);
  }
  if (row.date_a) parts.push(`date_a=${row.date_a}`);
  if (row.date_b) parts.push(`date_b=${row.date_b} (used as rental start when present)`);
  return parts.join(' | ');
}

async function wipeBusinessData() {
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
}

async function ensureOrgStructure() {
  let org = await prisma.organization.findFirst({ where: { cnpj: '12.345.678/0001-90' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Equipa Locações Industriais Ltda',
        tradeName: 'Equipa',
        cnpj: '12.345.678/0001-90',
        ie: '10.20.30-4',
        im: '123456',
        street: 'Av. Industrial, 1000',
        city: 'Guarulhos',
        state: 'SP',
        cep: '07034-000',
        phone: '+55 11 4000-1000',
        email: 'contato@equipa.com.br',
      },
    });
  } else {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: 'Equipa Locações Industriais Ltda',
        tradeName: 'Equipa',
        ie: org.ie ?? '10.20.30-4',
        im: org.im ?? '123456',
        street: org.street ?? 'Av. Industrial, 1000',
        city: org.city ?? 'Guarulhos',
        state: org.state ?? 'SP',
        cep: org.cep ?? '07034-000',
        phone: org.phone ?? '+55 11 4000-1000',
        email: org.email ?? 'contato@equipa.com.br',
      },
    });
  }

  let branch = await prisma.branch.findFirst({
    where: { organizationId: org.id, code: 'SP-01' },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        code: 'SP-01',
        name: 'Pátio Guarulhos',
        legalName: 'Equipa Locações Industriais Ltda',
        tradeName: 'Equipa Guarulhos',
        cnpj: '12.345.678/0001-90',
        ie: '10.20.30-4',
        im: '123456',
        street: 'Av. Industrial, 1000',
        city: 'Guarulhos',
        state: 'SP',
        cep: '07034-000',
        phone: '+55 11 4000-1000',
        email: 'sp01@equipa.com.br',
      },
    });
  } else {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        legalName: branch.legalName ?? 'Equipa Locações Industriais Ltda',
        tradeName: branch.tradeName ?? 'Equipa Guarulhos',
        cnpj: branch.cnpj ?? '12.345.678/0001-90',
        ie: branch.ie ?? '10.20.30-4',
        im: branch.im ?? '123456',
        street: branch.street ?? 'Av. Industrial, 1000',
        cep: branch.cep ?? '07034-000',
        phone: branch.phone ?? '+55 11 4000-1000',
        email: branch.email ?? 'sp01@equipa.com.br',
      },
    });
  }

  // Keep a second branch for multi-branch UX, but no dummy fleet on it
  const rj = await prisma.branch.findFirst({
    where: { organizationId: org.id, code: 'RJ-01' },
  });
  if (!rj) {
    await prisma.branch.create({
      data: {
        organizationId: org.id,
        code: 'RJ-01',
        name: 'Pátio Duque de Caxias',
        legalName: 'Equipa Locações Industriais Ltda',
        tradeName: 'Equipa Rio',
        cnpj: '12.345.678/0002-71',
        ie: '78.90.12-3',
        im: '654321',
        street: 'Rod. Washington Luís, 500',
        city: 'Duque de Caxias',
        state: 'RJ',
        cep: '25085-000',
        phone: '+55 21 4000-2000',
        email: 'rj01@equipa.com.br',
      },
    });
  } else {
    await prisma.branch.update({
      where: { id: rj.id },
      data: {
        legalName: rj.legalName ?? 'Equipa Locações Industriais Ltda',
        tradeName: rj.tradeName ?? 'Equipa Rio',
        cnpj: rj.cnpj ?? '12.345.678/0002-71',
        ie: rj.ie ?? '78.90.12-3',
        im: rj.im ?? '654321',
        street: rj.street ?? 'Rod. Washington Luís, 500',
        cep: rj.cep ?? '25085-000',
        phone: rj.phone ?? '+55 21 4000-2000',
        email: rj.email ?? 'rj01@equipa.com.br',
      },
    });
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.findUnique({ where: { email: 'admin@equipa.com.br' } });
  if (!admin) {
    await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'admin@equipa.com.br',
        passwordHash,
        name: 'Ana Admin',
        role: Role.ADMIN,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash, role: Role.ADMIN, active: true, organizationId: org.id },
    });
  }

  // Remove non-admin demo users if any remain
  await prisma.user.deleteMany({
    where: {
      email: { not: 'admin@equipa.com.br' },
    },
  });

  return { org, branch };
}

async function main() {
  const tsvPath = findTsvPath();
  const rows = parseTsv(tsvPath);
  console.log(`Loading ${rows.length} fleet rows from ${tsvPath}`);

  await wipeBusinessData();
  // Also clear extra branches beyond the ones we want? Keep org users wiped of demo roles above.
  const { branch } = await ensureOrgStructure();

  // Remove orphan branches from old seed (MG-01 etc.) after equipment wiped
  await prisma.branch.deleteMany({
    where: { code: { notIn: ['SP-01', 'RJ-01'] } },
  });

  const categoryCache = new Map<string, string>();
  async function getCategoryId(brand: string, model: string) {
    const meta = categoryFor(brand, model);
    if (categoryCache.has(meta.code)) return categoryCache.get(meta.code)!;
    const cat = await prisma.equipmentCategory.upsert({
      where: { code: meta.code },
      create: meta,
      update: { name: meta.name, nameEn: meta.nameEn },
    });
    categoryCache.set(meta.code, cat.id);
    return cat.id;
  }

  const customerCache = new Map<string, string>();
  async function getCustomerId(name: string, cnpj: string) {
    if (customerCache.has(cnpj)) return customerCache.get(cnpj)!;
    const existing = await prisma.customer.findUnique({ where: { document: cnpj } });
    if (existing) {
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: { legalName: name, tradeName: name, documentType: 'CNPJ' },
      });
      customerCache.set(cnpj, updated.id);
      return updated.id;
    }
    const created = await prisma.customer.create({
      data: {
        legalName: name,
        tradeName: name,
        document: cnpj,
        documentType: 'CNPJ',
      },
    });
    customerCache.set(cnpj, created.id);
    return created.id;
  }

  let equipmentCount = 0;
  let contractCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const categoryId = await getCategoryId(row.brand, row.model);
    const customerId = await getCustomerId(row.customer_name, row.customer_cnpj);
    const code = stableCode(row.brand, row.model, row.serial, i);
    const year = parseYear(row.year);
    const start =
      parseDate(row.date_b) ?? parseDate(row.date_a) ?? new Date('2026-01-01T12:00:00.000Z');
    const end = parseDate(row.end_date) ?? new Date(start.getTime() + 24 * 30 * 86400000);
    const monthlyRate = Number(row.monthly_rate_brl.replace(',', '')) || 0;
    const notes = buildNotes(row);

    const equipment = await prisma.equipment.upsert({
      where: { code },
      create: {
        code,
        categoryId,
        branchId: branch.id,
        brand: row.brand,
        model: row.model,
        year: year ?? undefined,
        serialNumber: row.serial || null,
        status: EquipmentStatus.ON_RENT,
        hourMeter: 0,
      },
      update: {
        categoryId,
        branchId: branch.id,
        brand: row.brand,
        model: row.model,
        year: year ?? undefined,
        serialNumber: row.serial || null,
        status: EquipmentStatus.ON_RENT,
      },
    });
    equipmentCount += 1;

    const contractNumber = `CTR-REAL-${String(i + 1).padStart(3, '0')}`;
    // Idempotent: delete prior contract with same number, then recreate
    const prior = await prisma.contract.findUnique({ where: { number: contractNumber } });
    if (prior) {
      await prisma.calendarBlock.deleteMany({ where: { contractId: prior.id } });
      await prisma.contractLine.deleteMany({ where: { contractId: prior.id } });
      await prisma.contract.delete({ where: { id: prior.id } });
    }

    const hourNote =
      row.hour_limit.toLowerCase() === 'unlimited'
        ? 'Horas: ilimitado'
        : row.hour_limit
          ? `Horas: limite ${row.hour_limit}/período`
          : '';

    // Default ADVANCE (pay in advance) — standard for equipment rentals.
    // Notes do not imply arrears for this fleet seed, so all 7 use ADVANCE.
    const contract = await prisma.contract.create({
      data: {
        number: contractNumber,
        customerId,
        branchId: branch.id,
        status: ContractStatus.ACTIVE,
        billingPeriod: BillingPeriod.MONTHLY,
        billingTiming: BillingTiming.ADVANCE,
        startDate: start,
        endDate: end,
        depositAmount: 0,
        notes,
        lines: {
          create: {
            equipmentId: equipment.id,
            description: `${row.brand} ${row.model}${row.serial ? ` · SN ${row.serial}` : ` · code ${code}`}${hourNote ? ` · ${hourNote}` : ''}`,
            billingPeriod: BillingPeriod.MONTHLY,
            unitRate: monthlyRate,
            mobFee: 0,
            demobFee: 0,
          },
        },
        calendarBlocks: {
          create: {
            equipmentId: equipment.id,
            branchId: branch.id,
            startDate: start,
            endDate: end,
            reason: 'CONTRACT',
          },
        },
      },
    });
    contractCount += 1;
    console.log(`  ${contract.number}: ${equipment.code} → ${row.customer_name} @ R$ ${monthlyRate}`);
  }

  const customers = await prisma.customer.count();
  console.log('\nSeed complete (real fleet only)');
  console.log({
    customers,
    equipment: equipmentCount,
    contracts: contractCount,
    admin: 'admin@equipa.com.br / admin123',
  });
  console.log('Mapping notes:');
  console.log('- monthly_rate_brl → ContractLine.unitRate with billingPeriod=MONTHLY');
  console.log('- start = date_b ?? date_a; end = end_date');
  console.log('- hour_limit / field_12 / field_25 → Contract.notes (+ hour note on line description)');
  console.log('- field_12 assumed payment day; field_25 retained with unknown meaning');
  console.log('- billingTiming default ADVANCE (pay in advance) on all seeded contracts');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
