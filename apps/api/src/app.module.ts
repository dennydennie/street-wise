import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CamerasModule } from './modules/cameras/cameras.module';
import { PassesModule } from './modules/passes/passes.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CamerasModule,
    ReportsModule,
    PassesModule,
    PaymentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
