import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { EMAIL_SENDER, EmailSender, escapeHtml } from './email-sender';
import { SMS_SENDER, SmsSender } from './sms-sender';

const HARARE = 'Africa/Harare';
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: HARARE }).format(d);
const usd = (cents: number) => `US$${(cents / 100).toFixed(2)}`;

export type SupportCategory = 'bug' | 'wrong_camera' | 'billing' | 'other';
const SUPPORT_LABEL: Record<SupportCategory, string> = {
  bug: 'Bug report',
  wrong_camera: 'Wrong or missing camera',
  billing: 'Billing question',
  other: 'Support message',
};

/**
 * What StreetWise says over SMS and e-mail. Sign-in codes go through AuthService
 * directly (their failure must fail the request); everything here is a side
 * message: failures are logged and never break the action that triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    private readonly config: AppConfigService,
  ) {}

  /** Screen 24: "Receipt sent to +263 77 ••• 4821". */
  async paymentReceipt(phone: string, p: { passLabel: string; amountCents: number; reference: string; endsAt: Date | null }) {
    const until = p.endsAt ? ` Plus is on until ${fmtDate(p.endsAt)}.` : '';
    await this.quietly('receipt SMS', () =>
      this.sms.send(phone, `StreetWise receipt: ${p.passLabel} ${usd(p.amountCents)} paid, ref ${p.reference}.${until} No auto-renew.`, p.reference),
    );
  }

  /** A report was flagged into review: tell the moderators (Play UGC policy). */
  async moderationAlert(r: { reportId: string; type: string; summary: string | null; locationName: string | null; reason: string; flags: number }) {
    const to = this.config.moderationEmail;
    if (!to) return;
    const lines = [
      `A ${r.type.replace(/_/g, ' ')} report was sent to review.`,
      `Reason: ${r.reason.replace(/_/g, ' ')} (${r.flags} flag${r.flags === 1 ? '' : 's'})`,
      `Where: ${r.locationName ?? 'unknown'}`,
      `Summary: ${r.summary ?? '—'}`,
      `Report id: ${r.reportId}`,
    ];
    await this.quietly('moderation e-mail', () =>
      this.email.send({
        to,
        subject: `[StreetWise] Report in review: ${r.type.replace(/_/g, ' ')} at ${r.locationName ?? 'unknown'}`,
        text: lines.join('\n'),
        html: `<p>${lines.map(escapeHtml).join('<br>')}</p>`,
      }),
    );
  }

  /** Help › Report a bug or wrong camera. Throws so the app can tell the user it failed. */
  async supportMessage(m: {
    category: SupportCategory;
    message: string;
    userId?: string;
    phone?: string | null;
    displayName?: string | null;
    replyEmail?: string;
    lat?: number;
    lng?: number;
    appVersion?: string;
  }): Promise<void> {
    const label = SUPPORT_LABEL[m.category];
    const meta = [
      `From: ${m.displayName ?? 'Anonymous listener'}${m.phone ? ` (${m.phone})` : ''}${m.userId ? ` · user ${m.userId}` : ''}`,
      m.replyEmail ? `Reply to: ${m.replyEmail}` : null,
      m.lat !== undefined && m.lng !== undefined ? `Location: ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : null,
      m.appVersion ? `App: ${m.appVersion}` : null,
    ].filter((x): x is string => x !== null);
    const text = `${label}\n\n${m.message}\n\n${meta.join('\n')}`;
    await this.email.send({
      to: this.config.supportEmail,
      replyTo: m.replyEmail,
      subject: `[StreetWise] ${label}: ${m.message.slice(0, 60).replace(/\s+/g, ' ')}`,
      text,
      html: `<p><strong>${escapeHtml(label)}</strong></p><p>${escapeHtml(m.message).replace(/\n/g, '<br>')}</p><p>${meta.map(escapeHtml).join('<br>')}</p>`,
    });
  }

  private async quietly(what: string, send: () => Promise<unknown>): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.warn(`Could not send ${what}: ${(error as Error).message}`);
    }
  }
}
