-- Миграция: добавление колонки replicate в таблицу tasks
-- Дата: 2025-11-10

ALTER TABLE `tasks`
ADD COLUMN `replicate` TINYINT(1) NOT NULL DEFAULT 0
AFTER `created_by`;

-- Обновление существующих записей (если нужно)
-- По умолчанию все существующие задачи помечаются как нерегулярные (replicate = 0)

