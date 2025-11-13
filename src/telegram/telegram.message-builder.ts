import { Injectable } from '@nestjs/common';
import {
  TelegramMessageSection,
  TelegramMessageTemplate,
} from './types/telegram-message.types';

@Injectable()
export class TelegramMessageBuilder {
  build(template: TelegramMessageTemplate): string {
    if (template.raw) {
      return template.raw;
    }

    const chunks: string[] = [];

    if (template.header) {
      chunks.push(template.header);
    }

    if (template.title) {
      chunks.push(template.title);
    }

    if (template.emphasis) {
      chunks.push(this.italic(template.emphasis));
    }

    template.sections?.forEach((section) => {
      const sectionChunks: string[] = [];

      if (section.title) {
        sectionChunks.push(this.underline(section.title));
      }

      if (section.lines?.length) {
        sectionChunks.push(
          section.lines.map((line) => this.escape(line)).join('\n'),
        );
      }

      if (section.raw) {
        sectionChunks.push(section.raw);
      }

      if (sectionChunks.length) {
        chunks.push(sectionChunks.join('\n'));
      }
    });

    if (template.metadata && Object.keys(template.metadata).length > 0) {
      const metaLines = Object.entries(template.metadata).map(
        ([key, value]) => `${this.bold(`${key}:`)} ${this.escape(String(value))}`,
      );
      chunks.push(metaLines.join('\n'));
    }

    if (template.footer) {
      chunks.push(this.italic(template.footer));
    }

    return chunks.filter(Boolean).join('\n\n');
  }

  private bold(value: string): string {
    return `<b>${this.escape(value)}</b>`;
  }

  private italic(value: string): string {
    return `<i>${this.escape(value)}</i>`;
  }

  private underline(value: string): string {
    return `<u>${this.escape(value)}</u>`;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
