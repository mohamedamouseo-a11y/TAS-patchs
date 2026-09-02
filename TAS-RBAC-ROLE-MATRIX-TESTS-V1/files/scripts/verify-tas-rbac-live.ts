import mysql from "mysql2/promise";
import { APP_USER_ROLES, normalizeUserRole } from "../server/roleUtils";
import {
  TAS_DATA_SCOPES,
  TAS_RBAC_ACTIONS,
  TAS_RBAC_MODULES,
  type TasRbacAction,
  type TasRbacModule,
} from "../server/tasRbacPolicy";
import { effectiveTasPermissions } from "../server/tasRbacRouter";
import { authorizeTasApiRequest } from "../server/tasRbacApiAccess";

type RoleRow = { roleKey: string; isSystem: number; permissionRows: number };
type UserRoleRow = { roleKey: string; userCount: number; sampleUserId: number | null };

const TESTABLE_MODULE_BASE: Partial<Record<TasRbacModule, string>> = {
  dashboard: "tas.dashboard",
  conversations: "tas.conversations",
  sales: "tas.sales",
  catalog: "tas.catalog",
  finance: "tas.finance",
  service: "tas.service",
  after_sales: "tas.afterSales",
  operations: "tas.operations",
  reports: "tas.reports",
  marketing: "tas.marketing",
  shipping: "tas.shipping",
  integrations: "tas.channels",
  admin: "tas.admin",
};

const ACTION_OPERATION: Record<TasRbacAction, { operation: string; type: "query" | "mutation" }> = {
  view: { operation: "listItems", type: "query" },
  create: { operation: "createItem", type: "mutation" },
  edit: { operation: "updateItem", type: "mutation" },
  delete: { operation: "archiveItem", type: "mutation" },
  export: { operation: "exportItems", type: "query" },
  approve: { operation: "approveItem", type: "mutation" },
  assign: { operation: "assignItem", type: "mutation" },
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("TAS_RBAC_LIVE_VERIFY=FAIL DATABASE_URL is not configured");
  process.exit(2);
}

const connection = await mysql.createConnection(databaseUrl);
const failures: string[] = [];
const warnings: string[] = [];

try {
  const [roleRowsRaw] = await connection.query<any[]>(`
    SELECT r.role_key AS roleKey, r.is_system AS isSystem, COUNT(p.id) AS permissionRows
    FROM tas_rbac_roles r
    LEFT JOIN tas_rbac_role_permissions p ON p.role_id = r.id
    WHERE r.is_active = 1
    GROUP BY r.id, r.role_key, r.is_system
    ORDER BY r.is_system DESC, r.role_key
  `);

  const [userRowsRaw] = await connection.query<any[]>(`
    SELECT role AS roleKey, COUNT(*) AS userCount, MIN(id) AS sampleUserId
    FROM users
    WHERE deletedAt IS NULL
    GROUP BY role
  `);

  const roles = roleRowsRaw.map((row) => ({
    roleKey: String(row.roleKey),
    isSystem: Number(row.isSystem ?? 0),
    permissionRows: Number(row.permissionRows ?? 0),
  })) as RoleRow[];

  const userRoles = new Map<string, UserRoleRow>(
    userRowsRaw.map((row) => [
      normalizeUserRole(String(row.roleKey ?? "")),
      {
        roleKey: normalizeUserRole(String(row.roleKey ?? "")),
        userCount: Number(row.userCount ?? 0),
        sampleUserId: row.sampleUserId == null ? null : Number(row.sampleUserId),
      },
    ]),
  );

  const activeRoleKeys = new Set(roles.map((role) => normalizeUserRole(role.roleKey)));
  for (const [roleKey, row] of userRoles) {
    if (!activeRoleKeys.has(roleKey) && roleKey !== "Admin") {
      failures.push(`active users reference a role that is not active in tas_rbac_roles: ${roleKey} (${row.userCount} users)`);
    }
  }

  console.log("TAS RBAC live verification");
  console.log(`Active roles: ${roles.length}`);

  for (const role of roles) {
    const roleKey = normalizeUserRole(role.roleKey);
    const builtIn = (APP_USER_ROLES as readonly string[]).includes(roleKey);
    const userInfo = userRoles.get(roleKey);
    const actorUserId = userInfo?.sampleUserId ?? 1;

    if (!builtIn && role.permissionRows === 0) {
      failures.push(`${roleKey}: custom role has no explicit permission rows`);
    }

    const matrix = await effectiveTasPermissions({ id: actorUserId, role: roleKey });
    let grantedActionCount = 0;

    for (const module of TAS_RBAC_MODULES) {
      const permission = matrix[module];
      if (!permission) continue;

      if (!TAS_DATA_SCOPES.includes(permission.dataScope)) {
        failures.push(`${roleKey}.${module}: invalid data scope ${String(permission.dataScope)}`);
      }

      const nonViewGranted = TAS_RBAC_ACTIONS
        .filter((action) => action !== "view")
        .some((action) => Boolean(permission[action]));
      if (nonViewGranted && !permission.view) {
        failures.push(`${roleKey}.${module}: non-view action granted while view is disabled`);
      }

      const moduleGrantedActions = TAS_RBAC_ACTIONS.filter((action) => Boolean(permission[action]));
      grantedActionCount += moduleGrantedActions.length;

      if (permission.dataScope === "branch" && moduleGrantedActions.length > 0) {
        failures.push(`${roleKey}.${module}: branch scope is configured, but current TAS API enforcement is fail-closed for branch scope`);
      }
    }

    if (roleKey === "Admin") {
      for (const module of TAS_RBAC_MODULES) {
        const permission = matrix[module];
        if (!permission) {
          failures.push(`Admin.${module}: missing module grant`);
          continue;
        }
        for (const action of TAS_RBAC_ACTIONS) {
          if (!permission[action]) failures.push(`Admin.${module}.${action}: must always be allowed`);
        }
        if (permission.dataScope !== "all") failures.push(`Admin.${module}: scope must be all`);
      }
    }

    for (const [module, basePath] of Object.entries(TESTABLE_MODULE_BASE) as Array<[TasRbacModule, string]>) {
      const permission = matrix[module];
      for (const action of TAS_RBAC_ACTIONS) {
        const expectedAllowed = Boolean(permission?.[action]);
        if (expectedAllowed && permission?.dataScope === "branch") continue;

        const operation = ACTION_OPERATION[action];
        const path = `${basePath}.${operation.operation}`;
        let actualAllowed = false;
        let unexpectedError: unknown = null;

        try {
          const decision = await authorizeTasApiRequest(
            { id: actorUserId, role: roleKey },
            path,
            operation.type,
            {},
          );
          actualAllowed = Boolean(decision);
        } catch (error: any) {
          if (error?.code !== "FORBIDDEN") unexpectedError = error;
        }

        if (unexpectedError) {
          failures.push(`${roleKey}.${module}.${action}: unexpected authorization error: ${String((unexpectedError as any)?.message ?? unexpectedError)}`);
          continue;
        }

        if (actualAllowed !== expectedAllowed) {
          failures.push(`${roleKey}.${module}.${action}: matrix=${expectedAllowed ? "allow" : "deny"} API=${actualAllowed ? "allow" : "deny"}`);
        }
      }
    }

    console.log(`- ${roleKey}: users=${userInfo?.userCount ?? 0}, persistedRows=${role.permissionRows}, grantedActions=${grantedActionCount}`);
  }

  for (const role of APP_USER_ROLES) {
    if (!activeRoleKeys.has(role) && role !== "Admin") warnings.push(`built-in role is not active in tas_rbac_roles: ${role}`);
  }

  if (warnings.length) {
    console.warn("\nWarnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  if (failures.length) {
    console.error("\nFailures:");
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(`\nTAS_RBAC_LIVE_VERIFY=FAIL failures=${failures.length} warnings=${warnings.length}`);
    process.exitCode = 1;
  } else {
    console.log(`\nTAS_RBAC_LIVE_VERIFY=PASS roles=${roles.length} warnings=${warnings.length}`);
  }
} finally {
  await connection.end();
}
