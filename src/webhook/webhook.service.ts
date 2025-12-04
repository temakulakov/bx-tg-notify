import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BitrixWebhookDto, BitrixWebhookType } from './dto/bitrix-webhook.dto';
import { TaskProcessor } from '../tasks/task.processor';
import { TelegramService } from '../telegram/telegram.service';

interface DocumentApprovalQuery {
  receiver?: string;
  sender?: string;
  document?: string;
  description?: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly taskProcessor: TaskProcessor,
    private readonly telegramService: TelegramService,
  ) { }

  /**
   * Обрабатывает входящий вебхук от Bitrix24
   * @param dto - Валидированный DTO вебхука
   */
  async handleWebhook(dto: BitrixWebhookDto): Promise<void> {
    this.logger.log(`Обработка вебхука: ${dto.event}`);

    switch (dto.event) {
      case BitrixWebhookType.OnTaskAdd:
        await this.handleTaskAdd(dto);
        break;
      case BitrixWebhookType.OnTaskUpdate:
        await this.handleTaskUpdate(dto);
        break;
      case BitrixWebhookType.OnTaskCommentAdd:
        await this.handleTaskCommentAdd(dto);
        break;
      default:
        this.logger.warn(`Неизвестный тип события: ${dto.event}`);
    }
  }

  /**
   * Обрабатывает событие добавления задачи
   */
  private async handleTaskAdd(dto: BitrixWebhookDto): Promise<void> {
    const taskId = dto.data.FIELDS_AFTER?.ID;
    if (!taskId) {
      this.logger.warn(
        `Отсутствует ID в FIELDS_AFTER для события ${dto.event}`,
      );
      throw new BadRequestException('Task ID is required');
    }

    const task = await this.taskProcessor.newTaskWebhook({ id: taskId });
    if (!task) {
      this.logger.debug(
        `Задача ${taskId}: создание пропущено (например, регулярная задача или ошибка Bitrix)`,
      );
      return;
    }

    await this.telegramService.notifyTaskCreated(task);
  }

  /**
   * Обрабатывает событие обновления задачи
   */
  private async handleTaskUpdate(dto: BitrixWebhookDto): Promise<void> {
    const taskId = dto.data.FIELDS_AFTER?.ID;
    if (!taskId) {
      this.logger.warn(
        `Отсутствует ID в FIELDS_AFTER для события ${dto.event}`,
      );
      throw new BadRequestException('Task ID is required');
    }

    const updateResult = await this.taskProcessor.updateTaskWebhook({
      id: taskId,
    });

    if (!updateResult) {
      this.logger.debug(
        `Задача ${taskId}: обновление пропущено (возможно, регулярная задача или ошибка получения данных)`,
      );
      return;
    }

    const { updatedTask, changes, notifyAsCreated, notifyAsFixed, isRegular } = updateResult;

    // Если задача регулярная и не было исправления, не отправляем уведомления
    if (isRegular && !notifyAsFixed) {
      this.logger.debug(
        `Задача ${taskId} регулярная, обновлена в БД, уведомления не отправляются`,
      );
      return;
    }

    // Уведомление об исправлении (задача была регулярной, стала обычной)
    if (notifyAsFixed) {
      this.logger.log(
        `Задача ${taskId} исправлена (была регулярной, теперь обычная), отправляем уведомление об исправлении`,
      );
      await this.telegramService.notifyTaskCreated(updatedTask, {
        heading: '<b>✅ Задача исправлена</b>\n\nЗадача была помечена как регулярная, но теперь исправлена и требует внимания.',
      });
      return;
    }

    if (notifyAsCreated) {
      await this.telegramService.notifyTaskCreated(updatedTask, {
        heading: '<b>Задача обновлена</b>',
      });
      return;
    }

    if (!changes.length) {
      this.logger.debug(
        `Задача ${taskId} обновлена без изменений в значимых полях`,
      );
      return;
    }

    await this.telegramService.notifyTaskUpdated(updatedTask, changes);
  }

  /**
   * Обрабатывает событие добавления комментария к задаче
   */
  private async handleTaskCommentAdd(dto: BitrixWebhookDto): Promise<void> {
    this.logger.log(
      `[handleTaskCommentAdd] ========== НАЧАЛО ОБРАБОТКИ ВЕБХУКА КОММЕНТАРИЯ ==========`,
    );
    this.logger.log(
      `[handleTaskCommentAdd] Событие: ${dto.event}, event_handler_id: ${dto.event_handler_id}`,
    );
    
    const taskId = dto.data.FIELDS_AFTER?.TASK_ID;
    // Для комментариев ID комментария находится в MESSAGE_ID, а не в ID
    // ID может быть 0 или отсутствовать для комментариев
    const messageId = dto.data.FIELDS_AFTER?.MESSAGE_ID;
    const commentId = dto.data.FIELDS_AFTER?.ID;

    this.logger.log(
      `[handleTaskCommentAdd] Данные из вебхука FIELDS_AFTER:`,
    );
    this.logger.log(
      `[handleTaskCommentAdd]   TASK_ID: ${taskId || 'не указан'}`,
    );
    this.logger.log(
      `[handleTaskCommentAdd]   MESSAGE_ID: ${messageId || 'не указан'}`,
    );
    this.logger.log(
      `[handleTaskCommentAdd]   ID: ${commentId || 'не указан'}`,
    );
    this.logger.debug(
      `[handleTaskCommentAdd] Полный FIELDS_AFTER: ${JSON.stringify(dto.data.FIELDS_AFTER, null, 2)}`,
    );

    if (!taskId || taskId === 0) {
      this.logger.error(
        `[handleTaskCommentAdd] ❌ Отсутствует или невалиден TASK_ID в FIELDS_AFTER для события ${dto.event}: ${taskId}`,
      );
      throw new BadRequestException('Task ID is required');
    }

    // Для комментариев используем MESSAGE_ID как основной ID комментария
    // MESSAGE_ID - это реальный ID комментария в Bitrix
    let finalCommentId: number | undefined;
    
    if (messageId && messageId > 0) {
      finalCommentId = messageId;
      this.logger.log(
        `[handleTaskCommentAdd] Используем MESSAGE_ID как ID комментария: ${finalCommentId}`,
      );
    } else if (commentId && commentId > 0) {
      finalCommentId = commentId;
      this.logger.log(
        `[handleTaskCommentAdd] Используем ID как ID комментария (MESSAGE_ID не указан): ${finalCommentId}`,
      );
    }

    if (!finalCommentId) {
      this.logger.error(
        `[handleTaskCommentAdd] ❌ Отсутствует или невалиден ID комментария в FIELDS_AFTER для события ${dto.event}`,
      );
      this.logger.error(
        `[handleTaskCommentAdd]   MESSAGE_ID: ${messageId}, ID: ${commentId}`,
      );
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.log(
      `[handleTaskCommentAdd] ✅ Валидация пройдена: taskId=${taskId}, commentId=${finalCommentId}`,
    );
    this.logger.log(
      `[handleTaskCommentAdd] Передача обработки в TaskProcessor...`,
    );

    await this.taskProcessor.newTaskCommentWebhook({
      id: taskId,
      commentId: finalCommentId,
    });
    
    this.logger.log(
      `[handleTaskCommentAdd] ✅ Обработка комментария завершена успешно`,
    );
    this.logger.log(
      `[handleTaskCommentAdd] ========== КОНЕЦ ОБРАБОТКИ ВЕБХУКА КОММЕНТАРИЯ ==========`,
    );
  }

  async handleDocumentApproval(query: DocumentApprovalQuery): Promise<void> {
    this.logger.log(
      `[DocumentApproval] Начало обработки запроса: ${JSON.stringify(query)}`,
    );

    const receiverId = this.extractUserId(query.receiver);
    const senderId = this.extractUserId(query.sender);
    const documentId = query.document?.toString().trim();
    const description = query.description ?? '';

    this.logger.log(
      `[DocumentApproval] Распарсенные данные: receiverId=${receiverId}, senderId=${senderId}, documentId="${documentId}", descriptionLength=${description.length}`,
    );

    if (!receiverId) {
      this.logger.warn(
        `Запрос document-approval отклонен: не удалось определить получателя из значения "${query.receiver}".`,
      );
      return;
    }

    if (!documentId) {
      this.logger.warn(
        `Запрос document-approval для пользователя ${receiverId} отклонен: отсутствует идентификатор документа.`,
      );
      return;
    }

    this.logger.log(
      `[DocumentApproval] Отправка уведомления получателю ${receiverId} от отправителя ${senderId ?? 'неизвестного'}`,
    );

    await this.telegramService.notifyDocumentApproval({
      receiverId,
      senderId: senderId ?? undefined,
      description,
      documentId,
    });
  }

  private extractUserId(value?: string): number | null {
    if (!value) {
      this.logger.debug(`[extractUserId] Пустое значение, возвращаю null`);
      return null;
    }

    const match = value.match(/(\d+)/);
    if (!match) {
      this.logger.debug(
        `[extractUserId] Не найдено числа в значении "${value}", возвращаю null`,
      );
      return null;
    }

    const userId = Number(match[1]);
    const result = Number.isFinite(userId) ? userId : null;
    this.logger.debug(
      `[extractUserId] Извлечен ID из "${value}": ${result}`,
    );
    return result;
  }
}
