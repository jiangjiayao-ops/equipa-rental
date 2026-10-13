import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type NotifyResult = {
  provider: string;
  status: 'SENT' | 'FAILED' | 'DEV_OUTBOX';
  providerRef?: string;
  error?: string;
};

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  emailConfigured(): boolean {
    return Boolean(
      process.env.RESEND_API_KEY ||
        process.env.SENDGRID_API_KEY ||
        (process.env.SMTP_HOST && process.env.SMTP_USER),
    );
  }

  whatsappConfigured(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM,
    );
  }

  configStatus() {
    return {
      email: this.emailConfigured()
        ? this.emailConfiguredProvider()
        : 'not_configured',
      whatsapp: this.whatsappConfigured() ? 'twilio' : 'not_configured',
      publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
    };
  }

  private emailConfiguredProvider() {
    if (process.env.RESEND_API_KEY) return 'resend';
    if (process.env.SENDGRID_API_KEY) return 'sendgrid';
    if (process.env.SMTP_HOST) return 'smtp';
    return 'not_configured';
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<NotifyResult> {
    if (process.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? 'Equipa <onboarding@resend.dev>',
            to: [params.to],
            subject: params.subject,
            text: params.text,
            html: params.html ?? `<pre>${params.text}</pre>`,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
        if (!res.ok) {
          return {
            provider: 'resend',
            status: 'FAILED',
            error: body.message ?? `HTTP ${res.status}`,
          };
        }
        return { provider: 'resend', status: 'SENT', providerRef: body.id };
      } catch (e) {
        return {
          provider: 'resend',
          status: 'FAILED',
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    if (process.env.SENDGRID_API_KEY) {
      try {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: params.to }] }],
            from: {
              email: process.env.EMAIL_FROM ?? 'noreply@equipa.com.br',
              name: 'Equipa',
            },
            subject: params.subject,
            content: [
              { type: 'text/plain', value: params.text },
              {
                type: 'text/html',
                value: params.html ?? `<pre>${params.text}</pre>`,
              },
            ],
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return { provider: 'sendgrid', status: 'FAILED', error: text || `HTTP ${res.status}` };
        }
        return {
          provider: 'sendgrid',
          status: 'SENT',
          providerRef: res.headers.get('x-message-id') ?? undefined,
        };
      } catch (e) {
        return {
          provider: 'sendgrid',
          status: 'FAILED',
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    // SMTP without a library: fall through to outbox (document that nodemailer can be wired later)
    return this.writeOutbox('email', params.to, params.subject, params.text);
  }

  async sendWhatsApp(params: {
    to: string;
    body: string;
  }): Promise<NotifyResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (sid && token && from) {
      try {
        const to = params.to.startsWith('whatsapp:')
          ? params.to
          : `whatsapp:${params.to.replace(/\D/g, '').replace(/^/, '+')}`;
        const auth = Buffer.from(`${sid}:${token}`).toString('base64');
        const form = new URLSearchParams({
          From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
          To: to.includes('+') ? to : `whatsapp:+${params.to.replace(/\D/g, '')}`,
          Body: params.body,
        });
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
          },
        );
        const body = (await res.json().catch(() => ({}))) as {
          sid?: string;
          message?: string;
        };
        if (!res.ok) {
          return {
            provider: 'twilio',
            status: 'FAILED',
            error: body.message ?? `HTTP ${res.status}`,
          };
        }
        return { provider: 'twilio', status: 'SENT', providerRef: body.sid };
      } catch (e) {
        return {
          provider: 'twilio',
          status: 'FAILED',
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    return this.writeOutbox('whatsapp', params.to, 'WhatsApp', params.body);
  }

  private writeOutbox(
    channel: string,
    to: string,
    subject: string,
    body: string,
  ): NotifyResult {
    const dir = path.resolve(process.cwd(), 'data', 'outbox');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${channel}.txt`);
    const content = [
      `channel=${channel}`,
      `to=${to}`,
      `subject=${subject}`,
      `at=${new Date().toISOString()}`,
      '',
      body,
    ].join('\n');
    fs.writeFileSync(file, content, 'utf8');
    this.logger.warn(
      `Notify ${channel} not configured — wrote DEV_OUTBOX ${file}`,
    );
    return {
      provider: 'dev_outbox',
      status: 'DEV_OUTBOX',
      providerRef: file,
      error: `${channel} carrier not configured; message saved to outbox`,
    };
  }
}
