import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

type Locale = 'pt-BR' | 'en';

const copy = {
  'pt-BR': {
    title: 'Proposta comercial',
    customer: 'Cliente',
    branch: 'Filial',
    status: 'Status',
    validity: 'Validade',
    billingTiming: 'Faturamento',
    advance: 'Antecipado',
    arrears: 'Após o período',
    equipment: 'Equipamentos',
    options: 'Opções de período',
    rate: 'Taxa',
    mob: 'Mobilização',
    demob: 'Desmobilização',
    days: 'dias',
    notes: 'Observações',
    weekly: 'Semanal',
    monthly: 'Mensal',
    yearly: 'Anual',
  },
  en: {
    title: 'Commercial proposal',
    customer: 'Customer',
    branch: 'Branch',
    status: 'Status',
    validity: 'Valid until',
    billingTiming: 'Billing timing',
    advance: 'Pay in advance',
    arrears: 'Pay in arrears',
    equipment: 'Equipment',
    options: 'Period options',
    rate: 'Rate',
    mob: 'Mobilization',
    demob: 'Demobilization',
    days: 'days',
    notes: 'Notes',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  },
} as const;

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
        lines: { include: { equipment: true } },
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');

    const t = copy[locale === 'en' ? 'en' : 'pt-BR'];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fillColor('#15241e').fontSize(20).text('Equipa', { continued: false });
    doc
      .fillColor('#b8862e')
      .fontSize(14)
      .text(t.title, { continued: false });
    doc.moveDown(0.3);
    doc.fillColor('#15241e').fontSize(16).text(proposal.number);
    doc.moveDown(0.6);

    doc.fontSize(11).fillColor('#4f6a5e');
    doc.text(`${t.customer}: ${proposal.customer.legalName}`);
    if (proposal.customer.document) {
      doc.text(`CNPJ: ${proposal.customer.document}`);
    }
    doc.text(`${t.branch}: ${proposal.branch.code} — ${proposal.branch.name}`);
    doc.text(`${t.status}: ${proposal.status}`);
    doc.text(
      `${t.billingTiming}: ${
        proposal.billingTiming === 'ARREARS' ? t.arrears : t.advance
      }`,
    );
    if (proposal.validUntil) {
      doc.text(
        `${t.validity}: ${proposal.validUntil.toISOString().slice(0, 10)}`,
      );
    }
    doc.moveDown(0.8);

    doc.fillColor('#15241e').fontSize(13).text(t.equipment);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#15241e');
    for (const line of proposal.lines) {
      doc.text(`• ${line.description}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`);
    }
    doc.moveDown(0.8);

    doc.fillColor('#15241e').fontSize(13).text(t.options);
    doc.moveDown(0.4);

    for (const opt of proposal.options) {
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
