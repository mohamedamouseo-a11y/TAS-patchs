import mysql from "mysql2/promise";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tas_rbac_roles (
      id INT NOT NULL AUTO_INCREMENT,
      role_key VARCHAR(128) NOT NULL,
      name_ar VARCHAR(255) NULL,
      name_en VARCHAR(255) NOT NULL,
      description TEXT NULL,
      is_system TINYINT NOT NULL DEFAULT 0,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tas_rbac_roles_key (role_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tas_rbac_role_permissions (
      id INT NOT NULL AUTO_INCREMENT,
      role_id INT NOT NULL,
      module_key VARCHAR(128) NOT NULL,
      can_view TINYINT NOT NULL DEFAULT 0,
      can_create TINYINT NOT NULL DEFAULT 0,
      can_edit TINYINT NOT NULL DEFAULT 0,
      can_delete TINYINT NOT NULL DEFAULT 0,
      can_export TINYINT NOT NULL DEFAULT 0,
      can_approve TINYINT NOT NULL DEFAULT 0,
      can_assign TINYINT NOT NULL DEFAULT 0,
      data_scope ENUM('own','assigned','team','branch','all') NOT NULL DEFAULT 'own',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tas_rbac_role_module (role_id, module_key),
      KEY idx_tas_rbac_permission_role (role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tas_rbac_user_roles (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      role_id INT NOT NULL,
      is_primary TINYINT NOT NULL DEFAULT 1,
      assigned_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tas_rbac_user_role (user_id, role_id),
      KEY idx_tas_rbac_user_primary (user_id, is_primary)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tas_rbac_audit_log (
      id BIGINT NOT NULL AUTO_INCREMENT,
      actor_user_id INT NOT NULL,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(64) NOT NULL,
      target_id VARCHAR(128) NULL,
      before_json JSON NULL,
      after_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_tas_rbac_audit_actor (actor_user_id, created_at),
      KEY idx_tas_rbac_audit_target (target_type, target_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const roles = [
    ["Admin", "مدير النظام", "Admin", 1],
    ["SalesManager", "مدير المبيعات", "Sales Manager", 1],
    ["SalesAgent", "موظف مبيعات", "Sales Agent", 1],
    ["LeadDispatcher", "موزع العملاء", "Lead Dispatcher", 1],
    ["AccountManager", "مدير حساب", "Account Manager", 1],
    ["AccountManagerLead", "قائد مديري الحسابات", "Account Manager Lead", 1],
    ["Finance", "المالية", "Finance", 1],
    ["ServiceAdvisor", "مستشار خدمة", "Service Advisor", 1],
    ["PartsAgent", "مسؤول قطع غيار", "Parts Agent", 1],
    ["CrmFollowUp", "متابعة CRM", "CRM Follow Up", 1],
    ["Viewer", "مشاهدة فقط", "Viewer", 1],
    ["MediaBuyer", "ميديا باير", "Media Buyer", 1],
    ["BusinessDeveloper", "تطوير أعمال", "Business Developer", 1]
  ];

  for (const [key, ar, en, system] of roles) {
    await db.execute(
      `INSERT INTO tas_rbac_roles (role_key, name_ar, name_en, is_system)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name_ar=VALUES(name_ar), name_en=VALUES(name_en), is_system=VALUES(is_system)`,
      [key, ar, en, system],
    );
  }

  await db.end();
  console.log("TAS RBAC V1 schema ready");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
