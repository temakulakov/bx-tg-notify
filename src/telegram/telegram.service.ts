import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { TelegramMessageTemplate } from './types/telegram-message.types';
import { RecipientSelector } from './types/telegram-recipient.types';
import { TelegramMessageBuilder } from './telegram.message-builder';
import { TelegramRecipientService } from './telegram.recipient.service';
import { UsersService } from '../users/users.service';
import { ParserService } from '../parser/parser.service';
import { Task } from '../tasks/entities/task.entity';
import { TaskUpdateChange } from '../tasks/types/task-update-change.types';
import { ConfigService } from '@nestjs/config';

interface NotifyTaskCommentPayload {
  taskId: number;
  commentId: number;
  authorId?: number;
  recipientIds: number[];
  commentBbcode: string;
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly defaultSendOptions: Parameters<
    Telegraf['telegram']['sendMessage']
  >[2] = {
      parse_mode: 'HTML',
    };

  private readonly descriptionMaxLength = 300;

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly messageBuilder: TelegramMessageBuilder,
    private readonly recipientService: TelegramRecipientService,
    private readonly usersService: UsersService,
    private readonly parserService: ParserService,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() {
    try {
      await this.bot.telegram.setMyCommands([
        { command: 'start', description: 'Авторизация' },
        { command: 'info', description: 'Показать ID чата' },
        { command: 'help', description: 'Как пользоваться ботом' },
      ]);
      this.logger.log('Телеграм бот зарегистрировал команды');
    } catch (error) {
      this.logger.error('Ошибка при регистрации команд бота', error);
    }
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: Parameters<Telegraf['telegram']['sendMessage']>[2],
  ) {
    try {
      const payload: Parameters<Telegraf['telegram']['sendMessage']>[2] = {
        ...this.defaultSendOptions,
        link_preview_options: { is_disabled: true },
        ...(options ?? {}),
      };

      const result = await this.bot.telegram.sendMessage(chatId, text, payload);
      this.logger.debug(`Сообщение отправлено в чат ${chatId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Не получается прислать сообщение в чат с id - ${chatId}`,
        error,
      );
      throw error;
    }
  }

  async sendTemplateMessage(
    recipient: RecipientSelector,
    template: TelegramMessageTemplate,
    options?: Parameters<Telegraf['telegram']['sendMessage']>[2],
  ) {
    const text = this.messageBuilder.build(template);
    return this.sendToRecipients(recipient, text, options);
  }

  async sendToRecipients(
    recipient: RecipientSelector,
    text: string,
    options?: Parameters<Telegraf['telegram']['sendMessage']>[2],
  ) {
    const chatIds = this.recipientService.resolveRecipients(recipient);

    if (!chatIds.length) {
      this.logger.warn('Не найдено ни одного получателя для рассылки');
      return [];
    }

    const results = await Promise.allSettled(
      chatIds.map((chatId) => this.sendMessage(chatId, text, options)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Не удалось отправить сообщение в чат ${chatIds[index]}: ${result.reason}`,
        );
      }
    });

    return results;
  }

  async notifyTaskCreated(
    task: Task,
    options?: {
      heading?: string;
    },
  ): Promise<void> {
    this.logger.log(`Подготовка уведомления о новой задаче ${task.bitrixId}`);

    const heading = options?.heading ?? '<b>Новая задача</b>';

    const responsibleIds = task.responsible_ids ?? [];
    const recipients = await this.usersService.getTelegramChatIdsForBitrixUsers(
      responsibleIds,
      task.created_by,
    );

    if (!recipients.length) {
      this.logger.warn(
        `Нет получателей для уведомления о задаче ${task.bitrixId}. Проверьте привязку Telegram-чатов`,
      );
      return;
    }

    const deadlineSource =
      task.deadline instanceof Date
        ? task.deadline.toISOString()
        : typeof task.deadline === 'string'
          ? task.deadline
          : undefined;

    const [title, creator, executors, deadline, description] =
      await Promise.all([
        this.parserService.parseTitle(task.bitrixId),
        this.parserService.parseUser(task.created_by),
        this.parseExecutors(responsibleIds),
        this.parserService.parseDeadline(deadlineSource),
        this.parserService.bbcodeToHtml(task.description ?? ''),
      ]);

    const truncatedDescription = this.parserService.truncateHtml(
      description,
      this.descriptionMaxLength,
    );

    const message = [
      heading,
      `→ ${title}`,
      '',
      `<b>Создатель:</b> ${creator}`,
      `<b>Исполнитель:</b> ${executors}`,
      '',
      `<b>Дедлайн:</b> ${deadline}`,
      '',
      '<b>Описание:</b>',
      truncatedDescription || '—',
    ]
      .filter((part) => part !== null && part !== undefined)
      .join('\n');

    await this.sendToRecipients(recipients, message);
  }

  async notifyTaskUpdated(
    task: Task,
    changes: TaskUpdateChange[],
  ): Promise<void> {
    if (!changes.length) {
      this.logger.debug(
        `Задача ${task.bitrixId}: обновление без изменений, уведомление не требуется`,
      );
      return;
    }

    const responsibleIds = task.responsible_ids ?? [];
    const recipients = await this.usersService.getTelegramChatIdsForBitrixUsers(
      responsibleIds,
      task.created_by,
    );

    if (!recipients.length) {
      this.logger.warn(
        `Нет получателей для уведомления об обновлении задачи ${task.bitrixId}`,
      );
      return;
    }

    const deadlineSource =
      task.deadline instanceof Date
        ? task.deadline.toISOString()
        : typeof task.deadline === 'string'
          ? task.deadline
          : undefined;

    const [titleLink, executors, deadline, description] = await Promise.all([
      this.parserService.parseTitle(task.bitrixId),
      this.parseExecutors(responsibleIds),
      this.parserService.parseDeadline(deadlineSource),
      this.parserService.bbcodeToHtml(task.description ?? ''),
    ]);

    const truncatedDescription = this.parserService.truncateHtml(
      description,
      this.descriptionMaxLength,
    );

    const descriptionChange = changes.find(
      (change) => change.field === 'description',
    );
    const otherChanges = changes.filter(
      (change) => change.field !== 'description',
    );

    const formattedChanges = (
      await Promise.all(
        otherChanges.map((change) =>
          this.formatTaskChange(change, task, {
            executors,
            deadline,
            truncatedDescription,
          }),
        ),
      )
    ).filter((item): item is string => Boolean(item));

    let descriptionBlock: string | null = null;
    if (descriptionChange) {
      const previousHtml = await this.parserService.bbcodeToHtml(
        String(descriptionChange.previousValue ?? ''),
      );
      const previous = this.parserService.truncateHtml(
        previousHtml,
        this.descriptionMaxLength,
      );
      const current = truncatedDescription || '—';
      descriptionBlock = `<b>Описание:</b> ${previous || '—'} → ${current}`;
    }

    if (!formattedChanges.length && !descriptionBlock) {
      this.logger.debug(
        `Задача ${task.bitrixId}: после форматирования не осталось различий для уведомления`,
      );
      return;
    }

    const messageParts = [
      '<b>Задача обновлена:</b>',
      `→ ${titleLink}`,
      '',
      '<b>Изменено:</b>',
      ...formattedChanges,
    ];

    if (descriptionBlock) {
      messageParts.push('');
      messageParts.push(descriptionBlock);
    }

    const message = messageParts
      .filter((part) => part !== null && part !== undefined)
      .join('\n');

    await this.sendToRecipients(recipients, message);
  }

  async notifyDocumentApproval(params: {
    receiverId: number;
    senderId?: number;
    description?: string;
    documentId: string;
  }): Promise<void> {
    const { receiverId, senderId, description, documentId } = params;

    const recipients =
      await this.usersService.getTelegramChatIdsForBitrixUsers(
        [receiverId],
        senderId,
      );

    if (!recipients.length) {
      this.logger.warn(
        `Документ ${documentId}: не найдено Telegram-чатов для получателя Bitrix ID ${receiverId}`,
      );
      return;
    }

    const domain = this.configService.get<string>('BX24_DOMAIN');
    if (!domain) {
      this.logger.error(
        `Документ ${documentId}: отсутствует BX24_DOMAIN, не можем сформировать ссылку на счет`,
      );
      return;
    }

    const senderLink = senderId
      ? await this.parserService.parseUser(senderId)
      : 'Неизвестный отправитель';
    const senderLabel =
      senderId && senderLink === senderId.toString()
        ? `Пользователь ${senderId}`
        : senderLink;

    const descriptionSource = description ?? '';
    const descriptionWithBreaks =
      descriptionSource?.replace(/\\n/g, '\n') ?? '';
    const descriptionHtml = await this.parserService.bbcodeToHtml(
      descriptionWithBreaks,
    );
    const truncatedDescription = this.parserService.truncateHtml(
      descriptionHtml,
      this.descriptionMaxLength,
    );

    const normalizedDomain = domain.endsWith('/')
      ? domain.slice(0, -1)
      : domain;
    const sanitizedDocumentId = documentId.replace(/^\//, '');
    const documentUrl = `${normalizedDomain}/company/personal/bizproc/${sanitizedDocumentId}/`;
    const documentLink = `<a href="${this.parserService.escapeHtml(
      documentUrl,
    )}">Перейти к счету</a>`;

    const message = [
      `<b>Отправитель:</b> ${senderLabel}`,
      '',
      truncatedDescription || '—',
      '',
      documentLink,
    ]
      .filter((part) => part !== null && part !== undefined)
      .join('\n');

    await this.sendToRecipients(recipients, message);
  }

  async getBotInfo() {
    return this.bot.telegram.getMe();
  }

  getRecipientService() {
    return this.recipientService;
  }

  getMessageBuilder() {
    return this.messageBuilder;
  }

  private async parseExecutors(responsibleIds: number[]) {
    if (!responsibleIds.length) {
      this.logger.warn('У задачи отсутствуют ответственные исполнители');
      return 'Не назначен';
    }

    const uniqueIds = Array.from(new Set(responsibleIds)).filter((id) =>
      Number.isFinite(id),
    );

    const labels = await Promise.all(
      uniqueIds.map((id) => this.parserService.parseUser(id)),
    );

    return labels.join(', ');
  }

  private async formatTaskChange(
    change: TaskUpdateChange,
    task: Task,
    context: {
      executors: string;
      deadline: string;
      truncatedDescription: string;
    },
  ): Promise<string | null> {
    switch (change.field) {
      case 'title': {
        const previous = this.parserService.escapeHtml(
          String(change.previousValue ?? '—'),
        );
        const current = this.parserService.escapeHtml(task.title ?? '—');
        return `<b>Название:</b> ${previous} → ${current}`;
      }
      case 'description': {
        return null;
      }
      case 'deadline': {
        const previous = await this.parserService.parseDeadline(
          typeof change.previousValue === 'string'
            ? change.previousValue
            : change.previousValue
              ? String(change.previousValue)
              : null,
        );
        const current = context.deadline;
        return `<b>Дедлайн:</b> ${previous} → ${current}`;
      }
      case 'responsible_ids': {
        const previousIds = Array.isArray(change.previousValue)
          ? (change.previousValue as number[])
          : [];
        const previous = await this.parseExecutors(previousIds);
        const current = context.executors;
        return `<b>Исполнители:</b> ${previous} → ${current}`;
      }
      default:
        return null;
    }
  }

  async notifyTaskComment({
    taskId,
    commentId,
    authorId,
    recipientIds,
    commentBbcode,
  }: NotifyTaskCommentPayload): Promise<void> {
    this.logger.log(
      `Подготовка уведомления о комментарии ${commentId} к задаче ${taskId}`,
    );

    if (!recipientIds.length) {
      this.logger.debug(
        `Комментарий ${commentId} к задаче ${taskId}: список получателей пуст`,
      );
      return;
    }

    const chatIds =
      await this.usersService.getTelegramChatIdsForBitrixUsers(
        recipientIds,
        authorId,
      );

    if (!chatIds.length) {
      this.logger.warn(
        `Комментарий ${commentId} к задаче ${taskId}: не найдено Telegram-чатов для получателей ${recipientIds.join(
          ', ',
        )}`,
      );
      return;
    }

    const [titleLink, authorLabel, commentHtml] = await Promise.all([
      this.parserService.parseTitle(taskId),
      Number.isFinite(authorId)
        ? this.parserService.parseUser(authorId as number)
        : Promise.resolve('Система'),
      this.parserService.bbcodeToHtml(commentBbcode),
    ]);

    const truncatedComment = this.parserService.truncateHtml(
      commentHtml,
      this.descriptionMaxLength,
    );

    const commentLines = truncatedComment.split('\n');
    const formattedComment = commentLines
      .map((line, index) => {
        if (!line.trim()) {
          return '\u200B';
        }
        if (index === 0 && !line.trim().startsWith('→')) {
          return `→ ${line}`;
        }
        return line;
      })
      .join('\n');

    const message = [
      '<b>Комментарий к задаче</b>',
      `→ ${titleLink}`,
      '',
      `От ${authorLabel}:`,
      formattedComment,
    ]
      .filter((part) => part !== null && part !== undefined)
      .join('\n');

    await this.sendToRecipients(chatIds, message);
  }
}
