import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const port = configService.get<string>('DB_PORT');
  const portNumber = port ? parseInt(port, 10) : 3306;

  return {
  type: 'mysql',
    host: configService.get<string>('DB_HOST') || 'localhost',
    port: portNumber,
  username: configService.get<string>('DB_USER'),
  password: configService.get<string>('DB_PASS'),
  database: configService.get<string>('DB_NAME'),
  autoLoadEntities: true,
  synchronize: configService.get<string>('NODE_ENV') === 'development',
    // Настройки для MariaDB/MySQL
    extra: {
      charset: 'utf8mb4',
      // Настройки для стабильного подключения
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // Таймаут подключения (в миллисекундах)
      connectTimeout: 60000,
    },
    // Отключаем SSL для локальной разработки
    ssl: false,
    // Включаем логирование для отладки
    logging: configService.get<string>('NODE_ENV') === 'development' ? ['error', 'warn', 'schema'] : false,
  };
};
