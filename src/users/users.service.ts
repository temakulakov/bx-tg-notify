import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) { }

  async create(dto: CreateUserDto) {
    const userExists = await this.checkIfUserExists(dto.bitrixId);

    if (userExists) {
      this.logger.error(
        `Пользователь с Bitrix ID ${dto.bitrixId} уже существует`,
      );
      return false;
    }

    await this.userRepository.save({
      bitrix_id: dto.bitrixId,
      name: dto.name,
      telegram_ids: [],
    });
    this.logger.debug(`Пользователь с Bitrix ID ${dto.bitrixId} создан`);
    return true;
  }

  private async checkIfUserExists(bitrixId: number): Promise<boolean> {
    const user = await this.userRepository.findOneBy({ bitrix_id: bitrixId });
    return !!user;
  }

  async findAll() {
    const result = await this.userRepository.find();
    return result;
  }

  async findOne(id: number): Promise<User | null> {
    const user = this.userRepository.findOneBy({ bitrix_id: id });
    if (user === null) {
      throw new BadRequestException(`Пользователь с id ${id} не найден`);
    }
    return user;
  }

  async findByBitrixId(bitrixId: number): Promise<User | null> {
    const user = await this.userRepository.findOneBy({ bitrix_id: bitrixId });
    if (!user) {
      this.logger.warn(`Пользователь с Bitrix ID ${bitrixId} не найден`);
    }
    return user;
  }

  async detachTelegramChatFromAnyUser(chatId: number): Promise<void> {
    const users = await this.userRepository.find();

    for (const user of users) {
      const ids = Array.isArray(user.telegram_ids) ? user.telegram_ids : [];

      if (!ids.includes(chatId)) {
        continue;
      }

      user.telegram_ids = ids.filter((id) => id !== chatId);
      await this.userRepository.save(user);
      this.logger.log(
        `Удалил Telegram чат ${chatId} у пользователя ${user.bitrix_id} из-за повторной авторизации`,
      );
    }
  }

  async attachTelegramChat(
    bitrixId: number,
    chatId: number,
  ): Promise<User | null> {
    await this.detachTelegramChatFromAnyUser(chatId);

    const user = await this.userRepository.findOneBy({ bitrix_id: bitrixId });

    if (!user) {
      this.logger.warn(
        `Не удалось привязать Telegram чат ${chatId}: пользователь ${bitrixId} не найден`,
      );
      return null;
    }

    const telegramIds = new Set(user.telegram_ids ?? []);
    const initialSize = telegramIds.size;
    telegramIds.add(chatId);

    user.telegram_ids = Array.from(telegramIds);

    if (telegramIds.size === initialSize) {
      this.logger.debug(
        `Telegram чат ${chatId} уже привязан к пользователю ${bitrixId}`,
      );
      return user;
    }

    await this.userRepository.save(user);
    this.logger.debug(
      `К пользователю ${bitrixId} привязан Telegram чат ${chatId}`,
    );

    return user;
  }

  async getTelegramChatIdsForBitrixUsers(
    bitrixIds: number[],
    excludeBitrixId?: number,
  ): Promise<number[]> {
    const uniqueIds = Array.from(new Set(bitrixIds)).filter((id) =>
      Number.isFinite(id),
    );
    const chats = new Set<number>();

    for (const id of uniqueIds) {
      if (excludeBitrixId && id === excludeBitrixId) {
        continue;
      }

      const user = await this.userRepository.findOneBy({ bitrix_id: id });

      if (!user) {
        this.logger.warn(
          `Пропускаю рассылку: пользователь с Bitrix ID ${id} не найден`,
        );
        continue;
      }

      if (!user.telegram_ids?.length) {
        this.logger.warn(
          `У пользователя ${id} нет привязанных Telegram-чатов для рассылки`,
        );
        continue;
      }

      user.telegram_ids.forEach((chatId) => chats.add(chatId));
    }

    return Array.from(chats.values());
  }

  /**
   * Обновление данных пользователя
   * @param bitrixId — ID пользователя из Bitrix
   * @param updateData — объект с обновляемыми данными
   */
  async update(bitrixId: number, updateData: Partial<User>): Promise<User> {
    // 1️⃣ Проверка наличия пользователя
    const user = await this.userRepository.findOneBy({ bitrix_id: bitrixId });

    if (!user) {
      this.logger.warn(`Пользователь с Bitrix ID ${bitrixId} не найден`);
      throw new BadRequestException(`Пользователь с ID ${bitrixId} не найден`);
    }

    // 2️⃣ Формируем данные для обновления
    const updatedUser = this.userRepository.merge(user, updateData);

    try {
      // 3️⃣ Сохраняем изменения
      const savedUser = await this.userRepository.save(updatedUser);

      // 4️⃣ Логируем результат
      this.logger.debug(
        `Пользователь с Bitrix ID ${bitrixId} обновлён: ${JSON.stringify(updateData)}`,
      );

      // 5️⃣ Возвращаем обновлённые данные (актуальные после save)
      return savedUser;
    } catch (error) {
      this.logger.error(
        `Ошибка при обновлении пользователя ${bitrixId}: ${error instanceof Error ? error.message : error}`,
      );
      throw new BadRequestException('Ошибка при обновлении пользователя');
    }
  }

  async remove(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }
}
