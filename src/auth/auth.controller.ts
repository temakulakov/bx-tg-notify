import { Controller, Post, Body, Render, Req, Res, Get } from '@nestjs/common';
import type { Request, Response } from 'express';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly usersService: UsersService) { }

    @Get('login')
    @Render('auth')
    getLoginPage() {
        return { error: null };
    }

    @Post('login')
    async login(
        @Body('telegramId') telegramId: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        const id = parseInt(telegramId, 10);

        if (isNaN(id)) {
            return res.render('auth', {
                error: 'Неверный формат Telegram ID',
            });
        }

        // Проверяем, существует ли пользователь с таким telegram_id
        const users = await this.usersService.findAll();
        const user = users.find(
            (u) => u.telegram_ids && u.telegram_ids.includes(id),
        );

        if (!user) {
            return res.render('auth', {
                error: 'Пользователь с таким Telegram ID не найден',
            });
        }

        // Сохраняем telegram_id в сессии
        (req.session as any).telegramId = id;
        return res.redirect('/phrases');
    }

    @Post('logout')
    logout(@Req() req: Request, @Res() res: Response): void {
        (req.session as any).telegramId = null;
        res.redirect('/auth/login');
    }
}


