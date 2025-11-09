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

    const { updatedTask, changes, notifyAsCreated } = updateResult;

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
    const taskId = dto.data.FIELDS_AFTER?.TASK_ID;
    const commentId = dto.data.FIELDS_AFTER?.ID;

    if (!taskId) {
      this.logger.warn(
        `Отсутствует TASK_ID в FIELDS_AFTER для события ${dto.event}`,
      );
      throw new BadRequestException('Task ID is required');
    }

    if (!commentId) {
      this.logger.warn(
        `Отсутствует ID комментария в FIELDS_AFTER для события ${dto.event}`,
      );
      throw new BadRequestException('Comment ID is required');
    }

    await this.taskProcessor.newTaskCommentWebhook({
      id: taskId,
      commentId: commentId,
    });
  }

  async handleDocumentApproval(query: DocumentApprovalQuery): Promise<void> {
    const receiverId = this.extractUserId(query.receiver);
    const senderId = this.extractUserId(query.sender);
    const documentId = query.document?.toString().trim();
    const description = query.description ?? '';

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

    await this.telegramService.notifyDocumentApproval({
      receiverId,
      senderId: senderId ?? undefined,
      description,
      documentId,
    });
  }

  private extractUserId(value?: string): number | null {
    if (!value) {
      return null;
    }

    const match = value.match(/(\d+)/);
    if (!match) {
      return null;
    }

    const userId = Number(match[1]);
    return Number.isFinite(userId) ? userId : null;
  }
}
