import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { PassesModule } from '../passes/passes.module';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { FakePaynowGateway } from './paynow/fake-paynow.gateway';
import { PAYNOW_GATEWAY, PaynowGateway } from './paynow/paynow-gateway';
import { PaynowHttpGateway } from './paynow/paynow-http.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), PassesModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYNOW_GATEWAY,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): PaynowGateway =>
        config.paynowMode === 'fake'
          ? new FakePaynowGateway(config.apiPublicBaseUrl)
          : new PaynowHttpGateway({
              integrationId: config.paynowIntegrationId as string,
              integrationKey: config.paynowIntegrationKey,
              authEmail: config.paynowAuthEmail,
            }),
    },
  ],
})
export class PaymentsModule {}
