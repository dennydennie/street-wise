import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { AreasModule } from './modules/areas/areas.module';
import { AuthModule } from './modules/auth/auth.module';
import { CamerasModule } from './modules/cameras/cameras.module';
import { GeoModule } from './modules/geo/geo.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PassesModule } from './modules/passes/passes.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PublicConfigModule } from './modules/public-config/public-config.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SupportModule } from './modules/support/support.module';
import { TranscriptionsModule } from './modules/transcriptions/transcriptions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule.forRoot(),
    DatabaseModule,
    GeoModule,
    NotificationsModule,
    PublicConfigModule,
    AuthModule,
    UsersModule,
    CamerasModule,
    AreasModule,
    ReportsModule,
    TranscriptionsModule,
    PassesModule,
    PaymentsModule,
    SupportModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
