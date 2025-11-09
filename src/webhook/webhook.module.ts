import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { ConfigModule } from '@nestjs/config';
import { WebhookController } from './webhook.controller';
import { TasksModule } from '../tasks/tasks.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  providers: [WebhookService],
  imports: [ConfigModule, TasksModule, TelegramModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
