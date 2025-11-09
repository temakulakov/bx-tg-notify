import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { BitrixService } from '../bitrix/bitrix.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);
  constructor(
    private readonly bitrixService: BitrixService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
  ) { }

  async parseTitle(bitrixTaskId: number): Promise<string> {
    try {
      const task = await this.tasksService.findOne(bitrixTaskId);
      const domain = this.configService.get<string>('BX24_DOMAIN');

      if (!domain) {
        this.logger.warn('Переменная BX24_DOMAIN не задана в конфигурации');
        return bitrixTaskId.toString();
      }

      if (!task) {
        this.logger.warn(`Задача с Bitrix ID ${bitrixTaskId} не найдена`);
        return bitrixTaskId.toString();
      }

      const responsibleId = task.responsible_ids?.[0] ?? task.created_by;
      const url = `${domain}/company/personal/user/${responsibleId}/tasks/task/view/${task.bitrixId}`;

      return `<b><a href="${url}">${this.escapeHtml(task.title)}</a></b>`;
    } catch (error) {
      this.logger.error(
        `Не удалось получить задачу ${bitrixTaskId} для форматирования заголовка`,
        error,
      );
      return bitrixTaskId.toString();
    }
  }

  async parseUser(userId: number): Promise<string> {
    const user = await this.usersService.findByBitrixId(userId);
    const domain = this.configService.get<string>('BX24_DOMAIN');

    if (!domain) {
      this.logger.warn('Переменная BX24_DOMAIN не задана в конфигурации');
    }

    if (!user || !domain) {
      return userId.toString();
    }

    return `<a href="${domain}/company/personal/user/${user.bitrix_id}">${this.escapeHtml(user.name)}</a>`;
  }

  async parseDeadline(deadline?: string | null): Promise<string> {
    if (!deadline) {
      this.logger.warn('У задачи не указан дедлайн');
      return 'Дата не задана';
    }

    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) {
      this.logger.warn(`Не удалось распарсить дедлайн: ${deadline}`);
      return 'Дата не распознана';
    }

    const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const datePart = dateFormatter.format(date).replace(' г.', ' года');
    const timePart = timeFormatter.format(date);

    return `${datePart} в ${timePart}`;
  }

  /**
   * Преобразует BBCode в HTML, совместимый с Telegram Bot API
   * Telegram поддерживает только: <b>, <i>, <u>, <s>, <a>, <code>, <pre>, <blockquote>
   * @param bbcode - строка в формате BBCode
   * @returns строка в формате HTML, совместимого с Telegram
   */
  async bbcodeToHtml(bbcode: string): Promise<string> {
    if (!bbcode) {
      return '';
    }

    let html = bbcode;

    // Экранируем HTML-символы в тексте (но не в тегах)
    // Сначала заменяем BBCode теги на временные маркеры
    const tagMap = new Map<string, string>();
    let tagCounter = 0;

    // Сохраняем BBCode теги (кроме [DISK FILE ID=...], которые обработаем отдельно)
    html = html.replace(/\[(\/??)([A-Z]+)(?:=([^\]]+))?\]/gi, (match) => {
      // Пропускаем [DISK FILE ID=...] теги, они будут обработаны отдельно
      if (match.match(/^\[DISK FILE ID=\d+\]$/i)) {
        return match;
      }
      // Пропускаем [USER=...] и [/USER], обрабатываем отдельно
      if (match.match(/^\[\/?USER(?:=[^\]]+)?\]$/i)) {
        return match;
      }
      const key = `__BBCODE_TAG_${tagCounter}__`;
      tagMap.set(key, match);
      tagCounter++;
      return key;
    });

    // Обрабатываем [DISK FILE ID=...] теги - они требуют асинхронных вызовов
    // Делаем это ДО экранирования, чтобы потом не экранировать созданные HTML-теги
    const diskFileRegex = /\[DISK FILE ID=([\w-]+)\]/gi;
    const diskFileMatches = Array.from(html.matchAll(diskFileRegex));
    const fileReplacements = new Map<string, string>();

    for (const match of diskFileMatches) {
      const rawFileId = match[1];
      const originalTag = match[0];

      const numericPartMatch = rawFileId.match(/(\d+)/);
      if (!numericPartMatch) {
        this.logger.warn(
          `Тег DISK FILE содержит ID без числовой части: ${rawFileId}. Тег будет оставлен без изменений.`,
        );
        continue;
      }

      const fileId = Number(numericPartMatch[1]);

      if (!Number.isFinite(fileId)) {
        this.logger.warn(
          `Тег DISK FILE содержит некорректный ID: ${rawFileId}. Тег будет оставлен без изменений.`,
        );
        continue;
      }

      try {
        const response = await this.bitrixService.getFile(fileId);
        if (response?.result) {
          const file = response.result;
          // Экранируем URL и имя файла для безопасности
          const escapedUrl = file.DOWNLOAD_URL.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          const escapedName = file.NAME.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          const replacement = `<a href="${escapedUrl}">${escapedName}</a>`;
          fileReplacements.set(originalTag, replacement);
        } else {
          this.logger.warn(`Файл с ID ${fileId} не найден`);
          fileReplacements.set(originalTag, `[Файл ${fileId} не найден]`);
        }
      } catch (error) {
        this.logger.error(`Ошибка при получении файла ${fileId}:`, error);
        fileReplacements.set(originalTag, `[Ошибка загрузки файла ${fileId}]`);
      }
    }

    // Заменяем [DISK FILE ID=...] на HTML-ссылки
    fileReplacements.forEach((replacement, original) => {
      html = html.replaceAll(original, replacement);
    });

    // Обрабатываем упоминания пользователей [USER=ID]Имя[/USER]
    const userTagRegex = /\[USER=(\d+)\](.*?)\[\/USER\]/gi;
    const userTagMatches = Array.from(html.matchAll(userTagRegex));
    const userReplacements = new Map<string, string>();

    for (const match of userTagMatches) {
      const userIdRaw = match[1];
      const fallbackLabel = match[2] ?? '';
      const originalTag = match[0];

      const userId = Number(userIdRaw);
      if (!Number.isFinite(userId) || userId <= 0) {
        this.logger.warn(
          `Тег USER содержит некорректный ID: ${userIdRaw}. Тег будет заменен на текст.`,
        );
        userReplacements.set(originalTag, this.escapeHtml(fallbackLabel));
        continue;
      }

      try {
        const userLink = await this.parseUser(userId);
        if (userLink === userId.toString()) {
          const fallback =
            fallbackLabel.trim().length > 0
              ? this.escapeHtml(fallbackLabel)
              : userLink;
          userReplacements.set(originalTag, fallback);
        } else {
          userReplacements.set(originalTag, userLink);
        }
      } catch (error) {
        this.logger.error(
          `Ошибка при обработке тега USER с ID ${userId}:`,
          error,
        );
        userReplacements.set(originalTag, this.escapeHtml(fallbackLabel));
      }
    }

    userReplacements.forEach((replacement, original) => {
      html = html.replaceAll(original, replacement);
    });

    // Экранируем HTML символы (Telegram требует экранирования &, <, >)
    // Но нужно сохранить уже созданные HTML-теги (ссылки из файлов)
    const htmlTagMap = new Map<string, string>();
    let htmlTagCounter = 0;

    // Сохраняем HTML-теги (ссылки, которые мы только что создали)
    html = html.replace(/<a href="[^"]*">[^<]*<\/a>/gi, (match) => {
      const key = `__HTML_TAG_${htmlTagCounter}__`;
      htmlTagMap.set(key, match);
      htmlTagCounter++;
      return key;
    });

    // Экранируем остальной HTML
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Восстанавливаем HTML-теги
    htmlTagMap.forEach((value, key) => {
      html = html.replace(key, value);
    });

    // Восстанавливаем BBCode теги
    tagMap.forEach((value, key) => {
      html = html.replace(key, value);
    });

    // Обрабатываем списки ПЕРЕД другими тегами, так как они преобразуются в текст
    // [LIST=1] или [LIST] - нумерованный список (если есть =1) или маркированный
    html = html.replace(/\[LIST=1\](.*?)\[\/LIST\]/gis, (match, content) => {
      const items = content.split(/\[\*\]/gi).filter((item) => item.trim());
      return items
        .map((item, index) => {
          const text = item.trim();
          // Удаляем теги [P] внутри элементов списка
          const cleanText = text.replace(/\[P\](.*?)\[\/P\]/gi, '$1');
          return `${index + 1}. ${cleanText}`;
        })
        .join('\n');
    });

    // [LIST] - маркированный список
    html = html.replace(/\[LIST\](.*?)\[\/LIST\]/gis, (match, content) => {
      const items = content.split(/\[\*\]/gi).filter((item) => item.trim());
      return items
        .map((item) => {
          const text = item.trim();
          // Удаляем теги [P] внутри элементов списка
          const cleanText = text.replace(/\[P\](.*?)\[\/P\]/gi, '$1');
          return `• ${cleanText}`;
        })
        .join('\n');
    });

    // Удаляем теги [P]...[/P] - заменяем на перенос строки (Telegram не поддерживает <p>)
    html = html.replace(/\[P\](.*?)\[\/P\]/gi, '$1\n');

    // Преобразуем BBCode теги в HTML (только поддерживаемые Telegram)
    // [B]...[/B] → <b>...</b>
    html = html.replace(/\[B\](.*?)\[\/B\]/gi, '<b>$1</b>');
    html = html.replace(/\[b\](.*?)\[\/b\]/gi, '<b>$1</b>');

    // [I]...[/I] → <i>...</i>
    html = html.replace(/\[I\](.*?)\[\/I\]/gi, '<i>$1</i>');
    html = html.replace(/\[i\](.*?)\[\/i\]/gi, '<i>$1</i>');

    // [U]...[/U] → <u>...</u>
    html = html.replace(/\[U\](.*?)\[\/U\]/gi, '<u>$1</u>');
    html = html.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');

    // [S]...[/S] → <s>...</s>
    html = html.replace(/\[S\](.*?)\[\/S\]/gi, '<s>$1</s>');
    html = html.replace(/\[s\](.*?)\[\/s\]/gi, '<s>$1</s>');

    // [URL=...]...[/URL] → <a href="...">...</a>
    html = html.replace(/\[URL=(.*?)\](.*?)\[\/URL\]/gi, '<a href="$1">$2</a>');
    html = html.replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1">$2</a>');

    // [URL]...[/URL] → <a href="...">...</a>
    html = html.replace(/\[URL\](.*?)\[\/URL\]/gi, '<a href="$1">$1</a>');
    html = html.replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1">$1</a>');

    // [CODE]...[/CODE] → <code>...</code>
    html = html.replace(/\[CODE\](.*?)\[\/CODE\]/gi, '<code>$1</code>');
    html = html.replace(/\[code\](.*?)\[\/code\]/gi, '<code>$1</code>');

    // [QUOTE]...[/QUOTE] → <blockquote>...</blockquote>
    html = html.replace(
      /\[QUOTE\](.*?)\[\/QUOTE\]/gi,
      '<blockquote>$1</blockquote>',
    );
    html = html.replace(
      /\[quote\](.*?)\[\/quote\]/gi,
      '<blockquote>$1</blockquote>',
    );

    // Удаляем неподдерживаемые теги (Telegram их не поддерживает)
    // [IMG] - удаляем, так как Telegram не поддерживает <img>
    html = html.replace(/\[IMG\](.*?)\[\/IMG\]/gi, '$1');
    html = html.replace(/\[img\](.*?)\[\/img\]/gi, '$1');

    // [COLOR=...] и [SIZE=...] - удаляем, так как Telegram не поддерживает <span> с style
    html = html.replace(/\[COLOR=(.*?)\](.*?)\[\/COLOR\]/gi, '$2');
    html = html.replace(/\[color=(.*?)\](.*?)\[\/color\]/gi, '$2');
    html = html.replace(/\[SIZE=(.*?)\](.*?)\[\/SIZE\]/gi, '$2');
    html = html.replace(/\[size=(.*?)\](.*?)\[\/size\]/gi, '$2');

    // Нормализуем переносы строк (\r\n -> \n)
    html = html.replace(/\r\n/g, '\n');
    html = html.replace(/\r/g, '\n');

    // Убираем множественные переносы строк (более 2 подряд)
    html = html.replace(/\n{3,}/g, '\n\n');

    return html.trim();
  }

  truncateHtml(html: string, maxLength = 200): string {
    if (!html || maxLength <= 0) {
      return '';
    }

    let length = 0;
    let result = '';
    let truncated = false;
    const stack: string[] = [];
    const tagRegex = /<[^>]+>/gi;
    let lastIndex = 0;

    const pushClosingTags = () => {
      while (stack.length) {
        const tagName = stack.pop();
        if (tagName) {
          result += `</${tagName}>`;
        }
      }
    };

    const isSelfClosing = (tagName: string, tag: string) => {
      if (/\/>\s*$/.test(tag)) {
        return true;
      }

      return ['br', 'hr', 'img', 'input', 'meta', 'link', 'source'].includes(
        tagName,
      );
    };

    const entityOrChar = /&[a-zA-Z0-9#]+;|./gs;

    const appendText = (segment: string) => {
      if (!segment || truncated) {
        return;
      }

      const tokens = segment.match(entityOrChar) ?? [];

      for (const token of tokens) {
        const charLength = 1;
        if (length + charLength > maxLength) {
          truncated = true;
          break;
        }

        result += token;
        length += charLength;
      }
    };

    let match: RegExpExecArray | null;
    while (!truncated && (match = tagRegex.exec(html))) {
      const textSegment = html.slice(lastIndex, match.index);
      appendText(textSegment);

      if (truncated) {
        break;
      }

      const tag = match[0];
      const tagNameMatch = tag.match(/^<\/?\s*([a-zA-Z0-9]+)/);
      const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : null;

      if (tag.startsWith('</')) {
        if (!truncated) {
          result += tag;
        }

        if (stack.length && tagName === stack[stack.length - 1]) {
          stack.pop();
        }
      } else {
        if (!truncated) {
          result += tag;
        }

        if (tagName && !isSelfClosing(tagName, tag)) {
          stack.push(tagName);
        }
      }

      lastIndex = tagRegex.lastIndex;
    }

    if (!truncated && lastIndex < html.length) {
      const remainingText = html.slice(lastIndex);
      appendText(remainingText);
      lastIndex = html.length;
    }

    if (truncated) {
      result = result.replace(/\s+$/g, '');
      result += '…';
      pushClosingTags();
      return result;
    }

    return result;
  }

  escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
