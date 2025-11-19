import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './typeorm.config';
import { UsersModule } from './users/users.module';
import { BitrixModule } from './bitrix/bitrix.module';
import { DataSource } from 'typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { CommentsService } from './comments/comments.service';
import { CommentsModule } from './comments/comments.module';
import { ParserModule } from './parser/parser.module';
import { WebhookModule } from './webhook/webhook.module';
import { TelegramModule } from './telegram/telegram.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PhrasesModule } from './phrases/phrases.module';
import { AuthModule } from './auth/auth.module';
import { WebappModule } from './webapp/webapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.NODE_ENV === 'production' ? '.production.env' : '.development.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    UsersModule,
    BitrixModule,
    TasksModule,
    CommentsModule,
    ParserModule,
    WebhookModule,
    TelegramModule,
    DashboardModule,
    PhrasesModule,
    AuthModule,
    WebappModule,
  ],
  controllers: [AppController],
  providers: [AppService, CommentsService],
})
export class AppModule {
  constructor(private dataSource: DataSource) { }
}
