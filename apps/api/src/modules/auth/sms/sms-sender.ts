import { Injectable, Logger } from '@nestjs/common';

export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsSender {
  send(to: string, message: string): Promise<void>;
}

/**
 * Local/test sender: writes the message to the API log so a developer can read
 * the code. The env schema refuses it in production.
 */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('ConsoleSms');

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`SMS to ${to}: ${message}`);
  }
}
