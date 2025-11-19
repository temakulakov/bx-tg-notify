-- Полная миграция для создания всех таблиц базы данных
-- Дата создания: 2025-11-19
-- Эта миграция создает все необходимые таблицы, если они не существуют

-- 1. Создание таблицы users_shebo
CREATE TABLE IF NOT EXISTS `users_shebo` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bitrix_id` INT(11) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `telegram_ids` JSON NOT NULL,
  `isAdmin` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_users_shebo_bitrix_id` (`bitrix_id`),
  INDEX `idx_bitrix_id` (`bitrix_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Создание таблицы tasks
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(555) NOT NULL,
  `bitrixId` INT(11) NOT NULL,
  `description` LONGTEXT NOT NULL,
  `deadline` DATETIME NULL,
  `responsible_ids` JSON NOT NULL,
  `created_by` INT(11) NOT NULL,
  `replicate` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_tasks_id` (`id`),
  INDEX `idx_bitrix_id` (`bitrixId`),
  INDEX `idx_deadline` (`deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Создание таблицы phrases для хранения стоп-фраз
CREATE TABLE IF NOT EXISTS `phrases` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `text` VARCHAR(500) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_text` (`text`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Добавление колонки isAdmin в таблицу users_shebo (если еще не существует)
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

-- 5. Добавление колонки replicate в таблицу tasks (если еще не существует)
SET @tablename = 'tasks';
SET @columnname = 'replicate';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TINYINT(1) NOT NULL DEFAULT 0 AFTER `created_by`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

