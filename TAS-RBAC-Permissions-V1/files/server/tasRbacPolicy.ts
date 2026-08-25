import { TRPCError } from "@trpc/server";
import { normalizeUserRole } from "./roleUtils";

export const TAS_RBAC_MODULES = [
  "dashboard",
  "conversations",
  "sales",
  "catalog",
  "finance",
  "service",
  "after_sales",
  "operations",
  "reports",
  "marketing",
  "shipping",
  "integrations",
  "admin",
  "users",
  "roles",
  "audit_log",
  "system_settings",
] as const;

export const TAS_RBAC_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "approve",
  "assign",
] as const;

export const TAS_DATA_SCOPES = ["own", "assigned", "team", "branch", "all"] as const;

export type TasRbacModule = (typeof TAS_RBAC_MODULES)[number];
export type TasRbacAction = (typeof TAS_RBAC_ACTIONS)[number];
export type TasDataScope = (typeof TAS_DATA_SCOPES)[number];

export type TasPermissionGrant = Record<TasRbacAction, boolean> & { dataScope: TasDataScope };
export type TasPermissionMatrix = Partial<Record<TasRbacModule, TasPermissionGrant>>;

const grant = (
  actions: Partial<Record<TasRbacAction, boolean>>,
  dataScope: TasDataScope = "own",
): TasPermissionGrant => ({
  view: false,
  create: false,
  edit: false,
  delete: false,
  export: false,
  approve: false,
  assign: false,
  ...actions,
  dataScope,
});

const full = (dataScope: TasDataScope = "all") =>
  grant({ view: true, create: true, edit: true, delete: true, export: true, approve: true, assign: true }, dataScope);

const read = (dataScope: TasDataScope = "own") => grant({ view: true }, dataScope);
const work = (dataScope: TasDataScope = "own") => grant({ view: true, create: true, edit: true }, dataScope);

export const DEFAULT_TAS_ROLE_MATRIX: Record<string, TasPermissionMatrix> = {
  Admin: Object.fromEntries(TAS_RBAC_MODULES.map((module) => [module, full("all")])) as TasPermissionMatrix,
  SalesManager: {
    dashboard: read("team"), conversations: work("team"), sales: full("team"), catalog: read("all"),
    finance: read("team"), reports: grant({ view: true, export: true }, "team"),
    shipping: read("team"), audit_log: read("team"),
  },
  SalesAgent: {
    dashboard: read("own"), conversations: work("assigned"), sales: work("assigned"), catalog: read("all"), shipping: read("assigned"),
  },
  LeadDispatcher: {
    dashboard: read("team"), conversations: read("team"), sales: grant({ view: true, edit: true, assign: true }, "team"), reports: read("team"),
  },
  AccountManager: {
    dashboard: read("own"), conversations: work("assigned"), sales: work("assigned"), reports: read("assigned"),
  },
  AccountManagerLead: {
    dashboard: read("team"), conversations: work("team"), sales: work("team"), reports: grant({ view: true, export: true }, "team"),
  },
  Finance: {
    dashboard: read("all"), finance: full("all"), reports: grant({ view: true, export: true }, "all"), sales: read("all"),
  },
  ServiceAdvisor: {
    dashboard: read("assigned"), service: work("assigned"), after_sales: work("assigned"), catalog: read("all"),
  },
  PartsAgent: {
    dashboard: read("assigned"), service: work("assigned"), after_sales: work("assigned"), catalog: read("all"),
  },
  CrmFollowUp: {
    dashboard: read("assigned"), conversations: work("assigned"), sales: work("assigned"), service: read("assigned"), after_sales: work("assigned"),
  },
  Viewer: Object.fromEntries(TAS_RBAC_MODULES.filter((m) => !["admin", "users", "roles", "system_settings"].includes(m)).map((module) => [module, read("all")])) as TasPermissionMatrix,
  MediaBuyer: {
    dashboard: read("all"), marketing: full("all"), reports: grant({ view: true, export: true }, "all"), sales: read("all"),
  },
  BusinessDeveloper: {
    dashboard: read("own"), conversations: work("assigned"), sales: work("assigned"), reports: read("own"),
  },
};

export function getLegacyFallbackMatrix(role?: string | null): TasPermissionMatrix {
  return DEFAULT_TAS_ROLE_MATRIX[normalizeUserRole(role)] ?? DEFAULT_TAS_ROLE_MATRIX.SalesAgent;
}

export function canFromMatrix(matrix: TasPermissionMatrix, module: TasRbacModule, action: TasRbacAction): boolean {
  return Boolean(matrix[module]?.[action]);
}

export function scopeFromMatrix(matrix: TasPermissionMatrix, module: TasRbacModule): TasDataScope {
  return matrix[module]?.dataScope ?? "own";
}

export function requireFromMatrix(matrix: TasPermissionMatrix, module: TasRbacModule, action: TasRbacAction): void {
  if (!canFromMatrix(matrix, module, action)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission: ${module}.${action}` });
  }
}
