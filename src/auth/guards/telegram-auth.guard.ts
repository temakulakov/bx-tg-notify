import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UsersService } from '../../users/users.service';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
    constructor(private readonly usersService: UsersService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        // Проверяем сессию
        const telegramId = (request.session as any)?.telegramId;

        if (!telegramId) {
            // Если нет авторизации, показываем страницу авторизации
            response.render('auth', {
                error: null,
            });
            return false;
        }

        // Проверяем, существует ли пользователь с таким telegram_id
        const users = await this.usersService.findAll();
        const user = users.find(
            (u) => u.telegram_ids && u.telegram_ids.includes(telegramId),
        );

        if (!user) {
            (request.session as any).telegramId = null;
            response.render('auth', {
                error: 'Пользователь не найден',
            });
            return false;
        }

        // Сохраняем пользователя в request для использования в контроллерах
        (request as any).user = {
            telegramId,
            bitrixId: user.bitrix_id,
            name: user.name,
        };

        return true;
    }
}

