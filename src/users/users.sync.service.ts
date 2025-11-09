import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from './users.service';
import { BitrixService } from '../bitrix/bitrix.service';

@Injectable()
export class UsersSyncService {
  private readonly logger = new Logger(UsersSyncService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly bitrixService: BitrixService,
  ) {}

  /**
   * 🕒 Запуск синхронизации каждую минуту
   */
  @Cron(CronExpression.EVERY_HOUR)
  async syncUsers(): Promise<void> {
    this.logger.log('🔄 Начало синхронизации пользователей с Bitrix24...');

    try {
      // 1️⃣ Получаем пользователей из Bitrix
      const bitrixResponse = await this.bitrixService.getUsers();
      const bitrixUsers = bitrixResponse.result || [];

      if (!Array.isArray(bitrixUsers)) {
        this.logger.error('❌ Неверный формат ответа Bitrix24');
        return;
      }

      // 2️⃣ Получаем текущих пользователей из БД
      const dbUsers = await this.usersService.findAll();

      // 3️⃣ Преобразуем данные в удобные структуры
      const bitrixIds = bitrixUsers.map((u) => Number(u.ID));
      const dbIds = dbUsers.map((u) => u.bitrix_id);

      // 4️⃣ Добавляем новых пользователей
      const newUsers = bitrixUsers.filter((u) => !dbIds.includes(Number(u.ID)));

      for (const newUser of newUsers) {
        await this.usersService.create({
          bitrixId: Number(newUser.ID),
          name: `${newUser.NAME} ${newUser.LAST_NAME || ''}`.trim(),
        });
      }

      // 5️⃣ Обновляем имена изменившихся пользователей
      for (const dbUser of dbUsers) {
        const bitrixUser = bitrixUsers.find(
          (u) => Number(u.ID) === dbUser.bitrix_id,
        );

        if (bitrixUser) {
          const fullName =
            `${bitrixUser.NAME} ${bitrixUser.LAST_NAME || ''}`.trim();
          if (dbUser.name !== fullName) {
            await this.usersService.update(dbUser.bitrix_id, {
              name: fullName,
            });
            this.logger.debug(
              `✏️ Имя пользователя ${dbUser.bitrix_id} обновлено: "${dbUser.name}" → "${fullName}"`,
            );
          }
        }
      }

      // 6️⃣ Удаляем пользователей, которых больше нет в Bitrix
      const usersToDelete = dbUsers.filter(
        (dbUser) => !bitrixIds.includes(dbUser.bitrix_id),
      );

      for (const user of usersToDelete) {
        await this.usersService.remove(user.id);
        this.logger.warn(
          `🗑 Пользователь с Bitrix ID ${user.bitrix_id} удалён из базы (нет в Bitrix)`,
        );
      }

      this.logger.log(
        `✅ Синхронизация завершена: добавлено ${newUsers.length}, обновлено ${bitrixUsers.length - usersToDelete.length - newUsers.length}, удалено ${usersToDelete.length}`,
      );
    } catch (error) {
      this.logger.error(`❌ Ошибка синхронизации: ${error.message}`);
    }
  }
}
