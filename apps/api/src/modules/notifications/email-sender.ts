import { Logger } from '@nestjs/common';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export type Email = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Lets support reply straight to the person who wrote in. */
  replyTo?: string;
};

export type EmailResult = { provider: string; messageId: string | null };

export interface EmailSender {
  send(email: Email): Promise<EmailResult>;
}

/** Local/staging: logs the e-mail instead of sending it. Refused in production. */
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger('ConsoleEmail');

  async send(email: Email): Promise<EmailResult> {
    this.logger.log(`E-mail to ${email.to}: ${email.subject}\n${email.text}`);
    return { provider: 'console', messageId: null };
  }
}

export type SendGridOptions = {
  apiKey: string;
  apiBaseUrl: string;
  fromEmail: string;
  fromName: string;
  timeoutMs?: number;
};

/** SendGrid v3 Mail Send — the same provider and call BluWorx uses. */
export class SendGridEmailSender implements EmailSender {
  constructor(private readonly options: SendGridOptions, private readonly fetchImpl: typeof fetch = fetch) {}

  async send(email: Email): Promise<EmailResult> {
    const content = [{ type: 'text/plain', value: email.text }];
    if (email.html) content.push({ type: 'text/html', value: email.html });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.apiBaseUrl.replace(/\/+$/, '')}/v3/mail/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'StreetWise-API',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: email.to }] }],
          from: { email: this.options.fromEmail, name: this.options.fromName },
          ...(email.replyTo ? { reply_to: { email: email.replyTo } } : {}),
          subject: email.subject,
          content,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error(`SENDGRID_UNREACHABLE:${(error as Error).name}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const text = await response.text();
      let reason = '';
      try {
        const body = JSON.parse(text) as { errors?: { message?: string }[] };
        reason = body.errors?.find((e) => e.message)?.message ?? '';
      } catch {
        reason = text;
      }
      throw new Error(`SENDGRID_EMAIL_SEND_FAILED:${response.status}${reason ? `:${reason.slice(0, 200)}` : ''}`);
    }
    return { provider: 'sendgrid', messageId: response.headers.get('x-message-id') };
  }
}

/** Minimal HTML-escaping for values interpolated into e-mail bodies. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
