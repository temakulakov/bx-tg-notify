import { Module, forwardRef } from '@nestjs/common';
import { ParserService } from './parser.service';
import { ConfigModule } from '@nestjs/config';
import { BitrixModule } from '../bitrix/bitrix.module';
import { UsersModule } from '../users/users.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  providers: [ParserService],
  exports: [ParserService],
  imports: [
    BitrixModule,
    UsersModule,
    ConfigModule,
    forwardRef(() => TasksModule),
  ],
})
export class ParserModule { }
