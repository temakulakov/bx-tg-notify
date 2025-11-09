import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { BitrixWebhookDto } from './dto/bitrix-webhook.dto';

@Injectable()
export class WebhookGuard implements CanActivate {
  private readonly logger = new Logger(WebhookGuard.name);

  constructor(private readonly configService: ConfigService) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as BitrixWebhookDto;

    this.logger.debug(
      `Проверка токена для вебхука: ${JSON.stringify(body?.auth ?? {})}`,
    );

    const expectedToken = this.configService.get<string>('BX24_OUTGOING_TOKEN');

    if (!body?.auth?.application_token || !expectedToken) {
      this.logger.warn('Токен отсутствует или не настроен в окружении');
      throw new ForbiddenException('Invalid Bitrix token');
    }

    if (body.auth.application_token !== expectedToken) {
      this.logger.warn(
        `⚠️ Неверный токен вебхука. Ожидали ${expectedToken}, получили ${body.auth.application_token}`,
      );
      throw new ForbiddenException('Invalid Bitrix token');
    }

    this.logger.debug('Вебхук успешно прошёл проверку токена');
    return true;
  }
}
