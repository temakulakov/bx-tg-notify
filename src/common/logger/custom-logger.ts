import { ConsoleLogger, LogLevel } from '@nestjs/common';
import * as chalk from 'chalk';

export class CustomLogger extends ConsoleLogger {
  constructor(
    context?: string,
    options?: { timestamp?: boolean; logLevels?: LogLevel[] },
  ) {
    super(
      context ?? 'Default',
      options ?? {
        timestamp: true,
        logLevels: ['log', 'warn', 'error', 'debug', 'verbose'],
      },
    );
  }

  /** 👇 Переопределяем базовый метод ConsoleLogger */
  protected getTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}  ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    );
  }
}
