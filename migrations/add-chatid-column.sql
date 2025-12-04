-- Миграция: добавление колонки chatId в таблицу tasks
-- Дата: 2025-12-04
-- Описание: Добавляет колонку chatId для хранения ID чата задачи из Bitrix24

SET @dbname = DATABASE();
SET @tablename = 'tasks';
SET @columnname = 'chatId';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1 AS column_exists',
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` INT(11) NULL AFTER `created_by`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

