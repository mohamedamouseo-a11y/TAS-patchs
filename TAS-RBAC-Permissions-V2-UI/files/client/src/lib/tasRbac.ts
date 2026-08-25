import { trpc } from "@/lib/trpc";

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

export type TasPermissionGrant = Record<TasRbacAction, boolean> & {
  dataScope: TasDataScope;
};

export type TasPermissionMatrix = Partial<Record<TasRbacModule, TasPermissionGrant>>;

const ROUTE_PERMISSION_RULES: Array<{ prefix: string; module: TasRbacModule }> = [
  { prefix: "/tas/admin/permissions", module: "roles" },
  { prefix: "/tas/conversations", module: "conversations" },
  { prefix: "/tas/shipping-agent", module: "shipping" },
  { prefix: "/tas/finance", module: "finance" },
  { prefix: "/tas/service", module: "service" },
  { prefix: "/tas/after-sales", module: "after_sales" },
  { prefix: "/tas/sales", module: "sales" },
  { prefix: "/tas/operations", module: "operations" },
  { prefix: "/tas/reports", module: "reports" },
  { prefix: "/tas/marketing", module: "marketing" },
  { prefix: "/tas/whatsapp-cloud", module: "integrations" },
  { prefix: "/tas/admin", module: "admin" },
  { prefix: "/tas", module: "dashboard" },

  { prefix: "/automotive/catalog", module: "catalog" },
  { prefix: "/automotive/sales", module: "sales" },
  { prefix: "/automotive/conversations", module: "conversations" },
  { prefix: "/automotive/shipping-agent", module: "shipping" },
  { prefix: "/automotive/finance", module: "finance" },
  { prefix: "/automotive/service", module: "service" },
  { prefix: "/automotive/after-sales", module: "after_sales" },
  { prefix: "/automotive/operations", module: "operations" },
  { prefix: "/automotive/reports", module: "reports" },
  { prefix: "/automotive/marketing", module: "marketing" },
  { prefix: "/automotive/whatsapp-cloud", module: "integrations" },
  { prefix: "/automotive/admin", module: "admin" },
  { prefix: "/automotive", module: "dashboard" },

  { prefix: "/audit-log", module: "audit_log" },
];

export function tasModuleForPath(pathname: string): TasRbacModule | null {
  const cleanPath = String(pathname || "/").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (cleanPath === rule.prefix || cleanPath.startsWith(`${rule.prefix}/`)) return rule.module;
  }
  return null;
}

export function canFromTasMatrix(
  matrix: TasPermissionMatrix | null | undefined,
  module: TasRbacModule,
  action: TasRbacAction = "view",
): boolean {
  return Boolean(matrix?.[module]?.[action]);
}

export function scopeFromTasMatrix(
  matrix: TasPermissionMatrix | null | undefined,
  module: TasRbacModule,
): TasDataScope {
  return matrix?.[module]?.dataScope ?? "own";
}

export function useTasRbac(enabled = true) {
  const query = trpc.tasRbac.me.useQuery(undefined, {
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const permissions = (query.data?.permissions ?? {}) as TasPermissionMatrix;
  const can = (module: TasRbacModule, action: TasRbacAction = "view") =>
    canFromTasMatrix(permissions, module, action);
  const scope = (module: TasRbacModule) => scopeFromTasMatrix(permissions, module);

  return {
    ...query,
    role: query.data?.role ?? null,
    permissions,
    can,
    scope,
  };
}
