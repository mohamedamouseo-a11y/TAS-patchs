import mysql from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { APP_USER_ROLES, normalizeUserRole } from "./roleUtils";
import {
  DEFAULT_TAS_ROLE_MATRIX,
  TAS_DATA_SCOPES,
  TAS_RBAC_ACTIONS,
  TAS_RBAC_MODULES,
  type TasDataScope,
  type TasPermissionMatrix,
  type TasRbacAction,
  type TasRbacModule,
} from "./tasRbacPolicy";

let pool: mysql.Pool | null = null;
function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DATABASE_URL is not configured" });
  }
  if (!pool) pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

const BUILTIN_ROLES = new Set<string>(APP_USER_ROLES as readonly string[]);
const USER_TARGET_KEYS = new Set([
  "userId",
  "ownerId",
  "assignedTo",
  "assignedUserId",
  "assignedToUserId",
  "salesAgentId",
  "agentId",
  "createdByUserId",
  "scopeUserId",
  "targetUserId",
  "toUserId",
]);

export type TasApiAccessDecision = {
  module: TasRbacModule;
  action: TasRbacAction;
  dataScope: TasDataScope;
  requestedRole: string;
  effectiveLegacyRole: string;
  customRole: boolean;
};

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function inferTasRbacModule(path: string): TasRbacModule | null {
  const normalized = String(path || "").toLowerCase();
  if (!normalized || normalized.startsWith("tasrbac.")) return null;
  if (!(normalized.startsWith("tas.") || normalized.startsWith("automotive"))) return null;

  if (hasAny(normalized, ["channel", "integration", "whatsapp-cloud", "webhook", "dispatch"])) return "integrations";
  if (hasAny(normalized, ["vehiclebrand", "catalog", "vehiclecatalog", "listvehicles", "createvehicle", "updatevehicle", "inventory"])) return "catalog";
  if (hasAny(normalized, ["finance", "installment", "payment"] )) return "finance";
  if (hasAny(normalized, ["aftersales", "after_sales", "parts", "feedback"])) return "after_sales";
  if (hasAny(normalized, ["service", "booking", "appointment", "maintenance"])) return "service";
  if (hasAny(normalized, ["shipment", "shipping", "trackingagent"])) return "shipping";
  if (hasAny(normalized, ["conversation", "message", "inbound", "manualmessage"])) return "conversations";
  if (hasAny(normalized, ["report", "analytics", "summary"])) return "reports";
  if (hasAny(normalized, ["marketing", "campaign"])) return "marketing";
  if (hasAny(normalized, ["operation", "queue", "dispatcher"])) return "operations";
  if (hasAny(normalized, ["sales", "lead", "quotation", "quote", "testdrive", "tradein", "handover", "pipeline"])) return "sales";
  if (hasAny(normalized, ["branch", "admin", "setup"])) return "admin";
  return "dashboard";
}

export function inferTasRbacAction(path: string, type: string): TasRbacAction {
  const normalized = String(path || "").toLowerCase();
  const operation = normalized.split(".").pop() ?? normalized;

  if (type === "query") {
    if (hasAny(operation, ["export", "download"])) return "export";
    return "view";
  }

  if (hasAny(operation, ["delete", "remove", "archive"])) return "delete";
  if (hasAny(operation, ["assign", "reassign", "handover", "transfer", "dispatch"])) return "assign";
  if (hasAny(operation, ["approve", "confirm", "accept", "reject"])) return "approve";
  if (hasAny(operation, ["export", "download"])) return "export";
  if (hasAny(operation, ["create", "add", "import", "duplicate", "send", "schedule"])) return "create";
  return "edit";
}

async function explicitMatrix(roleKey: string): Promise<TasPermissionMatrix | null> {
  const [rows] = await getPool().query<any[]>(
    `SELECT p.module_key, p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_export, p.can_approve, p.can_assign, p.data_scope
     FROM tas_rbac_role_permissions p
     INNER JOIN tas_rbac_roles r ON r.id=p.role_id
     WHERE r.role_key=? AND r.is_active=1`,
    [roleKey],
  );
  if (!rows.length) return null;
  const matrix: TasPermissionMatrix = {};
  for (const row of rows) {
    if (!TAS_RBAC_MODULES.includes(row.module_key)) continue;
    const scope = TAS_DATA_SCOPES.includes(row.data_scope) ? row.data_scope : "own";
    matrix[row.module_key as TasRbacModule] = {
      view: Boolean(row.can_view),
      create: Boolean(row.can_create),
      edit: Boolean(row.can_edit),
      delete: Boolean(row.can_delete),
      export: Boolean(row.can_export),
      approve: Boolean(row.can_approve),
      assign: Boolean(row.can_assign),
      dataScope: scope,
    };
  }
  return matrix;
}

async function matrixForRole(role: string): Promise<TasPermissionMatrix> {
  if (role === "Admin") return DEFAULT_TAS_ROLE_MATRIX.Admin;
  const explicit = await explicitMatrix(role);
  if (explicit) return explicit;
  if (BUILTIN_ROLES.has(role)) return DEFAULT_TAS_ROLE_MATRIX[role] ?? {};
  throw new TRPCError({ code: "FORBIDDEN", message: `RBAC role is not active or has no permission matrix: ${role}` });
}

function collectTargetUserIds(input: unknown, output = new Set<number>(), depth = 0): Set<number> {
  if (depth > 5 || input == null) return output;
  if (Array.isArray(input)) {
    for (const value of input) collectTargetUserIds(value, output, depth + 1);
    return output;
  }
  if (typeof input !== "object") return output;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (USER_TARGET_KEYS.has(key)) {
      const id = Number(value);
      if (Number.isInteger(id) && id > 0) output.add(id);
      continue;
    }
    if (value && typeof value === "object") collectTargetUserIds(value, output, depth + 1);
  }
  return output;
}

async function userTeamId(userId: number): Promise<number | null> {
  const [rows] = await getPool().query<any[]>(
    "SELECT teamId FROM users WHERE id=? AND deletedAt IS NULL LIMIT 1",
    [userId],
  );
  const value = Number(rows[0]?.teamId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function enforceRequestScope(userId: number, scope: TasDataScope, input: unknown) {
  if (scope === "all") return;
  if (scope === "branch") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Branch-scoped API access is fail-closed until an explicit user-to-branch membership is configured",
    });
  }

  const targets = [...collectTargetUserIds(input)];
  if (!targets.length) return;

  if (scope === "own" || scope === "assigned") {
    if (targets.some((id) => id !== userId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Data scope ${scope} does not allow targeting another user` });
    }
    return;
  }

  if (scope === "team") {
    const actorTeamId = await userTeamId(userId);
    if (!actorTeamId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Team-scoped access requires the current user to belong to a team" });
    }
    for (const targetId of targets) {
      if (targetId === userId) continue;
      const targetTeamId = await userTeamId(targetId);
      if (!targetTeamId || targetTeamId !== actorTeamId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Target user is outside the permitted team scope" });
      }
    }
  }
}

export function legacyExecutionRole(module: TasRbacModule, scope: TasDataScope, requestedRole: string): string {
  if (BUILTIN_ROLES.has(requestedRole)) return requestedRole;
  if (scope === "branch") return "Viewer";
  if (scope === "all") {
    if (module === "finance") return "Finance";
    if (module === "marketing") return "MediaBuyer";
    if (["admin", "integrations", "users", "roles", "audit_log", "system_settings", "catalog"].includes(module)) return "Admin";
    if (module === "service") return "ServiceAdvisor";
    if (module === "after_sales") return "CrmFollowUp";
    if (module === "operations") return "LeadDispatcher";
    return "SalesManager";
  }

  // For own/assigned/team custom scopes use a conservative frontline execution profile.
  // Existing TAS resolvers already scope these profiles to the current actor/assignment.
  if (module === "finance") return "SalesAgent";
  if (module === "marketing") return "MediaBuyer";
  if (module === "service") return "ServiceAdvisor";
  if (module === "after_sales") return "CrmFollowUp";
  if (module === "operations") return "LeadDispatcher";
  if (["admin", "integrations", "users", "roles", "audit_log", "system_settings"].includes(module)) return "Viewer";
  return "SalesAgent";
}

export async function authorizeTasApiRequest(
  user: { id: number; role?: string | null },
  path: string,
  type: string,
  rawInput: unknown,
): Promise<TasApiAccessDecision | null> {
  const module = inferTasRbacModule(path);
  if (!module) return null;
  const action = inferTasRbacAction(path, type);
  if (!TAS_RBAC_ACTIONS.includes(action)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Unknown TAS RBAC action" });
  }

  const requestedRole = normalizeUserRole(user.role);
  const matrix = await matrixForRole(requestedRole);
  const grant = matrix[module];
  if (!grant?.[action]) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission: ${module}.${action}` });
  }

  await enforceRequestScope(user.id, grant.dataScope, rawInput);
  return {
    module,
    action,
    dataScope: grant.dataScope,
    requestedRole,
    effectiveLegacyRole: legacyExecutionRole(module, grant.dataScope, requestedRole),
    customRole: !BUILTIN_ROLES.has(requestedRole),
  };
}
