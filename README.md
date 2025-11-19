<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
    
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Docker запуск с .development.env

### Подготовка файла .development.env

Убедитесь, что файл `.development.env` существует и содержит все необходимые переменные окружения. Для работы в Docker важно:

1. **DB_HOST** должен быть установлен в `mysql` (имя сервиса в docker-compose.yml), а не `localhost`
2. **DB_PORT** должен соответствовать порту, указанному в docker-compose.yml
3. Все остальные переменные должны быть корректно заполнены

Пример структуры `.development.env`:
```env
NODE_ENV=development

DB_HOST=mysql
DB_PORT=3306
DB_USER=shebo
DB_PASS=your_password
DB_NAME=shebo

BX24_OUTGOING_TOKEN=your_token
BX24_INCOMING_TOKEN=your_token
BX24_INCOMING_USER=your_user_id
BX24_DOMAIN=https://your-domain.bitrix24.ru

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### Запуск Docker контейнеров

#### Вариант 1: Запуск с .development.env (по умолчанию)

Docker Compose автоматически использует `.development.env` по умолчанию:

```bash
# Запуск всех сервисов (MySQL и приложение)
$ docker-compose up -d

# Просмотр логов
$ docker-compose logs -f app

# Остановка контейнеров
$ docker-compose down
```

#### Вариант 2: Явное указание файла окружения

Если нужно явно указать файл окружения:

```bash
$ ENV_FILE=.development.env docker-compose up -d
```

#### Вариант 3: Запуск только MySQL (для локальной разработки)

Если вы хотите запустить только базу данных в Docker, а приложение запускать локально:

```bash
# Запуск только MySQL
$ docker-compose up -d mysql

# В этом случае в .development.env используйте DB_HOST=localhost
```

### Важные замечания

- **Для работы приложения в Docker**: `DB_HOST=mysql` (имя сервиса)
- **Для локальной разработки с Docker MySQL**: `DB_HOST=localhost`
- При первом запуске MySQL создаст базу данных автоматически согласно переменным окружения
- Данные базы данных сохраняются в Docker volume `db_data`
- Порт приложения по умолчанию: `3000` (можно переопределить через переменную `APP_PORT` в .development.env)

### Полезные команды

```bash
# Пересборка образов
$ docker-compose build

# Пересборка и запуск
$ docker-compose up -d --build

# Просмотр статуса контейнеров
$ docker-compose ps

# Подключение к MySQL контейнеру
$ docker-compose exec mysql mysql -u shebo -p shebo

# Очистка volumes (удалит все данные БД!)
$ docker-compose down -v
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
