import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { CustomLogger } from './common/logger/custom-logger';
import { Request, Response, NextFunction } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
const session = require('express-session');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new CustomLogger('NestApplication'),
  });

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

  app.use((req: Request, _: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith('/webhook/bitrix24')) {
      requestLogger.debug(
        `Получен запрос ${req.method} ${req.originalUrl} с телом: ${JSON.stringify(req.body)}`,
      );
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

        validationLogger.warn(
          `Ошибка валидации входящего запроса: ${JSON.stringify(formattedErrors)}`,
        );

        return new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
