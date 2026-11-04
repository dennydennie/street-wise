import type { AppConfigService } from '../../config/app-config.service';
import { SendGridEmailSender, escapeHtml } from './email-sender';
import { NotificationsService } from './notifications.service';
import { GikkoSmsSender, gikkoNumber, gikkoSendUrl } from './sms-sender';

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('GikkoSmsSender (same API as BluWorx)', () => {
  const options = { apiKey: 'key-123', baseUrl: 'https://api.infobip.com', sender: 'StreetWise', authScheme: 'App', timeoutMs: 5000 };

  it('posts an Infobip-style advanced SMS with App auth and returns the message id', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, { messages: [{ messageId: 'm-1', status: { groupName: 'PENDING', name: 'PENDING_ACCEPTED' } }] }),
    );
    const sender = new GikkoSmsSender({ ...options, notifyUrl: 'https://api.example/dlr' }, fetchImpl as unknown as typeof fetch);
    const result = await sender.send('+263771234821', 'Your StreetWise code is 123456.', 'otp');

    expect(result).toEqual({ provider: 'gikko', messageId: 'm-1', status: 'PENDING_ACCEPTED' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.infobip.com/sms/2/text/advanced');
    expect((init.headers as Record<string, string>).Authorization).toBe('App key-123');
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toMatchObject({
      destinations: [{ to: '263771234821' }],
      from: 'StreetWise',
      text: 'Your StreetWise code is 123456.',
      notifyUrl: 'https://api.example/dlr',
    });
  });

  it('throws with the provider status and reason on an HTTP error', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(401, { requestError: { serviceException: { messageId: 'UNAUTHORIZED', text: 'Invalid login details' } } }),
    );
    const sender = new GikkoSmsSender(options, fetchImpl as unknown as typeof fetch);
    await expect(sender.send('+263771234821', 'hi')).rejects.toThrow('GIKKO_SMS_SEND_FAILED:401:Invalid login details');
  });

  it('throws when the message is rejected', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { messages: [{ messageId: 'm', status: { groupName: 'REJECTED', name: 'REJECTED_DESTINATION' } }] }));
    const sender = new GikkoSmsSender(options, fetchImpl as unknown as typeof fetch);
    await expect(sender.send('+263771234821', 'hi')).rejects.toThrow('GIKKO_SMS_REJECTED:REJECTED_DESTINATION');
  });

  it('normalises numbers and URLs', () => {
    expect(gikkoNumber('+263 77 123 4821')).toBe('263771234821');
    expect(gikkoSendUrl('https://xyz.api.infobip.com/')).toBe('https://xyz.api.infobip.com/sms/2/text/advanced');
    expect(gikkoSendUrl('https://gw.example/custom/send')).toBe('https://gw.example/custom/send');
  });
});

describe('SendGridEmailSender (same API as BluWorx)', () => {
  const options = { apiKey: 'SG.key', apiBaseUrl: 'https://api.sendgrid.com', fromEmail: 'no-reply@streetwise.co.zw', fromName: 'StreetWise ZW' };

  it('posts v3 mail/send with bearer auth, reply-to and both bodies', async () => {
    const fetchImpl = jest.fn(async () => new Response(null, { status: 202, headers: { 'x-message-id': 'sg-1' } }));
    const sender = new SendGridEmailSender(options, fetchImpl as unknown as typeof fetch);
    const result = await sender.send({ to: 'support@streetwise.co.zw', subject: 'Hi', text: 'plain', html: '<p>html</p>', replyTo: 'a@b.co' });

    expect(result).toEqual({ provider: 'sendgrid', messageId: 'sg-1' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SG.key');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      personalizations: [{ to: [{ email: 'support@streetwise.co.zw' }] }],
      from: { email: 'no-reply@streetwise.co.zw', name: 'StreetWise ZW' },
      reply_to: { email: 'a@b.co' },
      subject: 'Hi',
    });
    expect(body.content).toEqual([{ type: 'text/plain', value: 'plain' }, { type: 'text/html', value: '<p>html</p>' }]);
  });

  it('surfaces SendGrid error messages', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(403, { errors: [{ message: 'The from address does not match a verified Sender Identity.' }] }));
    const sender = new SendGridEmailSender(options, fetchImpl as unknown as typeof fetch);
    await expect(sender.send({ to: 'x@y.co', subject: 's', text: 't' })).rejects.toThrow(
      'SENDGRID_EMAIL_SEND_FAILED:403:The from address does not match a verified Sender Identity.',
    );
  });

  it('escapes HTML in user content', () => {
    expect(escapeHtml('<script>"x"&</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;');
  });
});

describe('NotificationsService', () => {
  const build = (moderationEmail?: string) => {
    const sms = { send: jest.fn(async () => ({ provider: 'test', messageId: null, status: null })) };
    const email = { send: jest.fn(async () => ({ provider: 'test', messageId: null })) };
    const config = { supportEmail: 'support@streetwise.co.zw', moderationEmail } as AppConfigService;
    return { sms, email, service: new NotificationsService(sms, email, config) };
  };

  it('texts a short receipt and never throws when the SMS fails', async () => {
    const { sms, service } = build();
    await service.paymentReceipt('+263771234821', { passLabel: 'Week pass', amountCents: 150, reference: 'SWZ-7Q4K2M', endsAt: new Date('2026-11-11T16:51:00Z') });
    expect(sms.send).toHaveBeenCalledWith(
      '+263771234821',
      'StreetWise receipt: Week pass US$1.50 paid, ref SWZ-7Q4K2M. Plus is on until 11 Nov, 18:51. No auto-renew.',
      'SWZ-7Q4K2M',
    );
    sms.send.mockRejectedValueOnce(new Error('down'));
    await expect(service.paymentReceipt('+263771234821', { passLabel: 'Day pass', amountCents: 50, reference: 'SWZ-AAAAAA', endsAt: null })).resolves.toBeUndefined();
  });

  it('only e-mails moderators when MODERATION_EMAIL is set', async () => {
    const quiet = build();
    await quiet.service.moderationAlert({ reportId: 'r1', type: 'crime_hotspot', summary: 's', locationName: 'Seke', reason: 'names_person_or_plate', flags: 1 });
    expect(quiet.email.send).not.toHaveBeenCalled();

    const { email, service } = build('mods@streetwise.co.zw');
    await service.moderationAlert({ reportId: 'r1', type: 'crime_hotspot', summary: 'Smash and grab', locationName: 'Seke Rd × Cripps Rd', reason: 'names_person_or_plate', flags: 1 });
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'mods@streetwise.co.zw', subject: '[StreetWise] Report in review: crime hotspot at Seke Rd × Cripps Rd' }));
  });

  it('sends support messages to the support inbox and lets failures surface', async () => {
    const { email, service } = build();
    await service.supportMessage({ category: 'wrong_camera', message: 'Camera at Samora × 4th is gone <b>', replyEmail: 'driver@example.com', lat: -17.83, lng: 31.05 });
    const sent = (email.send.mock.calls[0] as unknown[])[0] as { to: string; replyTo: string; html: string; text: string };
    expect(sent.to).toBe('support@streetwise.co.zw');
    expect(sent.replyTo).toBe('driver@example.com');
    expect(sent.text).toContain('Location: -17.83000, 31.05000');
    expect(sent.html).toContain('&lt;b&gt;');

    email.send.mockRejectedValueOnce(new Error('SENDGRID_EMAIL_SEND_FAILED:500'));
    await expect(service.supportMessage({ category: 'bug', message: 'crash on start' })).rejects.toThrow('SENDGRID_EMAIL_SEND_FAILED');
  });
});
