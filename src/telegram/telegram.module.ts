import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { HttpModule } from '@nestjs/axios';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TelegramMessageBuilder } from './telegram.message-builder';
import { TelegramRecipientService } from './telegram.recipient.service';
import { TelegramUpdate } from './telegram.update';
import { UsersModule } from '../users/users.module';
import { ParserModule } from '../parser/parser.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    UsersModule,
    ParserModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '',
      }),
    }),
  ],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    TelegramMessageBuilder,
    TelegramRecipientService,
    TelegramUpdate,
  ],
  exports: [TelegramService, TelegramMessageBuilder, TelegramRecipientService],
})
export class TelegramModule { }
