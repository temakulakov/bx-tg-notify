import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    Render,
    Req,
    Res,
    Logger,
} from '@nestjs/common';
import { WebappService } from './webapp.service';
import type { Request, Response } from 'express';

@Controller('webapp')
export class WebappController {
    private readonly logger = new Logger(WebappController.name);

    constructor(private readonly webappService: WebappService) { }

    @Post('init')
    async initWebApp(@Body('initData') initData: string, @Req() req: Request) {
        // Endpoint для получения initData от клиента
        this.logger.log(`[initWebApp] ========== ПОЛУЧЕН initData ОТ КЛИЕНТА ==========`);
        this.logger.log(`[initWebApp] initData type: ${typeof initData}`);
        this.logger.log(`[initWebApp] initData: ${initData ? `present (${initData.length} chars)` : 'missing'}`);
        this.logger.log(`[initWebApp] initData preview: ${initData ? initData.substring(0, 200) : 'N/A'}...`);

        if (!initData) {
            this.logger.error(`[initWebApp] initData отсутствует`);
            return { error: 'initData отсутствует' };
        }

        // initData приходит через JSON body, NestJS автоматически парсит его
        // Но JSON.stringify может добавить экранирование, поэтому нужно проверить
        // Если initData начинается с кавычек, значит он был двойной закодирован
        let processedInitData = initData;
        if (initData.startsWith('"') && initData.endsWith('"')) {
            // Убираем кавычки, которые добавил JSON.stringify
            try {
                processedInitData = JSON.parse(initData);
                this.logger.log(`[initWebApp] initData был в кавычках, распарсили JSON`);
            } catch (e) {
                this.logger.warn(`[initWebApp] Не удалось распарсить initData из кавычек: ${e.message}`);
            }
        }

        this.logger.log(`[initWebApp] processedInitData length: ${processedInitData.length}`);
        this.logger.log(`[initWebApp] processedInitData preview: ${processedInitData.substring(0, 200)}...`);

        const user = await this.webappService.validateTelegramUser(processedInitData);

        if (!user) {
            this.logger.error(`[initWebApp] ❌ Пользователь не авторизован после валидации`);
            this.logger.error(`[initWebApp] processedInitData full: ${processedInitData}`);
            return { error: 'Валидация не прошла', hasInitData: true };
        }

        this.logger.log(`[initWebApp] ✅ Пользователь авторизован: ${user.name} (isAdmin: ${user.isAdmin})`);

        // Сохраняем в сессию для последующих запросов
        (req.session as any).telegramId = user.telegramId;
        (req.session as any).webappInitData = processedInitData;

        return { success: true, user };
    }

    @Get('api/status')
    async getStatus(@Query('initData') initData: string) {
        const user = await this.webappService.validateTelegramUser(initData);
        if (!user) {
            return { error: 'Unauthorized' };
        }

        const serverStatus = await this.webappService.getServerStatus();
        return serverStatus;
    }

    @Get('api/phrases')
    async getPhrases(@Query('initData') initData: string) {
        const user = await this.webappService.validateTelegramUser(initData);
        if (!user || !user.isAdmin) {
            return { error: 'Forbidden' };
        }

        return this.webappService.getPhrases();
    }

    @Post('api/phrases')
    async createPhrase(
        @Query('initData') initData: string,
        @Body('text') text: string,
    ) {
        this.logger.log(`[createPhrase] ========== ЗАПРОС НА СОЗДАНИЕ ФРАЗЫ ==========`);
        this.logger.log(`[createPhrase] initData: ${initData ? `present (${initData.length} chars)` : 'missing'}`);
        this.logger.log(`[createPhrase] text: "${text}"`);

        // Декодируем initData если он был закодирован
        let decodedInitData = initData || '';
        if (decodedInitData) {
            try {
                decodedInitData = decodeURIComponent(decodedInitData);
                this.logger.log(`[createPhrase] initData декодирован, длина: ${decodedInitData.length}`);
            } catch (e) {
                this.logger.warn(`[createPhrase] Ошибка декодирования initData: ${e.message}`);
            }
        }

        const user = await this.webappService.validateTelegramUser(decodedInitData);
        if (!user || !user.isAdmin) {
            this.logger.warn(`[createPhrase] ❌ Доступ запрещен. User: ${user ? 'found' : 'not found'}, isAdmin: ${user?.isAdmin || false}`);
            return { error: 'Forbidden' };
        }

        if (!text || !text.trim()) {
            this.logger.warn(`[createPhrase] ❌ Текст фразы пустой`);
            return { error: 'Текст фразы обязателен' };
        }

        try {
            const phrase = await this.webappService.createPhrase(text.trim());
            this.logger.log(`[createPhrase] ✅ Фраза успешно создана через API: id=${phrase.id}`);
            return phrase;
        } catch (error) {
            this.logger.error(`[createPhrase] ❌ Ошибка при создании фразы через API: ${error.message}`, error.stack);
            return { error: error.message || 'Ошибка при создании фразы' };
        }
    }

    @Delete('api/phrases/:id')
    async deletePhrase(
        @Query('initData') initData: string,
        @Param('id') id: string,
    ) {
        this.logger.log(`[deletePhrase] ========== ЗАПРОС НА УДАЛЕНИЕ ФРАЗЫ ==========`);
        this.logger.log(`[deletePhrase] initData: ${initData ? `present (${initData.length} chars)` : 'missing'}`);
        this.logger.log(`[deletePhrase] id: ${id}`);

        // Декодируем initData если он был закодирован
        let decodedInitData = initData || '';
        if (decodedInitData) {
            try {
                decodedInitData = decodeURIComponent(decodedInitData);
                this.logger.log(`[deletePhrase] initData декодирован, длина: ${decodedInitData.length}`);
            } catch (e) {
                this.logger.warn(`[deletePhrase] Ошибка декодирования initData: ${e.message}`);
            }
        }

        const user = await this.webappService.validateTelegramUser(decodedInitData);
        if (!user || !user.isAdmin) {
            this.logger.warn(`[deletePhrase] ❌ Доступ запрещен. User: ${user ? 'found' : 'not found'}, isAdmin: ${user?.isAdmin || false}`);
            return { error: 'Forbidden' };
        }

        const phraseId = parseInt(id, 10);
        if (isNaN(phraseId)) {
            this.logger.warn(`[deletePhrase] ❌ Неверный ID фразы: ${id}`);
            return { error: 'Неверный ID фразы' };
        }

        try {
            await this.webappService.deletePhrase(phraseId);
            this.logger.log(`[deletePhrase] ✅ Фраза успешно удалена через API: id=${phraseId}`);
            return { success: true };
        } catch (error) {
            this.logger.error(`[deletePhrase] ❌ Ошибка при удалении фразы через API: ${error.message}`, error.stack);
            return { error: error.message || 'Ошибка при удалении фразы' };
        }
    }

    @Get()
    @Render('webapp')
    async getWebApp(@Query('initData') initData: string, @Req() req: Request) {
        // ПОЛНОЕ ЛОГИРОВАНИЕ ВСЕХ ДАННЫХ ЗАПРОСА
        this.logger.log(`[getWebApp] ========== ПОЛНЫЙ ЛОГ ЗАПРОСА ==========`);
        this.logger.log(`[getWebApp] Method: ${req.method}`);
        this.logger.log(`[getWebApp] URL: ${req.url}`);
        this.logger.log(`[getWebApp] Original URL: ${req.originalUrl}`);
        this.logger.log(`[getWebApp] Path: ${req.path}`);
        this.logger.log(`[getWebApp] Protocol: ${req.protocol}`);
        this.logger.log(`[getWebApp] Host: ${req.get('host')}`);
        this.logger.log(`[getWebApp] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);

        // Все query параметры
        this.logger.log(`[getWebApp] ========== QUERY PARAMS ==========`);
        this.logger.log(`[getWebApp] req.query: ${JSON.stringify(req.query, null, 2)}`);
        for (const [key, value] of Object.entries(req.query)) {
            this.logger.log(`[getWebApp]   ${key}: ${typeof value === 'string' ? value.substring(0, 100) : JSON.stringify(value)}`);
        }

        // Все заголовки
        this.logger.log(`[getWebApp] ========== HEADERS ==========`);
        for (const [key, value] of Object.entries(req.headers)) {
            const headerValue = Array.isArray(value) ? value.join(', ') : String(value);
            // Не логируем слишком длинные заголовки полностью
            if (headerValue.length > 200) {
                this.logger.log(`[getWebApp]   ${key}: ${headerValue.substring(0, 200)}... (${headerValue.length} chars)`);
            } else {
                this.logger.log(`[getWebApp]   ${key}: ${headerValue}`);
            }
        }

        // Проверяем все возможные источники initData
        let initDataFromQuery = initData || '';
        const tgWebAppData = (req.query['tgWebAppData'] as string) || '';
        const tgWebAppStartParam = (req.query['tgWebAppStartParam'] as string) || '';
        const tgWebAppVersion = (req.query['tgWebAppVersion'] as string) || '';
        const tgWebAppPlatform = (req.query['tgWebAppPlatform'] as string) || '';

        // Проверяем все возможные заголовки
        const initDataFromHeader = (req.headers['x-telegram-init-data'] as string) || '';
        const initDataFromHeader2 = (req.headers['telegram-init-data'] as string) || '';
        const initDataFromHeader3 = (req.headers['tg-init-data'] as string) || '';

        // Декодируем initData если он был закодирован
        if (initDataFromQuery) {
            try {
                initDataFromQuery = decodeURIComponent(initDataFromQuery);
            } catch (e) {
                this.logger.warn(`[getWebApp] Ошибка декодирования initData: ${e.message}`);
            }
        }

        const finalInitData = initDataFromQuery || tgWebAppData || tgWebAppStartParam ||
            initDataFromHeader || initDataFromHeader2 || initDataFromHeader3;

        this.logger.log(`[getWebApp] ========== INITDATA SOURCES ==========`);
        this.logger.log(`[getWebApp] Query 'initData': ${initDataFromQuery ? `✅ present (${initDataFromQuery.length} chars)` : '❌ missing'}`);
        this.logger.log(`[getWebApp] Query 'tgWebAppData': ${tgWebAppData ? `✅ present (${tgWebAppData.length} chars)` : '❌ missing'}`);
        this.logger.log(`[getWebApp] Query 'tgWebAppStartParam': ${tgWebAppStartParam ? `✅ present (${tgWebAppStartParam.length} chars)` : '❌ missing'}`);
        this.logger.log(`[getWebApp] Query 'tgWebAppVersion': ${tgWebAppVersion || 'missing'}`);
        this.logger.log(`[getWebApp] Query 'tgWebAppPlatform': ${tgWebAppPlatform || 'missing'}`);
        this.logger.log(`[getWebApp] Header 'x-telegram-init-data': ${initDataFromHeader ? `✅ present (${initDataFromHeader.length} chars)` : '❌ missing'}`);
        this.logger.log(`[getWebApp] Header 'telegram-init-data': ${initDataFromHeader2 ? `✅ present (${initDataFromHeader2.length} chars)` : '❌ missing'}`);
        this.logger.log(`[getWebApp] Header 'tg-init-data': ${initDataFromHeader3 ? `✅ present (${initDataFromHeader3.length} chars)` : '❌ missing'}`);
        this.logger.log(`[getWebApp] Final initData: ${finalInitData ? `✅ present (${finalInitData.length} chars)` : '❌ MISSING'}`);

        if (finalInitData) {
            this.logger.log(`[getWebApp] initData preview: ${finalInitData.substring(0, 200)}...`);
        } else {
            this.logger.error(`[getWebApp] ⚠️ initData полностью отсутствует во всех источниках!`);
            this.logger.error(`[getWebApp] Telegram Web App должен передавать initData через window.Telegram.WebApp.initData на клиенте`);
            this.logger.error(`[getWebApp] Или через специальные заголовки/параметры, которые мы проверяем выше`);
        }

        const user = await this.webappService.validateTelegramUser(finalInitData);

        // Всегда показываем статус, даже без авторизации
        const serverStatus = await this.webappService.getServerStatus();

        // Если пользователь не авторизован, показываем только статус
        if (!user) {
            this.logger.warn(`[getWebApp] ⚠️ Пользователь не авторизован, показываем только статус`);
            return {
                error: null,
                user: null,
                serverStatus,
                phrases: [],
                isAdmin: false,
                hasInitData: !!finalInitData,
            };
        }

        this.logger.log(`[getWebApp] ✅ Пользователь авторизован: ${user.name} (isAdmin: ${user.isAdmin})`);

        const phrases = user.isAdmin
            ? await this.webappService.getPhrases()
            : [];

        return {
            user,
            serverStatus,
            phrases,
            isAdmin: user.isAdmin,
            hasInitData: true,
        };
    }
}

