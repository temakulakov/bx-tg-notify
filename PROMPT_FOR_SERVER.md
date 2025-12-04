# Промт для выполнения на сервере после деплоя

## Задача

После деплоя через GitHub Actions нужно выполнить миграцию базы данных для добавления столбца `chatId` в таблицу `tasks`.

## Шаги выполнения

### 1. Подключитесь к серверу

```bash
ssh root@YOUR_SERVER_IP
```

### 2. Перейдите в директорию проекта

```bash
cd /root/bx-tg-notify
```

### 3. Проверьте что последние изменения получены

```bash
git fetch origin
git log origin/main --oneline -5
```

### 4. Выполните миграцию базы данных

```bash
# Подключаемся к MySQL контейнеру и выполняем миграцию
docker exec -i nest_mysql mysql -uroot -p"${DB_PASS}" ${DB_NAME} < migrations/add-chatid-column.sql
```

**Или если нужно сначала загрузить переменные окружения:**

```bash
# Загружаем переменные окружения из .production.env
export $(grep -v '^#' .production.env | grep -v '^$' | xargs)

# Выполняем миграцию
docker exec -i nest_mysql mysql -uroot -p"${DB_PASS}" "${DB_NAME}" < migrations/add-chatid-column.sql
```

### 5. Проверьте что столбец добавлен

```bash
docker exec -it nest_mysql mysql -uroot -p"${DB_PASS}" "${DB_NAME}" -e "DESCRIBE tasks;"
```

Должна появиться колонка `chatId` типа `int(11)` с `NULL` значениями.

### 6. Перезапустите приложение (если нужно)

```bash
ENV_FILE=.production.env docker compose --profile production restart app
```

## Альтернативный способ (через docker compose exec)

```bash
cd /root/bx-tg-notify

# Загружаем переменные окружения
export $(grep -v '^#' .production.env | grep -v '^$' | xargs)

# Выполняем миграцию через docker compose
ENV_FILE=.production.env docker compose --profile production exec -T mysql mysql -uroot -p"${DB_PASS}" "${DB_NAME}" < migrations/add-chatid-column.sql
```

## Что делает миграция

Миграция `migrations/add-chatid-column.sql`:
- Проверяет существует ли столбец `chatId` в таблице `tasks`
- Если не существует - добавляет столбец типа `INT(11) NULL` после столбца `created_by`
- Безопасна для повторного запуска (не вызовет ошибку если столбец уже есть)

## Проверка после миграции

```bash
# Проверка структуры таблицы
docker exec -it nest_mysql mysql -uroot -p"${DB_PASS}" "${DB_NAME}" -e "SHOW COLUMNS FROM tasks LIKE 'chatId';"

# Должен вывести:
# +--------+----------+------+-----+---------+-------+
# | Field  | Type     | Null | Key | Default | Extra |
# +--------+----------+------+-----+---------+-------+
# | chatId | int(11)  | YES  |     | NULL    |       |
# +--------+----------+------+-----+---------+-------+
```

