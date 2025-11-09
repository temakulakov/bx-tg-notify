import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { CustomLogger } from './common/logger/custom-logger';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLogger('NestApplication'),
  });

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
