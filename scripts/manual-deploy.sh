#!/bin/bash

# Скрипт для ручного деплоя без коммитов
# Использование: ./scripts/manual-deploy.sh

set -e

APP_DIR="/root/bx-tg-notify"
cd "$APP_DIR"

echo "=== Ручной деплой NestJS приложения ==="
echo ""

# Проверка что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
    echo "Ошибка: docker-compose.yml не найден"
    exit 1
fi

# Сохраняем текущую версию для отката
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")
echo "Текущий коммит: $CURRENT_COMMIT"
echo "CURRENT_COMMIT=$CURRENT_COMMIT" > /tmp/rollback_info

# Получаем последние изменения
echo ""
echo "Получение последних изменений из GitHub..."
git fetch origin
git reset --hard origin/main

echo ""
echo "Текущая версия после обновления: $(git rev-parse HEAD)"

# Проверяем наличие .production.env
if [ ! -f ".production.env" ]; then
    echo ""
    echo "⚠️  Внимание: .production.env не найден!"
    echo "Создайте файл .production.env с необходимыми переменными окружения"
    echo ""
    echo "Пример содержимого:"
    echo "NODE_ENV=production"
    echo "DB_HOST=mysql"
    echo "DB_PORT=3306"
    echo "DB_USER=shebo"
    echo "DB_PASS=your_password"
    echo "DB_NAME=shebo"
    echo "BX24_OUTGOING_TOKEN=..."
    echo "BX24_INCOMING_TOKEN=..."
    echo "BX24_INCOMING_USER=..."
    echo "BX24_DOMAIN=..."
    echo "TELEGRAM_BOT_TOKEN=..."
    echo "APP_PORT=3000"
    echo ""
    read -p "Продолжить без .production.env? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Останавливаем контейнеры
echo ""
echo "Остановка существующих контейнеров..."
docker compose --profile production down || true

# Собираем и запускаем
echo ""
echo "Сборка и запуск контейнеров..."
if [ -f ".production.env" ]; then
    ENV_FILE=.production.env docker compose --profile production up -d --build
else
    docker compose --profile production up -d --build
fi

# Ждем готовности
echo ""
echo "Ожидание готовности сервисов..."
sleep 15

# Проверяем здоровье контейнеров
echo ""
echo "Проверка здоровья контейнеров..."
if docker compose --profile production ps | grep -q "healthy"; then
    echo "✅ Контейнеры здоровы"
else
    echo "⚠️  Предупреждение: не все контейнеры здоровы"
    docker compose --profile production ps
fi

# Проверяем что приложение отвечает
echo ""
echo "Проверка доступности приложения..."
sleep 5
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Приложение отвечает на /health"
else
    echo "⚠️  Предупреждение: приложение не отвечает на /health"
    echo "Проверьте логи: docker compose --profile production logs app"
fi

# Показываем статус
echo ""
echo "=== Статус контейнеров ==="
docker compose --profile production ps

echo ""
echo "=== Деплой завершен ==="
echo ""
echo "Полезные команды:"
echo "  Логи: docker compose --profile production logs -f"
echo "  Статус: docker compose --profile production ps"
echo "  Перезапуск: docker compose --profile production restart"
echo "  Остановка: docker compose --profile production down"

