import { Injectable, Logger } from '@nestjs/common';

export const SMS_SENDER = Symbol('SMS_SENDER');

export type SmsResult = { provider: string; messageId: string | null; status: string | null };

export interface SmsSender {
  /** `to` is E.164 (+263…). Throws when the provider rejects the message. */
  send(to: string, message: string, ref?: string): Promise<SmsResult>;
}

/**
 * Local/staging sender: writes the message to the API log so a developer can read
 * the code. The env schema refuses it in production.
 */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('ConsoleSms');

  async send(to: string, message: string): Promise<SmsResult> {
    this.logger.log(`SMS to ${to}: ${message}`);
    return { provider: 'console', messageId: null, status: 'logged' };
  }
}

export type GikkoSmsOptions = {
  apiKey: string;
  /** `https://api.infobip.com`, or a full send URL. Gikko exposes the Infobip SMS API. */
  baseUrl: string;
  sender: string;
  authScheme: string;
  timeoutMs: number;
  /** Optional delivery-report webhook Gikko calls back. */
  notifyUrl?: string;
};

const SMS_SEND_PATH = '/sms/2/text/advanced';

/**
 * Gikko SMS — the same provider and request shape BluWorx uses
 * (`POST {base}/sms/2/text/advanced`, `Authorization: App <key>`).
 */
export class GikkoSmsSender implements SmsSender {
  constructor(private readonly options: GikkoSmsOptions, private readonly fetchImpl: typeof fetch = fetch) {}

  async send(to: string, message: string, ref?: string): Promise<SmsResult> {
    const msg: Record<string, unknown> = {
      destinations: [{ to: gikkoNumber(to) }],
      from: this.options.sender,
      text: message,
      notifyContentType: 'application/json',
      ...(ref ? { callbackData: JSON.stringify({ ref }) } : {}),
      ...(this.options.notifyUrl ? { notifyUrl: this.options.notifyUrl } : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(gikkoSendUrl(this.options.baseUrl), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `${this.options.authScheme} ${this.options.apiKey}`,
        },
        body: JSON.stringify({ messages: [msg] }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error(`GIKKO_SMS_UNREACHABLE:${(error as Error).name}`);
    } finally {
      clearTimeout(timer);
    }

    const body = await readJson(response);
    if (!response.ok) throw new Error(`GIKKO_SMS_SEND_FAILED:${response.status}${errorText(body)}`);
    const first = firstMessage(body);
    if (!first) throw new Error('GIKKO_SMS_EMPTY_RESPONSE');
    const status = isRecord(first.status) ? (str(first.status, 'name') ?? str(first.status, 'groupName')) : null;
    if (isRecord(first.status) && str(first.status, 'groupName') === 'REJECTED') {
      throw new Error(`GIKKO_SMS_REJECTED:${status ?? 'unknown'}`);
    }
    return { provider: 'gikko', messageId: str(first, 'messageId') ?? str(first, 'id'), status };
  }
}

/** Gikko/Infobip take international numbers without the "+". */
export const gikkoNumber = (e164: string): string => e164.replace(/[^\d]/g, '');

export const gikkoSendUrl = (value: string): string => {
  const url = new URL(value);
  if (url.pathname.replace(/\/+$/, '') === '') url.pathname = SMS_SEND_PATH;
  return url.toString().replace(/\/$/, '');
};

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 200) };
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (r: Record<string, unknown>, k: string): string | null => {
  const v = r[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

const firstMessage = (body: unknown): Record<string, unknown> | null => {
  if (!isRecord(body)) return null;
  if (!Array.isArray(body.messages)) return body;
  const m: unknown = (body.messages as unknown[])[0];
  return isRecord(m) ? m : null;
};

const errorText = (body: unknown): string => {
  if (!isRecord(body)) return '';
  const req = isRecord(body.requestError) ? body.requestError : null;
  const svc = req && isRecord(req.serviceException) ? req.serviceException : null;
  const text = (svc && (str(svc, 'text') ?? str(svc, 'messageId'))) ?? (typeof body.raw === 'string' ? body.raw : null);
  return text ? `:${text.slice(0, 160)}` : '';
};
