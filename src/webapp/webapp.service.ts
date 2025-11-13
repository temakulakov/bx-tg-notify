import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { PhrasesService } from '../phrases/phrases.service';
import * as crypto from 'crypto';

interface TelegramWebAppUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
}

interface TelegramWebAppInitData {
    query_id?: string;
    user?: string;
    auth_date: number;
    hash: string;
}

@Injectable()
export class WebappService {
    private readonly logger = new Logger(WebappService.name);
    private readonly botToken: string;

    constructor(
        private readonly usersService: UsersService,
        private readonly dashboardService: DashboardService,
        private readonly phrasesService: PhrasesService,
    ) {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    }

    async validateTelegramUser(initData: string) {
        this.logger.log(`[validateTelegramUser] ========== НАЧАЛО ВАЛИДАЦИИ ==========`);
        this.logger.log(`[validateTelegramUser] initData length: ${initData?.length || 0}`);

        if (!initData) {
            this.logger.warn('[validateTelegramUser] initData пустой или отсутствует');
            return null;
        }

        try {
            // Парсим initData
            this.logger.log(`[validateTelegramUser] initData preview: ${initData.substring(0, 200)}...`);
            this.logger.log(`[validateTelegramUser] initData full: ${initData}`);

            const params = new URLSearchParams(initData);
            const hash = params.get('hash') || '';
            const authDate = parseInt(params.get('auth_date') || '0', 10);
            const userStr = params.get('user');
            const signature = params.get('signature') || '';

            this.logger.log(`[validateTelegramUser] Параметры из initData:`);
            this.logger.log(`[validateTelegramUser]   hash: ${hash ? `${hash.substring(0, 20)}... (${hash.length} chars)` : 'missing'}`);
            this.logger.log(`[validateTelegramUser]   auth_date: ${authDate}`);
            this.logger.log(`[validateTelegramUser]   user: ${userStr ? 'present' : 'missing'}`);
            this.logger.log(`[validateTelegramUser]   signature: ${signature ? 'present' : 'missing'}`);

            if (!hash) {
                this.logger.error('[validateTelegramUser] ❌ Отсутствует hash в initData');
                return null;
            }

            if (!authDate || authDate === 0) {
                this.logger.error('[validateTelegramUser] ❌ Отсутствует или неверный auth_date');
                return null;
            }

            // Проверяем, что данные не старше 24 часов
            const now = Math.floor(Date.now() / 1000);
            const age = now - authDate;
            this.logger.log(`[validateTelegramUser] Возраст данных: ${age} секунд (${Math.floor(age / 3600)} часов)`);

            if (age > 86400) {
                this.logger.warn(`[validateTelegramUser] ⚠️ Telegram initData expired. Age: ${age} seconds`);
                return null;
            }

            // Проверяем подпись
            // Создаем dataCheckString из всех параметров кроме hash, отсортированных по ключу
            const dataCheckString = Array.from(params.entries())
                .filter(([key]) => key !== 'hash')
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');

            this.logger.log(`[validateTelegramUser] dataCheckString: ${dataCheckString.substring(0, 300)}...`);
            this.logger.log(`[validateTelegramUser] dataCheckString full: ${dataCheckString}`);

            if (!this.botToken) {
                this.logger.error('[validateTelegramUser] ❌ TELEGRAM_BOT_TOKEN не установлен');
                return null;
            }

            this.logger.log(`[validateTelegramUser] botToken: ${this.botToken.substring(0, 10)}...${this.botToken.substring(this.botToken.length - 5)}`);

            // Создаем секретный ключ: HMAC-SHA256("WebAppData", bot_token)
            const secretKey = crypto
                .createHmac('sha256', 'WebAppData')
                .update(this.botToken)
                .digest();

            this.logger.log(`[validateTelegramUser] secretKey создан, длина: ${secretKey.length} bytes`);

            // Вычисляем hash: HMAC-SHA256(secret_key, data_check_string)
            const calculatedHash = crypto
                .createHmac('sha256', secretKey)
                .update(dataCheckString)
                .digest('hex');

            this.logger.log(`[validateTelegramUser] Hash сравнение:`);
            this.logger.log(`[validateTelegramUser]   received: ${hash}`);
            this.logger.log(`[validateTelegramUser]   calculated: ${calculatedHash}`);
            this.logger.log(`[validateTelegramUser]   match: ${calculatedHash === hash ? '✅ YES' : '❌ NO'}`);

            if (calculatedHash !== hash) {
                this.logger.error(`[validateTelegramUser] ❌ Invalid Telegram initData hash!`);
                this.logger.error(`[validateTelegramUser] Received: ${hash}`);
                this.logger.error(`[validateTelegramUser] Calculated: ${calculatedHash}`);
                this.logger.error(`[validateTelegramUser] dataCheckString was: ${dataCheckString}`);
                return null;
            }

            this.logger.log('[validateTelegramUser] ✅ Подпись валидна');

            // Парсим пользователя
            if (!userStr) {
                this.logger.error('[validateTelegramUser] ❌ Отсутствует параметр user в initData');
                return null;
            }

            let telegramUser: TelegramWebAppUser;
            try {
                telegramUser = JSON.parse(userStr);
            } catch (e) {
                this.logger.error(`[validateTelegramUser] ❌ Ошибка парсинга user JSON: ${e.message}`);
                this.logger.error(`[validateTelegramUser] userStr: ${userStr}`);
                return null;
            }

            const telegramId = telegramUser.id;
            const telegramName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || telegramUser.username || `User ${telegramId}`;

            this.logger.log(`[validateTelegramUser] Telegram user: id=${telegramId}, username=${telegramUser.username || 'N/A'}, first_name=${telegramUser.first_name || 'N/A'}`);

            // Находим пользователя в БД
            const users = await this.usersService.findAll();
            this.logger.log(`[validateTelegramUser] Всего пользователей в БД: ${users.length}`);
            
            // Логируем всех пользователей для отладки
            users.forEach(u => {
                this.logger.log(`[validateTelegramUser]   User: ${u.name}, telegram_ids: ${JSON.stringify(u.telegram_ids)}`);
            });
            
            const user = users.find(
                (u) => u.telegram_ids && u.telegram_ids.includes(telegramId),
            );

            // Если пользователя нет в БД - возвращаем null (не создаем автоматически)
            if (!user) {
                this.logger.warn(`[validateTelegramUser] ❌ User with telegram_id ${telegramId} not found in database`);
                this.logger.warn(`[validateTelegramUser] Пользователь должен быть создан в БД и связан с telegram_id через команду /start в боте`);
                return null;
            }

            // Пользователь найден, проверяем, что telegram_id добавлен (на случай если его добавили вручную)
            if (!user.telegram_ids.includes(telegramId)) {
                user.telegram_ids.push(telegramId);
                await this.usersService.update(user.bitrix_id, {
                    telegram_ids: user.telegram_ids,
                });
                this.logger.log(`[validateTelegramUser] ✅ telegram_id ${telegramId} добавлен к пользователю ${user.name}`);
            }

            this.logger.log(`[validateTelegramUser] ✅ Пользователь найден: ${user.name} (bitrix_id: ${user.bitrix_id}, isAdmin: ${user.isAdmin || false})`);

            return {
                telegramId,
                bitrixId: user.bitrix_id,
                name: user.name,
                isAdmin: user.isAdmin || false,
            };
        } catch (error) {
            this.logger.error(`[validateTelegramUser] ❌ Error validating Telegram user: ${error.message}`);
            this.logger.error(`[validateTelegramUser] Stack: ${error.stack}`);
            return null;
        }
    }

    async getServerStatus() {
        const status = await this.dashboardService.getSystemStatus();
        // Добавляем флаги для удобства в шаблонах
        return {
            database: {
                ...status.database,
                isOk: status.database.status === 'ok',
                isError: status.database.status === 'error',
                isWarning: status.database.status === 'warning',
            },
            telegram: {
                ...status.telegram,
                isOk: status.telegram.status === 'ok',
                isError: status.telegram.status === 'error',
                isWarning: status.telegram.status === 'warning',
            },
            bitrix: {
                ...status.bitrix,
                isOk: status.bitrix.status === 'ok',
                isError: status.bitrix.status === 'error',
                isWarning: status.bitrix.status === 'warning',
            },
            server: {
                ...status.server,
                isOk: status.server.status === 'ok',
                isError: status.server.status === 'error',
                isWarning: status.server.status === 'warning',
            },
        };
    }

    async getPhrases() {
        return this.phrasesService.findAll();
    }

    async createPhrase(text: string) {
        this.logger.log(`[createPhrase] Создание фразы: "${text}"`);
        try {
            const phrase = await this.phrasesService.create(text);
            this.logger.log(`[createPhrase] ✅ Фраза создана успешно: id=${phrase.id}, text="${phrase.text}"`);
            return phrase;
        } catch (error) {
            this.logger.error(`[createPhrase] ❌ Ошибка при создании фразы: ${error.message}`, error.stack);
            throw error;
        }
    }

    async deletePhrase(id: number) {
        return this.phrasesService.remove(id);
    }
}

