import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPass } from './entities/user-pass.entity';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserPass])],
  controllers: [PassesController],
  providers: [PassesService],
  exports: [PassesService],
})
export class PassesModule {}
