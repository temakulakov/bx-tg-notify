import { Injectable, Logger } from '@nestjs/common';
import { TaskWebhookDto } from './dto/task-webhook.dto';
import { CommentTaskWebhookDto } from './dto/comment-task-webhook.dto';
import { BitrixService } from '../bitrix/bitrix.service';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { TaskUpdateChange } from './types/task-update-change.types';
import { TelegramService } from '../telegram/telegram.service';
import { PhrasesService } from '../phrases/phrases.service';
import { YesNoEnum } from '../bitrix/entities/bitrix-response.type';

interface TaskUpdateResult {
  updatedTask: Task;
  changes: TaskUpdateChange[];
  notifyAsCreated?: boolean;
}

@Injectable()
export class TaskProcessor {
  private readonly logger = new Logger(TaskProcessor.name);

  constructor(
    private readonly bitrixService: BitrixService,
    private readonly tasksService: TasksService,
    private readonly telegramService: TelegramService,
    private readonly phrasesService: PhrasesService,
  ) {}

  async newTaskWebhook(dto: TaskWebhookDto) {
    this.logger.log(`Получен вебхук создания задачи ${dto.id}`);
    const result = await this.bitrixService.getTask(dto.id);
    if (!result?.result?.task) {
      this.logger.error(`Bitrix не вернул данные задачи ${dto.id}`);
      return null;
    }

    const task = result.result.task;
    const isReplicate = task.replicate === YesNoEnum.Yes;
    if (isReplicate) {
      this.logger.debug(
        `Задача ${dto.id} помечена как регулярная (replicate=Y), пропускаем сохранение и уведомление`,
      );
      return null;
    }

    const savedTask = await this.tasksService.create({
      bitrixId: +task.id,
      title: task.title,
      responsible_ids: task.responsibleId
        ? [Number(task.responsibleId)]
        : [],
      created_by: Number(task.createdBy),
      deadline: task.deadline,
      description: task.description,
      replicate: isReplicate,
    });

    this.logger.verbose(`Задача ${dto.id} сохранена в БД`);
    return savedTask;
  }

  async updateTaskWebhook(dto: TaskWebhookDto): Promise<TaskUpdateResult | null> {
    this.logger.log(`Получен вебхук обновления задачи ${dto.id}`);

    const result = await this.bitrixService.getTask(dto.id);
    if (!result?.result?.task) {
      this.logger.error(`Bitrix не вернул данные задачи ${dto.id}`);
      return null;
    }

    const remoteTask = result.result.task;
    const isReplicate = remoteTask.replicate === YesNoEnum.Yes;
    if (isReplicate) {
      this.logger.debug(
        `Задача ${dto.id} отмечена как регулярная (replicate=Y), обновление пропущено`,
      );
      return null;
    }

    const bitrixId = Number(remoteTask.id);

    const currentTask = await this.tasksService.findByBitrixId(bitrixId);

    const normalizeTitle = (value?: string | null) =>
      (value ?? '').trim();
    const normalizeDescription = (value?: string | null) =>
      (value ?? '').replace(/\r\n/g, '\n');
    const normalizeResponsibleIds = (values?: (number | string)[]) =>
      Array.isArray(values)
        ? values
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
          .sort((a, b) => a - b)
        : [];
    const normalizeDeadline = (value?: string | Date | null) => {
      if (!value) {
        return null;
      }
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const newResponsibleIds = normalizeResponsibleIds(
      remoteTask.responsibleId ? [remoteTask.responsibleId] : [],
    );
    const newDeadline = normalizeDeadline(remoteTask.deadline);
    const newTitle = normalizeTitle(remoteTask.title);
    const newDescription = normalizeDescription(remoteTask.description);
    const newCreatedBy = Number(remoteTask.createdBy);

    const changes: TaskUpdateChange[] = [];

    if (currentTask) {
      const currentTitle = normalizeTitle(currentTask.title);
      if (currentTitle !== newTitle) {
        changes.push({
          field: 'title',
          previousValue: currentTask.title,
          currentValue: newTitle,
        });
        currentTask.title = remoteTask.title;
      }

      const currentDescription = normalizeDescription(currentTask.description);
      if (currentDescription !== newDescription) {
        changes.push({
          field: 'description',
          previousValue: currentTask.description,
          currentValue: newDescription,
        });
        currentTask.description = remoteTask.description ?? '';
      }

      const currentDeadline = normalizeDeadline(currentTask.deadline);
      const newDeadlineIso = newDeadline ? newDeadline.toISOString() : null;
      const currentDeadlineIso = currentDeadline
        ? currentDeadline.toISOString()
        : null;
      if (currentDeadlineIso !== newDeadlineIso) {
        changes.push({
          field: 'deadline',
          previousValue: currentDeadlineIso,
          currentValue: newDeadlineIso,
        });
        currentTask.deadline = newDeadline;
      }

      const currentResponsibleIds = normalizeResponsibleIds(
        currentTask.responsible_ids,
      );
      if (
        currentResponsibleIds.length !== newResponsibleIds.length ||
        currentResponsibleIds.some((value, index) => value !== newResponsibleIds[index])
      ) {
        changes.push({
          field: 'responsible_ids',
          previousValue: currentTask.responsible_ids ?? [],
          currentValue: newResponsibleIds,
        });
        currentTask.responsible_ids = newResponsibleIds;
      }

      currentTask.created_by = newCreatedBy;
      currentTask.replicate = isReplicate;

      if (!changes.length) {
        this.logger.debug(
          `Задача ${bitrixId}: данные из Bitrix совпадают с записью в БД, обновление не требуется`,
        );
        return {
          updatedTask: currentTask,
          changes: [],
        };
      }

      const savedTask = await this.tasksService.save(currentTask);

      return {
        updatedTask: savedTask,
        changes,
      };
    }

    this.logger.warn(
      `Задача ${bitrixId} не найдена в БД, создаем новую запись перед сравнением`,
    );

    const createdTask = await this.tasksService.create({
      bitrixId,
      title: remoteTask.title,
      responsible_ids: newResponsibleIds,
      created_by: newCreatedBy,
      deadline: newDeadline ? newDeadline.toISOString() : undefined,
      description: remoteTask.description ?? '',
      replicate: isReplicate,
    });

    return {
      updatedTask: createdTask,
      changes: [],
      notifyAsCreated: true,
    };
  }
  async newTaskCommentWebhook(dto: CommentTaskWebhookDto) {
    this.logger.log(
      `Получен вебхук комментария к задаче ${dto.id}, комментарий ${dto.commentId}`,
    );

    try {
      // Проверяем, есть ли задача в БД. Если нет - создаем её
      let task = await this.tasksService.findByBitrixId(dto.id);
      if (!task) {
        this.logger.log(
          `Задача ${dto.id} не найдена в БД, получаем данные из Bitrix и создаем запись`,
        );

        const taskResponse = await this.bitrixService.getTask(dto.id);
        if (!taskResponse?.result?.task) {
          this.logger.error(
            `Bitrix не вернул данные задачи ${dto.id} для создания записи в БД`,
          );
          return;
        }

        const remoteTask = taskResponse.result.task;
        // Создаем задачу в БД даже если она регулярная (replicate=Y),
        // так как для регулярных задач уведомления по комментариям должны проходить
        task = await this.tasksService.create({
          bitrixId: +remoteTask.id,
          title: remoteTask.title,
          responsible_ids: remoteTask.responsibleId
            ? [Number(remoteTask.responsibleId)]
            : [],
          created_by: Number(remoteTask.createdBy),
          deadline: remoteTask.deadline,
          description: remoteTask.description ?? '',
          replicate: remoteTask.replicate === YesNoEnum.Yes,
        });

        this.logger.log(
          `Задача ${dto.id} создана в БД (replicate=${remoteTask.replicate === YesNoEnum.Yes ? 'Y' : 'N'})`,
        );
      }

      const [commentResponse] = await Promise.all([
        this.bitrixService.getTaskComment(dto.id, dto.commentId),
      ]);

      const commentData =
        (commentResponse?.result as any)?.comment ?? commentResponse?.result;

      if (!commentData) {
        this.logger.warn(
          `Bitrix не вернул данные комментария ${dto.commentId} для задачи ${dto.id}`,
        );
        return;
      }

      const postMessage: string =
        commentData.POST_MESSAGE ?? commentData.postMessage ?? '';

      if (!postMessage.trim()) {
        this.logger.warn(
          `Комментарий ${dto.commentId} для задачи ${dto.id} пустой, уведомление не требуется`,
        );
        return;
      }

      if (await this.containsStopPhrase(postMessage)) {
        this.logger.debug(
          `Комментарий ${dto.commentId} содержит стоп-фразу, уведомление не будет отправлено`,
        );
        return;
      }

      const authorIdRaw =
        commentData.AUTHOR_ID ??
        commentData.authorId ??
        commentData.CREATED_BY ??
        commentData.createdBy;
      const authorId = Number(authorIdRaw);

      const recipientIds = this.extractMentionedUserIds(postMessage, authorId);

      if (!recipientIds.length) {
        this.logger.debug(
          `В комментарии ${dto.commentId} не найдено адресатов для уведомления`,
        );
        return;
      }

      await this.telegramService.notifyTaskComment({
        taskId: dto.id,
        commentId: dto.commentId,
        authorId: Number.isFinite(authorId) ? authorId : undefined,
        recipientIds,
        commentBbcode: postMessage,
      });
    } catch (error) {
      this.logger.error(
        `Ошибка при обработке комментария ${dto.commentId} для задачи ${dto.id}`,
        error,
      );
    }
  }

  private async containsStopPhrase(message: string): Promise<boolean> {
    if (!message) {
      return false;
    }

    try {
      const phrases = await this.phrasesService.findAll();
      if (!phrases || phrases.length === 0) {
      return false;
    }

    const plainText = message
      .replace(/\[\/?USER[^\]]*\]/gi, '')
      .replace(/\[\/?[A-Z]+(?:=[^\]]+)?\]/gi, '')
      .toLowerCase();

      return phrases.some(
        (phrase) => phrase.text && plainText.includes(phrase.text.toLowerCase()),
    );
    } catch (error) {
      this.logger.error('Ошибка при проверке стоп-фраз из БД', error);
      return false;
    }
  }

  private extractMentionedUserIds(
    message: string,
    authorId: number,
  ): number[] {
    if (!message) {
      return [];
    }

    const regex = /\[USER=(\d+)\](.+?)\[\/USER\]/gi;
    const mentioned = new Set<number>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(message)) !== null) {
      const userId = Number(match[1]);
      if (!Number.isFinite(userId)) {
        continue;
      }
      mentioned.add(userId);
    }

    if (!mentioned.size) {
      return [];
    }

    if (!Number.isFinite(authorId)) {
      return Array.from(mentioned);
    }

    return Array.from(mentioned).filter((id) => id !== authorId);
  }
}
