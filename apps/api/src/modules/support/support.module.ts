import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { SupportController } from './support.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [SupportController],
})
export class SupportModule {}
