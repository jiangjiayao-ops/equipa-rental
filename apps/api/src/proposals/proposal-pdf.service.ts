import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

type Locale = 'pt-BR' | 'en';

const copy = {
  'pt-BR': {
    title: 'Proposta comercial',
    customer: 'Cliente',
    branch: 'Filial',
    proposalBranch: 'Filial da proposta',
    machineBranches: 'Filiais das máquinas',
    status: 'Status',
    validity: 'Validade',
    billingTiming: 'Faturamento',
    advance: 'Antecipado',
    arrears: 'Após o período',
    equipment: 'Equipamentos',
    code: 'Código',
    brand: 'Marca',
    model: 'Modelo',
    serial: 'Série',
    hours: 'Horas permitidas',
    unlimited: 'Ilimitado',
    options: 'Opções de período',
    rate: 'Taxa',
    mob: 'Mobilização',
    demob: 'Desmobilização',
    days: 'dias',
    notes: 'Observações',
    weekly: 'Semanal',
    monthly: 'Mensal',
    yearly: 'Anual',
    contact: 'Contato comercial',
    phone: 'Telefone',
    whatsapp: 'WhatsApp',
    email: 'E-mail',
  },
  en: {
    title: 'Commercial proposal',
    customer: 'Customer',
    branch: 'Branch',
    proposalBranch: 'Proposal branch',
    machineBranches: 'Machine branches',
    status: 'Status',
    validity: 'Valid until',
    billingTiming: 'Billing timing',
    advance: 'Pay in advance',
    arrears: 'Pay in arrears',
    equipment: 'Equipment',
    code: 'Code',
    brand: 'Brand',
    model: 'Model',
    serial: 'Serial',
    hours: 'Allowed working hours',
    unlimited: 'Unlimited',
    options: 'Period options',
    rate: 'Rate',
    mob: 'Mobilization',
    demob: 'Demobilization',
    days: 'days',
    notes: 'Notes',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    contact: 'Commercial contact',
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    email: 'Email',
  },
} as const;

function waDigits(raw?: string | null) {
  if (!raw) return '';
  let d = raw.replace(/\D/g, '');
  if (d.length >= 10 && d.length <= 11) d = `55${d}`;
  return d;
}

function whatsappUrl(
  number: string | null | undefined,
  proposalNumber: string,
  locale: Locale,
) {
  const digits = waDigits(number);
  if (!digits) return null;
  const text =
    locale === 'en'
      ? `Hello, regarding proposal ${proposalNumber}`
      : `Olá, ref. proposta ${proposalNumber}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n);
}

function periodLabel(period: string, locale: Locale) {
  const t = copy[locale];
  if (period === 'WEEKLY') return t.weekly;
  if (period === 'YEARLY') return t.yearly;
  return t.monthly;
}

@Injectable()
export class ProposalPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async build(id: string, locale: Locale = 'pt-BR'): Promise<Buffer> {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        customer: true,
        branch: true,
        owner: {
          select: {
            name: true,
            email: true,
            phone: true,
            whatsapp: true,
          },
        },
        lines: {
          include: {
            equipment: { include: { branch: true } },
          },
        },
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');

    const loc: Locale = locale === 'en' ? 'en' : 'pt-BR';
    const t = copy[loc];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fillColor('#15241e').fontSize(20).text('Equipa', { continued: false });
    doc.fillColor('#b8862e').fontSize(14).text(t.title, { continued: false });
    doc.moveDown(0.3);
    doc.fillColor('#15241e').fontSize(16).text(proposal.number);
    doc.moveDown(0.6);

    doc.fontSize(11).fillColor('#4f6a5e');
    doc.text(`${t.customer}: ${proposal.customer.legalName}`);
    if (proposal.customer.document) {
      doc.text(`CNPJ/CPF: ${proposal.customer.document}`);
    }
    doc.text(
      `${t.proposalBranch}: ${proposal.branch.code} — ${proposal.branch.name}` +
        (proposal.branch.city
          ? ` (${proposal.branch.city}/${proposal.branch.state})`
          : ''),
    );
    if (proposal.branch.cnpj) {
      doc.text(`CNPJ filial: ${proposal.branch.cnpj}`);
    }
    if (proposal.branch.phone || proposal.branch.email) {
      doc.text(
        [proposal.branch.phone, proposal.branch.email].filter(Boolean).join(' · '),
      );
    }
    doc.text(`${t.status}: ${proposal.status}`);
    doc.text(
      `${t.billingTiming}: ${
        proposal.billingTiming === 'ARREARS' ? t.arrears : t.advance
      }`,
    );
    doc.text(
      `${t.hours}: ${
        proposal.hoursUnlimited ? t.unlimited : String(proposal.allowedHours)
      }`,
    );
    if (proposal.validUntil) {
      doc.text(
        `${t.validity}: ${proposal.validUntil.toISOString().slice(0, 10)}`,
      );
    }
    if (proposal.owner) {
      doc.moveDown(0.4);
      doc.fillColor('#15241e').fontSize(12).text(t.contact);
      doc.fontSize(11).fillColor('#4f6a5e');
      doc.text(proposal.owner.name);
      if (proposal.owner.phone) {
        doc.text(`${t.phone}: ${proposal.owner.phone}`);
      }
      if (proposal.owner.email) {
        doc.text(`${t.email}: ${proposal.owner.email}`);
      }
      const wa = whatsappUrl(
        proposal.owner.whatsapp || proposal.owner.phone,
        proposal.number,
        loc,
      );
      if (wa) {
        doc.text(`${t.whatsapp}: ${wa}`);
      }
    }
    doc.moveDown(0.8);

    const machineBranches = new Map<string, string>();
    for (const line of proposal.lines) {
      const b = line.equipment?.branch;
      if (b) machineBranches.set(b.code, `${b.code} — ${b.name}`);
    }
    if (machineBranches.size) {
      doc.fillColor('#15241e').fontSize(13).text(t.machineBranches);
      doc.moveDown(0.2);
      doc.fontSize(11).fillColor('#4f6a5e');
      for (const label of machineBranches.values()) {
        doc.text(`• ${label}`);
      }
      doc.moveDown(0.6);
    }

    doc.fillColor('#15241e').fontSize(13).text(t.equipment);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#15241e');
    for (const line of proposal.lines) {
      const eq = line.equipment;
      if (!eq) {
        doc.text(`• ${line.description}`);
        continue;
      }
      doc.text(
        `• ${eq.code} — ${eq.brand} ${eq.model}` +
          (eq.serialNumber ? ` · ${t.serial} ${eq.serialNumber}` : '') +
          ` · ${eq.status}` +
          (eq.branch ? ` · ${eq.branch.code}` : ''),
      );
      doc.fillColor('#4f6a5e').text(`  ${line.description}`, { indent: 8 });
      doc.fillColor('#15241e');
    }
    doc.moveDown(0.8);

    doc.fillColor('#15241e').fontSize(13).text(t.options);
    doc.moveDown(0.4);

    for (const opt of proposal.options) {
      if (doc.y > 700) doc.addPage();
      const top = doc.y;
      doc
        .roundedRect(50, top, 495, 78, 6)
        .strokeColor('#b7cfc2')
        .lineWidth(1)
        .stroke();
      doc.fillColor('#b8862e').fontSize(12).text(opt.label, 62, top + 10);
      doc
        .fillColor('#15241e')
        .fontSize(10)
        .text(
          `${opt.durationDays} ${t.days} · ${periodLabel(opt.billingPeriod, locale === 'en' ? 'en' : 'pt-BR')}`,
          62,
          top + 28,
        );
      doc.text(
        `${t.rate}: ${brl(opt.unitRate)}  ·  ${t.mob}: ${brl(opt.mobFee)}  ·  ${t.demob}: ${brl(opt.demobFee)}`,
        62,
        top + 46,
      );
      doc.y = top + 90;
    }

    if (proposal.notes) {
      doc.moveDown(0.4);
      doc.fillColor('#15241e').fontSize(13).text(t.notes);
      doc.fontSize(11).fillColor('#4f6a5e').text(proposal.notes);
    }

    doc.moveDown(1.2);
    doc
      .fontSize(9)
      .fillColor('#4f6a5e')
      .text('Equipa — locação industrial de equipamentos', { align: 'left' });

    doc.end();
    return done;
  }
}
