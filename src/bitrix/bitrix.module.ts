import { Logger, Module } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BitrixHttpService } from './bitrix-http.service';

@Module({
  providers: [BitrixService, BitrixHttpService],
  exports: [BitrixService, BitrixHttpService],
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger(BitrixHttpService.name);
        const domain = configService.get<string>('BX24_DOMAIN');
        const userId = configService.get<string>('BX24_INCOMING_USER');
        const token = configService.get<string>('BX24_INCOMING_TOKEN');

        if (!domain || !userId || !token) {
          // Лучше логировать предупреждение, если что-то не задано
          logger.debug(
            '⚠️  BITRIX_DOMAIN, BITRIX_USER_ID или BITRIX_TOKEN не заданы в .env',
          );
        }

        return {
          baseURL: `${domain}/rest/${userId}/${token}/`,
          timeout: 8000,
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: (status: number) => status < 500,
        };
      },
    }),
    ConfigModule,
  ],
})
export class BitrixModule { }
