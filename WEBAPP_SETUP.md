# Настройка Telegram Web App

## Шаги для настройки:

1. **Настройте бота через @BotFather:**
   ```
   /newbot или /mybots -> выберите вашего бота -> Bot Settings -> Menu Button
   ```
   Установите:
   - Text: "Мониторинг"
   - URL: `https://ваш-домен.com/webapp`

2. **Или используйте команду /setmenubutton:**
   ```
   /setmenubutton
   Выберите бота
   Text: Мониторинг
   URL: https://ваш-домен.com/webapp
   ```

3. **Настройте переменную окружения APP_URL** в `.development.env`:
   ```
   APP_URL=https://ваш-домен.com
   ```

4. **Для локальной разработки используйте ngrok или аналогичный сервис:**
   ```bash
   ngrok http 3000
   ```
   Затем используйте полученный URL в настройках бота.

## Использование:

1. Откройте бота в Telegram
2. Нажмите на кнопку меню (внизу слева) или используйте команду `/info` и нажмите на кнопку "Открыть мониторинг"
3. Web App откроется с информацией о статусе системы
4. Если вы администратор - будет доступна вкладка "Фразы" для управления

## Назначение администратора:

Чтобы назначить пользователя администратором, обновите запись в БД:
```sql
UPDATE users_shebo SET isAdmin = 1 WHERE bitrix_id = <ID_ПОЛЬЗОВАТЕЛЯ>;
```

Или через код:
```typescript
await usersService.update(bitrixId, { isAdmin: true });
```

## Адреса для доступа:

- **Dashboard (веб-версия)**: `http://localhost:3000/`
- **Авторизация**: `http://localhost:3000/auth/login`
- **Управление фразами (веб)**: `http://localhost:3000/phrases`
- **Telegram Web App**: `http://localhost:3000/webapp` (открывается через бота)

