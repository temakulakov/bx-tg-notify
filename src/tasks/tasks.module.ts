import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { BitrixModule } from '../bitrix/bitrix.module';
import { TaskProcessor } from './task.processor';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { PhrasesModule } from '../phrases/phrases.module';

@Module({
  controllers: [TasksController],
  providers: [TasksService, TaskProcessor],
  imports: [BitrixModule, TelegramModule, TypeOrmModule.forFeature([Task]), PhrasesModule],
  exports: [TaskProcessor, TasksService],
})
export class TasksModule {}
