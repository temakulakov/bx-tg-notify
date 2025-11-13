-- Миграция для добавления таблицы phrases и колонки isAdmin для пользователей
-- Дата создания: 2025-11-13

-- 1. Создание таблицы phrases для хранения стоп-фраз
CREATE TABLE IF NOT EXISTS `phrases` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `text` VARCHAR(500) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_text` (`text`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Добавление колонки isAdmin в таблицу users_shebo
-- Проверяем, существует ли колонка, чтобы избежать ошибки при повторном запуске
SET @dbname = DATABASE();
SET @tablename = 'users_shebo';
SET @columnname = 'isAdmin';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` BOOLEAN NOT NULL DEFAULT FALSE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Загрузка начальных фраз из файла (если файл существует)
-- Примечание: Этот шаг выполняется автоматически при первом запуске приложения
-- через PhrasesService.initializeFromFile()

