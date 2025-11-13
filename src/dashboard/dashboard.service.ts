import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TelegramService } from '../telegram/telegram.service';
import { BitrixHttpService } from '../bitrix/bitrix-http.service';
import { BitrixMethod } from '../bitrix/constants/bitrix-methods.enum';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BitrixUser } from 'src/bitrix/entities/bitrix-response.type';

const execAsync = promisify(exec);

export interface SystemStatus {
    status: 'ok' | 'error' | 'warning';
    message: string;
    details?: any;
}

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly telegramService: TelegramService,
        private readonly bitrixHttpService: BitrixHttpService,
    ) { }

    async getSystemStatus() {
        const [dbStatus, telegramStatus, bitrixStatus, serverMetrics] =
            await Promise.all([
                this.checkDatabase(),
                this.checkTelegram(),
                this.checkBitrix(),
                this.getServerMetrics(),
            ]);

        return {
            database: dbStatus,
            telegram: telegramStatus,
            bitrix: bitrixStatus,
            server: serverMetrics,
        };
    }

    private async checkDatabase(): Promise<SystemStatus> {
        try {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.query('SELECT 1');
            await queryRunner.release();

            return {
                status: 'ok',
                message: 'База данных доступна',
            };
        } catch (error) {
            this.logger.error('Ошибка проверки БД', error);
            return {
                status: 'error',
                message: 'База данных недоступна',
                details: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async checkTelegram(): Promise<SystemStatus> {
        try {
            const botInfo = await this.telegramService.getBotInfo();
            return {
                status: 'ok',
                message: `Бот активен: @${botInfo.username}`,
                details: {
                    id: botInfo.id,
                    username: botInfo.username,
                    firstName: botInfo.first_name,
                },
            };
        } catch (error) {
            this.logger.error('Ошибка проверки Telegram бота', error);
            return {
                status: 'error',
                message: 'Telegram бот недоступен',
                details: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async checkBitrix(): Promise<SystemStatus> {
        try {
            // Пробуем выполнить простой запрос к Bitrix API
            const response = await this.bitrixHttpService.post<BitrixUser[]>(
                BitrixMethod.USER_GET,
                {
                    filter: { ACTIVE: 'Y' },
                    select: ['ID'],
                },
            );

            // Проверяем наличие результата
            if (!response.result) {
                return {
                    status: 'error',
                    message: 'Bitrix24 API вернул пустой результат',
                };
            }

            return {
                status: 'ok',
                message: 'Bitrix24 API доступен',
                details: {
                    time: response.time,
                },
            };
        } catch (error) {
            this.logger.error('Ошибка проверки Bitrix24 API', error);
            return {
                status: 'error',
                message: 'Bitrix24 API недоступен',
                details: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async getServerMetrics(): Promise<SystemStatus> {
        try {
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsagePercentValue = (usedMemory / totalMemory) * 100;
            const memoryUsagePercent = memoryUsagePercentValue.toFixed(2);

            const cpus = os.cpus();
            const loadAvg = os.loadavg();

            // Вычисляем загрузку CPU
            let cpuUsagePercent = 0;
            if (cpus.length > 0) {
                // Используем loadAverage[0] (1 минута) как индикатор загрузки
                // Нормализуем относительно количества ядер
                const normalizedLoad = (loadAvg[0] / cpus.length) * 100;
                cpuUsagePercent = Math.min(normalizedLoad, 100); // Ограничиваем до 100%
            }

            // Получаем информацию о диске
            let diskInfo: { total: string; used: string; free: string; usagePercent: number } | null = null;
            try {
                diskInfo = await this.getDiskSpace();
            } catch (error) {
                this.logger.warn('Не удалось получить информацию о диске', error);
            }

            const status = memoryUsagePercentValue > 90 || cpuUsagePercent > 90 || (diskInfo !== null && diskInfo.usagePercent > 90)
                ? 'warning'
                : memoryUsagePercentValue > 80 || cpuUsagePercent > 80 || (diskInfo !== null && diskInfo.usagePercent > 80)
                    ? 'warning'
                    : 'ok';

            return {
                status,
                message: `Память: ${memoryUsagePercent}% | CPU: ${cpuUsagePercent.toFixed(1)}%`,
                details: {
                    memory: {
                        total: this.formatBytes(totalMemory),
                        used: this.formatBytes(usedMemory),
                        free: this.formatBytes(freeMemory),
                        usagePercent: memoryUsagePercentValue,
                    },
                    cpu: {
                        cores: cpus.length,
                        loadAverage: loadAvg.map((load) => load.toFixed(2)),
                        usagePercent: cpuUsagePercent,
                    },
                    disk: diskInfo,
                    uptime: this.formatUptime(os.uptime()),
                },
            };
        } catch (error) {
            this.logger.error('Ошибка получения метрик сервера', error);
            return {
                status: 'error',
                message: 'Не удалось получить метрики сервера',
                details: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async getDiskSpace(): Promise<{
        total: string;
        used: string;
        free: string;
        usagePercent: number;
    } | null> {
        try {
            // Используем системную команду df для получения информации о диске
            const { stdout } = await execAsync('df -h /');
            const lines = stdout.trim().split('\n');
            if (lines.length < 2) {
                return null;
            }

            // Парсим строку (формат: Filesystem Size Used Avail Use% Mounted on)
            const parts = lines[1].split(/\s+/);
            if (parts.length < 5) {
                return null;
            }

            const total = parts[1];
            const used = parts[2];
            const available = parts[3];
            const usagePercentStr = parts[4].replace('%', '');
            const usagePercent = parseFloat(usagePercentStr);

            // Конвертируем в байты для единообразия (приблизительно)
            const totalBytes = this.parseSizeToBytes(total);
            const usedBytes = this.parseSizeToBytes(used);
            const freeBytes = this.parseSizeToBytes(available);

            return {
                total: total,
                used: used,
                free: available,
                usagePercent: usagePercent,
            };
        } catch (error) {
            this.logger.warn('Ошибка получения информации о диске', error);
            return null;
        }
    }

    private parseSizeToBytes(sizeStr: string): number {
        const units: { [key: string]: number } = {
            'K': 1024,
            'M': 1024 * 1024,
            'G': 1024 * 1024 * 1024,
            'T': 1024 * 1024 * 1024 * 1024,
        };

        const match = sizeStr.match(/^([\d.]+)([KMGT])?$/i);
        if (!match) {
            return 0;
        }

        const value = parseFloat(match[1]);
        const unit = match[2]?.toUpperCase() || '';
        const multiplier = units[unit] || 1;

        return value * multiplier;
    }

    private formatBytes(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}д ${hours}ч ${minutes}м`;
    }
}

