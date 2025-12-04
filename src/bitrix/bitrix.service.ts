import { Injectable, Logger } from '@nestjs/common';
import { BitrixHttpService } from './bitrix-http.service';
import {
  BitrixDiskFile,
  BitrixResponse,
  BitrixTask,
  BitrixUser,
  BitrixTaskComment,
  BitrixDialogMessage,
  BitrixDialogMessagesResponse,
} from './entities/bitrix-response.type';
import { BitrixMethod } from './constants/bitrix-methods.enum';

@Injectable()
export class BitrixService {
  private readonly logger = new Logger(BitrixService.name);

  constructor(private readonly bitrixHttp: BitrixHttpService) {}

  async getUsers(): Promise<BitrixResponse<BitrixUser[]>> {
    return this.bitrixHttp.getAll<BitrixUser>(BitrixMethod.USER_GET, {
      select: ['ID', 'NAME', 'LAST_NAME'],
      filter: { ACTIVE: 'Y' },
    });
  }

  async getFile(id: number): Promise<BitrixResponse<BitrixDiskFile>> {
    return this.bitrixHttp.post(BitrixMethod.GET_FILE, {
      id,
    });
  }

  async getTask(id: number): Promise<BitrixResponse<{ task: BitrixTask }>> {
    this.logger.debug(`[getTask] Запрос задачи ${id} с полями: ID, TITLE, DESCRIPTION, DEADLINE, REPLICATE, CREATED_BY, RESPONSIBLE_ID, TAGS, chatId`);
    
    const response = await this.bitrixHttp.post<{ task: BitrixTask }>(BitrixMethod.TASK, {
      id,
      select: [
        'ID',
        'TITLE',
        'DESCRIPTION',
        'DEADLINE',
        'REPLICATE',
        'CREATED_BY',
        'RESPONSIBLE_ID',
        'TAGS',
        'CHAT_ID',
      ],
    });
    
    this.logger.debug(
      `[getTask] Получена задача ${id}, chatId: ${response.result?.task?.chatId || 'не указан'}`,
    );
    
    return response;
  }

  /**
   * Получает комментарий к задаче через новый API im.dialog.messages.get
   * Метод task.commentitem.get устарел с версии tasks 25.700.0
   * 
   * @param taskId ID задачи (Bitrix ID)
   * @param messageId ID сообщения (MESSAGE_ID из вебхука)
   * @param chatId ID чата задачи из БД
   * @returns Данные комментария в формате, совместимом со старым интерфейсом
   */
  async getTaskComment(
    taskId: number,
    messageId: number,
    chatId: number | null,
  ): Promise<BitrixResponse<BitrixTaskComment>> {
    this.logger.log(
      `[getTaskComment] ========== НАЧАЛО ПОЛУЧЕНИЯ КОММЕНТАРИЯ ==========`,
    );
    this.logger.log(`[getTaskComment] Параметры: taskId=${taskId}, messageId=${messageId}, chatId=${chatId}`);
    
    try {
      if (!chatId) {
        this.logger.error(
          `[getTaskComment] ❌ chatId не указан для задачи ${taskId}. Невозможно получить комментарий.`,
        );
        throw new Error(`chatId is required for task ${taskId}`);
      }

      // Используем chatId с префиксом "chat" как DIALOG_ID
      const dialogId = `chat${chatId}`;
      
      this.logger.log(
        `[getTaskComment] Используем DIALOG_ID=${dialogId} (из chatId задачи ${taskId})`,
      );

      this.logger.debug(
        `[getTaskComment] Отправка запроса к Bitrix API:`,
      );
      this.logger.debug(
        `[getTaskComment]   Метод: ${BitrixMethod.TASK_COMMENT}`,
      );
      this.logger.debug(
        `[getTaskComment]   Параметры: DIALOG_ID=${dialogId}`,
      );

      let response: BitrixResponse<BitrixDialogMessagesResponse>;
      
      try {
        response = await this.bitrixHttp.post<BitrixDialogMessagesResponse>(
          BitrixMethod.TASK_COMMENT,
          {
            DIALOG_ID: dialogId,
          },
        );
        
        this.logger.log(
          `[getTaskComment] ✅ Получен ответ от Bitrix API`,
        );
        this.logger.debug(
          `[getTaskComment]   Статус: успешно`,
        );
        this.logger.debug(
          `[getTaskComment]   Количество сообщений в ответе: ${response.result?.messages?.length || 0}`,
        );
      } catch (error: any) {
        this.logger.error(
          `[getTaskComment] ❌ Ошибка при запросе к Bitrix API:`,
        );
        this.logger.error(
          `[getTaskComment]   DIALOG_ID: ${dialogId}`,
        );
        this.logger.error(
          `[getTaskComment]   Ошибка: ${error?.response?.data?.error_description || error?.response?.data?.error || error.message}`,
        );
        if (error?.response?.data) {
          this.logger.error(
            `[getTaskComment]   Полный ответ ошибки: ${JSON.stringify(error.response.data, null, 2)}`,
          );
        }
        throw error;
      }
      
      if (!response || !response.result) {
        this.logger.warn(
          `[getTaskComment] ⚠️ Пустой ответ от Bitrix для диалога ${dialogId}`,
        );
        return {
          result: null as any,
          time: response?.time || { start: 0, finish: 0, duration: 0, processing: 0, date_start: '', date_finish: '', operating_reset_at: 0, operating: 0 },
        };
      }

      // Берем сообщение с самым большим id из массива messages
      const messages = response.result.messages || [];
      this.logger.debug(
        `[getTaskComment] Найдено сообщений в ответе: ${messages.length}`,
      );
      
      if (messages.length === 0) {
        this.logger.warn(
          `[getTaskComment] ⚠️ В ответе нет сообщений для диалога ${dialogId}`,
        );
        return {
          result: null as any,
          time: response.time,
        };
      }

      // Выводим все ID сообщений для отладки
      if (messages.length > 0) {
        const messageIds = messages.map(m => {
          const id = typeof m.id === 'string' ? parseInt(m.id, 10) : Number(m.id);
          return isNaN(id) ? String(m.id) : id;
        }).sort((a, b) => {
          const aNum = typeof a === 'number' ? a : parseInt(String(a), 10);
          const bNum = typeof b === 'number' ? b : parseInt(String(b), 10);
          return bNum - aNum; // Сортируем по убыванию
        });
        this.logger.debug(
          `[getTaskComment] ID сообщений в ответе (отсортированы): ${messageIds.join(', ')}`,
        );
      }

      // Находим сообщение с максимальным id (последнее сообщение)
      const targetMessage = messages.reduce((max, msg) => {
        const msgId = typeof msg.id === 'string' ? parseInt(msg.id, 10) : Number(msg.id);
        const maxId = typeof max.id === 'string' ? parseInt(max.id, 10) : Number(max.id);
        if (isNaN(msgId)) return max;
        if (isNaN(maxId)) return msg;
        return msgId > maxId ? msg : max;
      }, messages[0]);

      this.logger.log(
        `[getTaskComment] ✅ Найдено сообщение с максимальным ID: ${targetMessage.id}`,
      );
      this.logger.debug(
        `[getTaskComment]   Полный объект сообщения: ${JSON.stringify({
          id: targetMessage.id,
          text_length: (targetMessage.text || '').length,
          author_id: targetMessage.author_id || targetMessage.authorId,
          date: targetMessage.date,
        }, null, 2)}`,
      );
      this.logger.debug(
        `[getTaskComment]   Текст (первые 200 символов): ${(targetMessage.text || '').substring(0, 200)}...`,
      );

      // Преобразуем новую структуру в старую для совместимости
      // Используем text как описание и author_id как автора
      const commentData: BitrixTaskComment = {
        ID: String(targetMessage.id),
        POST_MESSAGE: targetMessage.text || '',
        AUTHOR_ID: String(
          targetMessage.author_id ||
          targetMessage.authorId ||
          targetMessage.userId ||
          '',
        ),
        POST_DATE: targetMessage.date || '',
      };

      this.logger.log(
        `[getTaskComment] ✅ Комментарий успешно преобразован в формат BitrixTaskComment`,
      );
      this.logger.debug(
        `[getTaskComment]   POST_MESSAGE длина: ${commentData.POST_MESSAGE.length} символов`,
      );
      this.logger.debug(
        `[getTaskComment]   AUTHOR_ID: ${commentData.AUTHOR_ID}`,
      );
      this.logger.log(
        `[getTaskComment] ========== КОНЕЦ ПОЛУЧЕНИЯ КОММЕНТАРИЯ ==========`,
      );

      return {
        result: commentData,
        time: response.time,
      };
    } catch (error) {
      this.logger.error(
        `[getTaskComment] ❌ КРИТИЧЕСКАЯ ОШИБКА при получении комментария ${messageId} для задачи ${taskId}:`,
      );
      this.logger.error(
        `[getTaskComment]   Ошибка: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof Error && error.stack) {
        this.logger.error(
          `[getTaskComment]   Stack trace: ${error.stack}`,
        );
      }
      this.logger.log(
        `[getTaskComment] ========== КОНЕЦ (С ОШИБКОЙ) ==========`,
      );
      throw error;
    }
  }
}
