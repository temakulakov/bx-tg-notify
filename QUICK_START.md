# Быстрый старт для production

## 1. Выполнить миграцию БД

```bash
mysql -h mysql -u shebo -p shebo < migrations/add-webapp-tables.sql
```

Или через Docker:
```bash
docker exec -i <mysql_container_name> mysql -u shebo -p shebo < migrations/add-webapp-tables.sql
```

## 2. Проверить .production.env

Убедитесь, что в файле `.production.env` есть:
```env
APP_URL=https://shebo.h512.ru
```

## 3. Собрать и запустить

```bash
npm install
npm run build
npm run start:prod
```

Или через PM2:
```bash
npm install
npm run build
pm2 start dist/main.js --name bitrix-app
pm2 save
```

## 4. Назначить администраторов

```sql
UPDATE users_shebo SET isAdmin = TRUE WHERE bitrix_id IN (114, 120);
```

## 5. Проверить работу

- Откройте бота в Telegram
- Нажмите на кнопку "📊 Мониторинг" в меню
- Должна открыться страница со статусом системы

---

Подробная инструкция: см. [DEPLOYMENT.md](./DEPLOYMENT.md)

