import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TelegramModule } from '../telegram/telegram.module';
import { BitrixModule } from '../bitrix/bitrix.module';

@Module({
  imports: [TelegramModule, BitrixModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule { }


