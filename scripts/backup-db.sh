#!/bin/bash

# Скрипт для автоматического бэкапа MySQL базы данных
# Настройки
BACKUP_DIR="/root/backups/db"
DB_CONTAINER="nest_mysql"
DB_USER="${DB_USER:-shebo}"
DB_NAME="${DB_NAME:-shebo}"
RETENTION_DAYS=7  # Хранить бэкапы 7 дней

# Создаем директорию для бэкапов
mkdir -p "$BACKUP_DIR"

# Имя файла бэкапа
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Получаем пароль из .env файла
ENV_FILE="/root/bx-tg-notify/.production.env"
if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="/root/bx-tg-notify/.development.env"
fi

if [ -f "$ENV_FILE" ]; then
    # Загружаем переменные окружения, игнорируя комментарии
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

# Проверяем что контейнер запущен
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "Error: MySQL container is not running"
    exit 1
fi

# Создаем бэкап
echo "Creating backup: $BACKUP_FILE"
docker exec "$DB_CONTAINER" mysqldump -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Проверяем успешность
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
    echo "Backup created successfully: $BACKUP_FILE"
    echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
    
    # Удаляем старые бэкапы
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    echo "Old backups (older than $RETENTION_DAYS days) deleted"
else
    echo "Error: Backup failed"
    exit 1
fi

