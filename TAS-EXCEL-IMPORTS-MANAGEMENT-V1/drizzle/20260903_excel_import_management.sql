-- TAS Excel Imports Management V1
-- Apply once on an isolated candidate database before production.
-- This migration is intentionally non-destructive.

ALTER TABLE `tas_excel_import_batches`
  ADD COLUMN `lifecycleStatus` ENUM('active','completed','deleted','archived') NOT NULL DEFAULT 'active' AFTER `status`,
  ADD COLUMN `deletedAt` TIMESTAMP NULL AFTER `updatedAt`,
  ADD COLUMN `deletedByUserId` INT NULL AFTER `deletedAt`,
  ADD COLUMN `restoredAt` TIMESTAMP NULL AFTER `deletedByUserId`,
  ADD COLUMN `restoredByUserId` INT NULL AFTER `restoredAt`,
  ADD COLUMN `archivedAt` TIMESTAMP NULL AFTER `restoredByUserId`,
  ADD COLUMN `archivedByUserId` INT NULL AFTER `archivedAt`,
  ADD COLUMN `distributionPausedAt` TIMESTAMP NULL AFTER `archivedByUserId`,
  ADD INDEX `idx_tas_excel_import_batches_lifecycle_created` (`lifecycleStatus`, `createdAt`),
  ADD INDEX `idx_tas_excel_import_batches_deleted_at` (`deletedAt`);

ALTER TABLE `leads`
  ADD COLUMN `importBatchId` INT NULL AFTER `sourceId`,
  ADD COLUMN `deletedByImportBatchId` INT NULL AFTER `deletedBy`,
  ADD INDEX `idx_leads_importBatchId` (`importBatchId`),
  ADD INDEX `idx_leads_deletedByImportBatchId` (`deletedByImportBatchId`);

-- Existing successful batches should display as completed in the new lifecycle.
UPDATE `tas_excel_import_batches`
SET `lifecycleStatus` = CASE
  WHEN `status` = 'completed' THEN 'completed'
  ELSE 'active'
END
WHERE `lifecycleStatus` = 'active';

-- Safe legacy backfill: competitive queues already persist an authoritative
-- importBatchId -> leadId relationship. Do not infer any other legacy links.
UPDATE `leads` AS l
INNER JOIN (
  SELECT `leadId`, MAX(`importBatchId`) AS `importBatchId`
  FROM `tas_lead_queue_entries`
  GROUP BY `leadId`
) AS q ON q.`leadId` = l.`id`
SET l.`importBatchId` = q.`importBatchId`
WHERE l.`importBatchId` IS NULL;
