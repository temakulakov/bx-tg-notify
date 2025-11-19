import { Update, Ctx, Start, Command, Help, Hears, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramRecipientService } from './telegram.recipient.service';
import { TelegramService } from './telegram.service';
import { UsersService } from '../users/users.service';

interface BitrixBindingState {
  promptMessageId?: number;
}

const HTML_REPLY_OPTIONS = {
  parse_mode: 'HTML' as const,
};

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  private readonly pendingBindings = new Map<number, BitrixBindingState>();

  constructor(
    private readonly recipientService: TelegramRecipientService,
    private readonly telegramService: TelegramService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;

    if (!chatId) {
      this.logger.warn('Получена команда /start без chatId');
      return;
    }

    this.recipientService.registerChat({
      chatId,
      userId,
      username: ctx.from?.username,
    });

    this.logger.log(`Чат ${chatId} отправил /start`);

    const promptText = 'Привет, напиши свой <b>id в битриксе</b>:';
    const promptMessage = await ctx.reply(promptText, HTML_REPLY_OPTIONS);

    this.pendingBindings.set(chatId, {
      promptMessageId: promptMessage.message_id,
    });
  }

  @Command('info')
  async onInfo(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;

    if (!chatId) {
      this.logger.warn('Команда /info без chatId');
      return;
    }

    // Отправляем информацию о Web App
    // Используем APP_URL из конфига, если не установлен - используем fallback
    // В production всегда должен быть установлен APP_URL с HTTPS
    const appUrl = this.configService.get<string>('APP_URL');
    if (!appUrl || appUrl.includes('localhost')) {
      this.logger.warn(`APP_URL not set or uses localhost: ${appUrl}. Web App may not work in production.`);
    }
    const webAppUrl = appUrl ? `${appUrl}/webapp` : 'http://localhost:3000/webapp';
    const webAppButton = {
      text: '📊 Открыть мониторинг',
      web_app: { url: webAppUrl },
    };

    await ctx.reply(
      `ID текущего чата: <code>${chatId}</code>\n\nИспользуйте этот ID для авторизации на сайте.\n\nТакже вы можете открыть Web App для мониторинга системы:`,
      {
        ...HTML_REPLY_OPTIONS,
        reply_markup: {
          inline_keyboard: [[webAppButton]],
        },
      },
    );
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply(
      'Доступные команды:\n/start — авторизация\n/info — показать ID чата\n/help — напомнить список команд',
    );
  }

  @Hears(/^(?:hi|hello|привет)$/i)
  async onGreetings(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id;
    this.logger.debug(`Получено приветствие из чата ${chatId}`);
    await ctx.reply('👋 Привет! Чем могу помочь?');
  }

  @On('text')
  async onAnyText(@Ctx() ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      this.logger.warn('Получено текстовое сообщение без chatId');
      return;
    }

    const state = this.pendingBindings.get(chatId);

    if (!state) {
      this.logger.debug(
        `Чат ${chatId} отправил текст без активного ожидания Bitrix ID`,
      );
      return;
    }

    const message = ctx.message as Record<string, unknown> | undefined;
    const incomingText =
      typeof message?.['text'] === 'string' ? message['text'] : '';

    const digitsOnly = incomingText.replace(/\D+/g, '');

    if (!digitsOnly) {
      this.logger.warn(`Чат ${chatId} отправил строку без цифр`);
      await this.updatePrompt(ctx, chatId, state, {
        text: 'Не могу найти цифры в сообщении. Пожалуйста, введи ID только из чисел.',
      });
      return;
    }

    const bitrixId = Number(digitsOnly);

    if (!Number.isFinite(bitrixId)) {
      this.logger.warn(
        `Чат ${chatId} отправил некорректный Bitrix ID: ${digitsOnly}`,
      );
      await this.updatePrompt(ctx, chatId, state, {
        text: 'Похоже, ID слишком большой. Попробуй ещё раз.',
      });
      return;
    }

    const replyMessageId =
      typeof message?.['message_id'] === 'number'
        ? message['message_id']
        : undefined;

    const waitingMessage = await ctx.reply('🎲', {
      reply_parameters: replyMessageId
        ? {
            message_id: replyMessageId,
            allow_sending_without_reply: true,
          }
        : undefined,
    });

    try {
      const user = await this.usersService.attachTelegramChat(bitrixId, chatId);

      if (!user) {
        await this.editMessageSafe(ctx, chatId, waitingMessage.message_id, {
          text: 'Не нашёл пользователя с таким ID. Уточни ID в Bitrix и попробуй снова.',
        });
        await this.updatePrompt(ctx, chatId, state, {
          text: 'Введи правильный <b>Bitrix ID</b>:',
          parseMode: 'HTML',
        });
        return;
      }

      const escapedName = this.escapeHtml(user.name);
      await this.editMessageSafe(ctx, chatId, waitingMessage.message_id, {
        text: `<b>${escapedName}</b>, узнал вас! Сюда будут присылаться уведомления.`,
        parseMode: 'HTML',
      });

      this.logger.log(
        `Чат ${chatId} успешно привязан к пользователю ${bitrixId} (${user.name})`,
      );
      this.pendingBindings.delete(chatId);
    } catch (error) {
      this.logger.error('Ошибка при привязке Bitrix ID', error);
      await this.editMessageSafe(ctx, chatId, waitingMessage.message_id, {
        text: '⚠️ Произошла ошибка при проверке. Попробуй ещё раз чуть позже.',
      });
    }
  }

  private async updatePrompt(
    ctx: Context,
    chatId: number,
    state: BitrixBindingState,
    options: { text: string; parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown' },
  ) {
    const text = options.text;

    if (state.promptMessageId) {
      try {
        await ctx.telegram.editMessageText(
          chatId,
          state.promptMessageId,
          undefined,
          text,
          {
            parse_mode: options.parseMode,
          },
        );
        return;
      } catch (error) {
        this.logger.warn('Не удалось обновить сообщение-приглашение', error);
      }
    }

    const promptMessage = await ctx.reply(text, {
      parse_mode: options.parseMode,
    });
    state.promptMessageId = promptMessage.message_id;
  }

  private async editMessageSafe(
    ctx: Context,
    chatId: number,
    messageId: number,
    options: { text: string; parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown' },
  ) {
    try {
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        options.text,
        {
          parse_mode: options.parseMode,
        },
      );
    } catch (error) {
      this.logger.warn('Не удалось обновить служебное сообщение', error);
      await ctx.reply(options.text, {
        parse_mode: options.parseMode,
      });
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
