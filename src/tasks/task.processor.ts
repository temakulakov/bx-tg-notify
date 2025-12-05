import { Injectable, Logger } from '@nestjs/common';
import { TaskWebhookDto } from './dto/task-webhook.dto';
import { CommentTaskWebhookDto } from './dto/comment-task-webhook.dto';
import { BitrixService } from '../bitrix/bitrix.service';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { TaskUpdateChange } from './types/task-update-change.types';
import { TelegramService } from '../telegram/telegram.service';
import { PhrasesService } from '../phrases/phrases.service';
import { BitrixTask, YesNoEnum } from '../bitrix/entities/bitrix-response.type';

interface TaskUpdateResult {
  updatedTask: Task;
  changes: TaskUpdateChange[];
  notifyAsCreated?: boolean;
  notifyAsFixed?: boolean; // Уведомление об исправлении (replicate Y->N или удалён тег «Регулярная»)
  isRegular?: boolean; // Является ли задача регулярной (replicate=Y или тег «Регулярная»)
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

  /**
   * Проверяет, является ли задача регулярной (replicate=Y или тег "Регулярная" присутствует)
   */
  private isRegularTask(task: BitrixTask): boolean {
    if (task.replicate === YesNoEnum.Yes) {
      return true;
    }

    const tags = task.tags;
    if (!tags || (Array.isArray(tags) && !tags.length)) {
      return false;
    }

    const isRegularTag = (tag: { name?: string; title?: string } | undefined): boolean => {
      const rawName = tag?.name ?? tag?.title;
      if (!rawName) {
        return false;
      }
      return rawName.trim().toLowerCase() === 'регулярная';
    };

    if (Array.isArray(tags)) {
      return tags.some((tag) => isRegularTag(tag));
    }

    return Object.values(tags).some((tag) => isRegularTag(tag));
  }

  async newTaskWebhook(dto: TaskWebhookDto) {
    this.logger.log(`Получен вебхук создания задачи ${dto.id}`);
    const result = await this.bitrixService.getTask(dto.id);
    if (!result?.result?.task) {
      this.logger.error(`Bitrix не вернул данные задачи ${dto.id}`);
      return null;
    }

    const task = result.result.task;
    const isRegular = this.isRegularTask(task);

    // Всегда сохраняем задачу в БД, даже если она регулярная
    const savedTask = await this.tasksService.create({
      bitrixId: +task.id,
      title: task.title,
      responsible_ids: task.responsibleId
        ? [Number(task.responsibleId)]
        : [],
      created_by: Number(task.createdBy),
      deadline: task.deadline,
      description: task.description,
      replicate: isRegular,
    });

    if (isRegular) {
      this.logger.debug(
        `Задача ${dto.id} помечена как регулярная (replicate=${task.replicate}, тег "Регулярная": ${isRegular ? 'да' : 'нет'}), сохранена в БД, уведомление не отправляется`,
      );
      // Возвращаем null, чтобы webhook.service не отправлял уведомление
      return null;
    }

    this.logger.verbose(`Задача ${dto.id} сохранена в БД`);
    return savedTask;
  }

  async updateTaskWebhook(dto: TaskWebhookDto): Promise<TaskUpdateResult | null> {
    this.logger.log(`[updateTaskWebhook] ========== НАЧАЛО ОБРАБОТКИ ВЕБХУКА ОБНОВЛЕНИЯ ЗАДАЧИ ==========`);
    this.logger.log(`[updateTaskWebhook] Получен вебхук обновления задачи ${dto.id}`);

    const result = await this.bitrixService.getTask(dto.id);
    if (!result?.result?.task) {
      this.logger.error(`[updateTaskWebhook] ❌ Bitrix не вернул данные задачи ${dto.id}`);
      return null;
    }

    const remoteTask = result.result.task;
    this.logger.log(
      `[updateTaskWebhook] Получена задача из Bitrix: id=${remoteTask.id}, title="${remoteTask.title}", chatId=${remoteTask.chatId || 'не указан'}`,
    );
    const isRegular = this.isRegularTask(remoteTask);

    const bitrixId = Number(remoteTask.id);

    const currentTask = await this.tasksService.findByBitrixId(bitrixId);

    // Проверяем, было ли изменение статуса регулярной задачи
    let notifyAsFixed = false;
    if (currentTask) {
      const wasRegular = currentTask.replicate === true;
      const nowRegular = isRegular;

      // Если задача была регулярной (replicate=Y или имела тег «Регулярная»), а теперь стала обычной —
      // отправляем уведомление об исправлении
      if (wasRegular && !nowRegular) {
        notifyAsFixed = true;
        this.logger.log(
          `Задача ${bitrixId} исправлена: была регулярной, теперь обычная. Будет отправлено уведомление об исправлении.`,
        );
      } else if (!wasRegular && isRegular) {
        // Случай, когда задача была создана с тегом «Регулярная» (но без replicate=Y), а теперь тег удален
        // Это сложно отследить без хранения тегов в БД, но если задача была обычной,
        // а теперь имеет тег «Регулярная» - это не исправление, а наоборот
        // Пока оставляем только проверку по replicate
      }
    }

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
    const chatId = remoteTask.chatId ? Number(remoteTask.chatId) : null;
    
    this.logger.log(
      `[updateTaskWebhook] chatId из Bitrix для задачи ${bitrixId}: ${chatId || 'не указан'}`,
    );

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
      currentTask.replicate = isRegular;
      
      // Сохраняем chatId из Bitrix
      const chatId = remoteTask.chatId ? Number(remoteTask.chatId) : null;
      if (chatId !== currentTask.chatId) {
        this.logger.log(
          `[updateTaskWebhook] 🔄 Обновление chatId для задачи ${bitrixId}: ${currentTask.chatId || 'null'} → ${chatId || 'null'}`,
        );
        currentTask.chatId = chatId;
      } else {
        this.logger.debug(
          `[updateTaskWebhook] chatId для задачи ${bitrixId} не изменился: ${chatId || 'null'}`,
        );
      }

      // Если задача регулярная и не было исправления, не отправляем уведомления
      if (isRegular && !notifyAsFixed) {
        this.logger.debug(
          `Задача ${bitrixId} регулярная (replicate=${remoteTask.replicate}, тег "Регулярная": да), обновлена в БД, уведомления не отправляются`,
        );
        // Сохраняем изменения в БД, но не отправляем уведомления
        const savedTask = await this.tasksService.save(currentTask);
        return {
          updatedTask: savedTask,
          changes: [],
          isRegular: true,
        };
      }

      if (!changes.length && !notifyAsFixed) {
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
        notifyAsFixed,
      };
    }

    this.logger.warn(
      `Задача ${bitrixId} не найдена в БД, создаем новую запись перед сравнением`,
    );

    this.logger.log(
      `[updateTaskWebhook] Создание новой задачи ${bitrixId} в БД с chatId=${chatId || 'null'}`,
    );
    
    const createdTask = await this.tasksService.create({
      bitrixId,
      title: remoteTask.title,
      responsible_ids: newResponsibleIds,
      created_by: newCreatedBy,
      deadline: newDeadline ? newDeadline.toISOString() : undefined,
      description: remoteTask.description ?? '',
      replicate: isRegular,
      chatId: chatId,
    });
    
    this.logger.log(
      `[updateTaskWebhook] ✅ Задача ${bitrixId} создана в БД, chatId=${createdTask.chatId || 'null'}`,
    );

    // Если задача регулярная, не отправляем уведомление о создании
    if (isRegular) {
      this.logger.debug(
        `Задача ${bitrixId} регулярная, создана в БД, уведомление не отправляется`,
      );
      return {
        updatedTask: createdTask,
        changes: [],
        isRegular: true,
      };
    }

    return {
      updatedTask: createdTask,
      changes: [],
      notifyAsCreated: true,
    };
  }
  async newTaskCommentWebhook(dto: CommentTaskWebhookDto) {
    this.logger.log(
      `[newTaskCommentWebhook] ========== НАЧАЛО ОБРАБОТКИ ВЕБХУКА КОММЕНТАРИЯ ==========`,
    );
    this.logger.log(
      `[newTaskCommentWebhook] Получен вебхук комментария к задаче ${dto.id}, комментарий ${dto.commentId}`,
    );

    try {
      // Проверяем, есть ли задача в БД. Если нет - создаем её
      this.logger.debug(
        `[newTaskCommentWebhook] Поиск задачи ${dto.id} в БД...`,
      );
      let task = await this.tasksService.findByBitrixId(dto.id);
      
      if (!task) {
        this.logger.log(
          `[newTaskCommentWebhook] ⚠️ Задача ${dto.id} не найдена в БД, получаем данные из Bitrix и создаем запись`,
        );

        const taskResponse = await this.bitrixService.getTask(dto.id);
        if (!taskResponse?.result?.task) {
          this.logger.error(
            `Bitrix не вернул данные задачи ${dto.id} для создания записи в БД`,
          );
          return;
        }

        const remoteTask = taskResponse.result.task;
        // Создаем задачу в БД даже если она регулярная,
        // так как для регулярных задач уведомления по комментариям должны проходить
        const chatId = remoteTask.chatId ? Number(remoteTask.chatId) : null;
        this.logger.log(
          `[newTaskCommentWebhook] Создание задачи ${dto.id} в БД, chatId: ${chatId}`,
        );
        
        task = await this.tasksService.create({
          bitrixId: +remoteTask.id,
          title: remoteTask.title,
          responsible_ids: remoteTask.responsibleId
            ? [Number(remoteTask.responsibleId)]
            : [],
          created_by: Number(remoteTask.createdBy),
          deadline: remoteTask.deadline,
          description: remoteTask.description ?? '',
          replicate: this.isRegularTask(remoteTask),
          chatId: chatId,
        });

        this.logger.log(
          `[newTaskCommentWebhook] ✅ Задача ${dto.id} создана в БД (replicate=${remoteTask.replicate === YesNoEnum.Yes ? 'Y' : 'N'}, chatId=${task.chatId || 'null'})`,
        );
      } else {
        this.logger.log(
          `[newTaskCommentWebhook] ✅ Задача ${dto.id} найдена в БД, chatId=${task.chatId || 'null'}`,
        );
      }

      // Получаем chatId из задачи в БД
      let taskChatId = task.chatId;
      this.logger.log(
        `[newTaskCommentWebhook] chatId задачи ${dto.id} из БД: ${taskChatId || 'null'}`,
      );

      // Если chatId отсутствует в БД, получаем задачу из Bitrix и обновляем
      if (!taskChatId) {
        this.logger.warn(
          `[newTaskCommentWebhook] ⚠️ chatId отсутствует в БД для задачи ${dto.id}, получаем из Bitrix...`,
        );
        
        try {
          const taskResponse = await this.bitrixService.getTask(dto.id);
          if (!taskResponse?.result?.task) {
            this.logger.error(
              `[newTaskCommentWebhook] ❌ Bitrix не вернул данные задачи ${dto.id} для получения chatId`,
            );
            return;
          }

          const remoteTask = taskResponse.result.task;
          taskChatId = remoteTask.chatId ? Number(remoteTask.chatId) : null;
          
          if (taskChatId) {
            this.logger.log(
              `[newTaskCommentWebhook] ✅ Получен chatId из Bitrix: ${taskChatId}, обновляем БД...`,
            );
            task.chatId = taskChatId;
            await this.tasksService.save(task);
            this.logger.log(
              `[newTaskCommentWebhook] ✅ chatId сохранен в БД для задачи ${dto.id}`,
            );
          } else {
            this.logger.error(
              `[newTaskCommentWebhook] ❌ chatId не указан в Bitrix для задачи ${dto.id}`,
            );
            this.logger.error(
              `[newTaskCommentWebhook]   Полные данные задачи из Bitrix: ${JSON.stringify(remoteTask, null, 2)}`,
            );
            return;
          }
        } catch (error) {
          this.logger.error(
            `[newTaskCommentWebhook] ❌ Ошибка при получении chatId из Bitrix для задачи ${dto.id}:`,
            error,
          );
          return;
        }
      }

      this.logger.log(
        `[newTaskCommentWebhook] Запрос комментария ${dto.commentId} для задачи ${dto.id} с chatId=${taskChatId}`,
      );

      const [commentResponse] = await Promise.all([
        this.bitrixService.getTaskComment(dto.id, dto.commentId, taskChatId),
      ]);

      // Новый API im.dialog.messages.get возвращает данные напрямую в result
      const commentData = commentResponse?.result;

      if (!commentData) {
        this.logger.warn(
          `[newTaskCommentWebhook] ⚠️ Bitrix не вернул данные комментария ${dto.commentId} для задачи ${dto.id}`,
        );
        this.logger.warn(
          `[newTaskCommentWebhook]   Использовался chatId=${taskChatId}, LAST_ID=${dto.commentId}`,
        );
        return;
      }

      this.logger.log(
        `[newTaskCommentWebhook] ✅ Получены данные комментария ${dto.commentId}`,
      );

      const postMessage: string = commentData.POST_MESSAGE ?? '';
      this.logger.log(
        `[newTaskCommentWebhook] Текст комментария (длина): ${postMessage.length} символов`,
      );
      this.logger.debug(
        `[newTaskCommentWebhook] Текст комментария (первые 200 символов): ${postMessage.substring(0, 200)}...`,
      );

      if (!postMessage.trim()) {
        this.logger.warn(
          `[newTaskCommentWebhook] ⚠️ Комментарий ${dto.commentId} для задачи ${dto.id} пустой, уведомление не требуется`,
        );
        return;
      }

      this.logger.debug(
        `[newTaskCommentWebhook] Проверка на стоп-фразы...`,
      );
      if (await this.containsStopPhrase(postMessage)) {
        this.logger.log(
          `[newTaskCommentWebhook] ⚠️ Комментарий ${dto.commentId} содержит стоп-фразу, уведомление не будет отправлено`,
        );
        return;
      }
      this.logger.debug(
        `[newTaskCommentWebhook] ✅ Стоп-фразы не найдены`,
      );

      const authorIdRaw = commentData.AUTHOR_ID ?? '';
      const authorId = Number(authorIdRaw);
      this.logger.log(
        `[newTaskCommentWebhook] Автор комментария: ${authorId || 'не указан'}`,
      );

      // Пропускаем комментарии от системного пользователя (id = 0)
      if (authorId === 0) {
        this.logger.log(
          `[newTaskCommentWebhook] ⚠️ Комментарий ${dto.commentId} от системного пользователя (id=0), уведомление не будет отправлено`,
        );
        return;
      }

      this.logger.debug(
        `[newTaskCommentWebhook] Извлечение упоминаний пользователей из комментария...`,
      );
      const recipientIds = this.extractMentionedUserIds(postMessage, authorId);
      this.logger.log(
        `[newTaskCommentWebhook] Найдено получателей: ${recipientIds.length} (${recipientIds.join(', ')})`,
      );

      if (!recipientIds.length) {
        this.logger.log(
          `[newTaskCommentWebhook] ⚠️ В комментарии ${dto.commentId} не найдено адресатов для уведомления`,
        );
        return;
      }

      this.logger.log(
        `[newTaskCommentWebhook] 📤 Отправка уведомления в Telegram...`,
      );
      this.logger.debug(
        `[newTaskCommentWebhook]   taskId: ${dto.id}`,
      );
      this.logger.debug(
        `[newTaskCommentWebhook]   commentId: ${dto.commentId}`,
      );
      this.logger.debug(
        `[newTaskCommentWebhook]   authorId: ${authorId || 'не указан'}`,
      );
      this.logger.debug(
        `[newTaskCommentWebhook]   recipientIds: ${recipientIds.join(', ')}`,
      );

      await this.telegramService.notifyTaskComment({
        taskId: dto.id,
        commentId: dto.commentId,
        authorId: Number.isFinite(authorId) ? authorId : undefined,
        recipientIds,
        commentBbcode: postMessage,
      });

      this.logger.log(
        `[newTaskCommentWebhook] ✅ Уведомление успешно отправлено`,
      );
      this.logger.log(
        `[newTaskCommentWebhook] ========== КОНЕЦ ОБРАБОТКИ ВЕБХУКА КОММЕНТАРИЯ ==========`,
      );
    } catch (error) {
      this.logger.error(
        `[newTaskCommentWebhook] ❌ КРИТИЧЕСКАЯ ОШИБКА при обработке комментария ${dto.commentId} для задачи ${dto.id}:`,
      );
      this.logger.error(
        `[newTaskCommentWebhook]   Ошибка: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof Error && error.stack) {
        this.logger.error(
          `[newTaskCommentWebhook]   Stack trace: ${error.stack}`,
        );
      }
      this.logger.log(
        `[newTaskCommentWebhook] ========== КОНЕЦ (С ОШИБКОЙ) ==========`,
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
