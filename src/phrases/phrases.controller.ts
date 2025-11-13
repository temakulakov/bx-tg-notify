import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    Render,
    Req,
    Res,
} from '@nestjs/common';
import { PhrasesService } from './phrases.service';
import { TelegramAuthGuard } from '../auth/guards/telegram-auth.guard';
import type { Request, Response } from 'express';

@Controller('phrases')
export class PhrasesController {
    constructor(private readonly phrasesService: PhrasesService) { }

    @Get()
    @UseGuards(TelegramAuthGuard)
    @Render('phrases')
    async getPhrasesPage(@Req() req: Request) {
        const phrases = await this.phrasesService.findAll();
        return {
            phrases,
            user: (req as any).user,
        };
    }

    @Post()
    @UseGuards(TelegramAuthGuard)
    async createPhrase(
        @Body('text') text: string,
        @Res() res: Response,
    ): Promise<void> {
        if (!text || !text.trim()) {
            res.status(400).json({ error: 'Текст фразы обязателен' });
            return;
        }

        await this.phrasesService.create(text.trim());
        res.redirect('/phrases');
    }

    @Delete(':id')
    @UseGuards(TelegramAuthGuard)
    async deletePhrase(
        @Param('id') id: string,
        @Res() res: Response,
    ): Promise<void> {
        const phraseId = parseInt(id, 10);
        if (isNaN(phraseId)) {
            res.status(400).json({ error: 'Неверный ID фразы' });
            return;
        }

        await this.phrasesService.remove(phraseId);
        res.redirect('/phrases');
    }

    @Post(':id/delete')
    @UseGuards(TelegramAuthGuard)
    async deletePhrasePost(
        @Param('id') id: string,
        @Res() res: Response,
    ): Promise<void> {
        const phraseId = parseInt(id, 10);
        if (isNaN(phraseId)) {
            res.status(400).json({ error: 'Неверный ID фразы' });
            return;
        }

        await this.phrasesService.remove(phraseId);
        res.redirect('/phrases');
    }
}

