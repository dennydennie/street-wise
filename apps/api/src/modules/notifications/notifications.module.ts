import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { ConsoleEmailSender, EMAIL_SENDER, EmailSender, SendGridEmailSender } from './email-sender';
import { NotificationsService } from './notifications.service';
import { ConsoleSmsSender, GikkoSmsSender, SMS_SENDER, SmsSender } from './sms-sender';

/** SMS (Gikko) and e-mail (SendGrid), the same providers as BluWorx; console senders locally. */
@Global()
@Module({
  providers: [
    {
      provide: SMS_SENDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): SmsSender =>
        config.smsProvider === 'gikko'
          ? new GikkoSmsSender({
              apiKey: config.gikko.apiKey as string,
              baseUrl: config.gikko.baseUrl,
              sender: config.gikko.sender,
              authScheme: config.gikko.authScheme,
              timeoutMs: config.gikko.timeoutMs,
              notifyUrl: config.gikko.notifyUrl,
            })
          : new ConsoleSmsSender(),
    },
    {
      provide: EMAIL_SENDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): EmailSender =>
        config.emailProvider === 'sendgrid'
          ? new SendGridEmailSender({
              apiKey: config.sendgrid.apiKey as string,
              apiBaseUrl: config.sendgrid.apiBaseUrl,
              fromEmail: config.emailSender.email as string,
              fromName: config.emailSender.name,
            })
          : new ConsoleEmailSender(),
    },
    NotificationsService,
  ],
  exports: [SMS_SENDER, EMAIL_SENDER, NotificationsService],
})
export class NotificationsModule {}
