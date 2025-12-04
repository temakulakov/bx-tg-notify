import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { CustomLogger } from './common/logger/custom-logger';
import { Request, Response, NextFunction } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
const session = require('express-session');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new CustomLogger('NestApplication'),
  });

  const configService = app.get(ConfigService);

  // Настройка шаблонизатора Handlebars
  // В production __dirname указывает на dist/, views копируются в dist/views через nest-cli.json
  // В dev режиме используем views из корня проекта
  const viewsPath = process.env.NODE_ENV === 'production' 
    ? join(__dirname, 'views')  // dist/views (копируется из src/views при сборке)
    : join(process.cwd(), 'views');  // корневая папка views для dev
  app.setBaseViewsDir(viewsPath);
  app.setViewEngine('hbs');

  // Настройка сессий
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 часа
      },
    }),
  );

  const requestLogger = new CustomLogger('WebhookRequest');
  const validationLogger = new CustomLogger('ValidationPipe');

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // Логируем ВСЕ входящие запросы для отладки
  app.use((req: Request, _: Response, next: NextFunction) => {
    const url = req.originalUrl || req.url;
    
    // Логируем все webhook запросы
    if (url.startsWith('/webhook/')) {
      requestLogger.log(`═══════════════════════════════════════════════════════════`);
      requestLogger.log(`📥 [${req.method}] ${url}`);
      requestLogger.log(`📍 IP: ${req.ip || req.socket.remoteAddress || 'unknown'}`);
      requestLogger.log(`🔗 URL: ${req.protocol}://${req.get('host')}${url}`);
      
      // Логируем headers
      requestLogger.log(`📋 Headers: ${JSON.stringify(req.headers, null, 2)}`);
      
      // Логируем body (если есть)
      if (req.body && Object.keys(req.body).length > 0) {
        requestLogger.log(`📦 Body: ${JSON.stringify(req.body, null, 2)}`);
      } else {
        requestLogger.log(`📦 Body: (пустое или не распарсено)`);
        // Пробуем прочитать raw body для отладки
        if ('rawBody' in req) {
          requestLogger.log(`📦 Raw Body: ${(req as any).rawBody?.toString().substring(0, 500)}`);
        }
      }
      
      requestLogger.log(`═══════════════════════════════════════════════════════════`);
    }
    
    next();
  });

  // Включаем глобальную валидацию DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const formattedErrors = errors.map((error) => ({
          property: error.property,
          constraints: error.constraints,
          value: error.value,
        }));

        validationLogger.error(
          `❌ Ошибка валидации входящего запроса: ${JSON.stringify(formattedErrors, null, 2)}`,
        );
        validationLogger.error(
          `❌ Полное тело запроса: ${JSON.stringify(errors[0]?.target || {}, null, 2)}`,
        );

        return new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      },
    }),
  );

  const port = configService.get<number>('PORT') ?? 3000;
  
  try {
    await app.listen(port);
    const logger = new CustomLogger('Bootstrap');
    logger.log(`✅ Приложение запущено на порту ${port}`);
    logger.log(`🌐 Веб-интерфейс доступен по адресу: http://localhost:${port}`);
  } catch (error) {
    const logger = new CustomLogger('Bootstrap');
    logger.error(`❌ Ошибка при запуске приложения на порту ${port}:`, error);
    process.exit(1);
  }
}

// Обработка необработанных ошибок и промисов
// ВАЖНО: Эти обработчики должны быть установлены ДО вызова bootstrap()
process.on('unhandledRejection', (reason, promise) => {
  const logger = new CustomLogger('UnhandledRejection');
  logger.warn('⚠️ Необработанное отклонение промиса (приложение продолжит работу):', reason);
  // Логируем, но не завершаем процесс для критических ошибок
});

process.on('uncaughtException', (error) => {
  const logger = new CustomLogger('UncaughtException');
  logger.error('❌ Необработанное исключение:', error);
  // Для критических ошибок завершаем процесс
  process.exit(1);
});

bootstrap().catch((error) => {
  const logger = new CustomLogger('BootstrapError');
  logger.error('Критическая ошибка при запуске приложения:', error);
  process.exit(1);
});
