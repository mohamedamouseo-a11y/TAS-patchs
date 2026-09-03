-- TAS Advanced Roles & Permissions — Phase 2
-- Feature-level permission overrides layered on top of existing module permissions.
-- Existing roles remain backward compatible because absence of a feature row means inherit parent module.

CREATE TABLE IF NOT EXISTS `tas_rbac_feature_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role_id` INT NOT NULL,
  `feature_key` VARCHAR(191) NOT NULL,
  `can_view` TINYINT(1) NOT NULL DEFAULT 1,
  `can_create` TINYINT(1) NOT NULL DEFAULT 1,
  `can_edit` TINYINT(1) NOT NULL DEFAULT 1,
  `can_delete` TINYINT(1) NOT NULL DEFAULT 1,
  `can_export` TINYINT(1) NOT NULL DEFAULT 1,
  `can_approve` TINYINT(1) NOT NULL DEFAULT 1,
  `can_assign` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tas_rbac_feature_role_key` (`role_id`, `feature_key`),
  KEY `idx_tas_rbac_feature_key` (`feature_key`),
  KEY `idx_tas_rbac_feature_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Intentionally no seed rows.
-- Missing override rows inherit the role's existing parent module permission matrix.
-- This guarantees existing roles remain operational immediately after migration.

-- Verification examples:
-- SHOW CREATE TABLE tas_rbac_feature_permissions;
-- SELECT COUNT(*) FROM tas_rbac_feature_permissions;
-- The initial count may legitimately be 0.