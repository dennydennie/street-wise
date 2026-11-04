import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../auth/entities/session.entity';
import { User } from './entities/user.entity';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [MeController],
  providers: [UsersService],
})
export class UsersModule {}
