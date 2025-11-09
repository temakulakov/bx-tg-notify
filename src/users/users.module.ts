import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersSyncService } from './users.sync.service';
import { ScheduleModule } from '@nestjs/schedule';
import { BitrixService } from '../bitrix/bitrix.service';
import { BitrixModule } from '../bitrix/bitrix.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ScheduleModule.forRoot(),
    BitrixModule,
  ],
  providers: [UsersService, UsersSyncService],
  exports: [UsersService],
})
export class UsersModule {}
