export type LegacyRouteParityRule = {
  path: string;
  match: "exact" | "prefix";
  roles: readonly string[];
  allowSuperAdmin?: boolean;
  allowTaraModerator?: boolean;
};

const ROLE_ALIASES: Record<string, string> = {
  admin: "Admin",
  salesmanager: "SalesManager",
  salesagent: "SalesAgent",
  leaddispatcher: "LeadDispatcher",
  accountmanager: "AccountManager",
  accountmanagerlead: "AccountManagerLead",
  finance: "Finance",
  serviceadvisor: "ServiceAdvisor",
  partsagent: "PartsAgent",
  crmfollowup: "CrmFollowUp",
  viewer: "Viewer",
  mediabuyer: "MediaBuyer",
  businessdeveloper: "BusinessDeveloper",
  bd: "BusinessDeveloper",
  superadmin: "SuperAdmin",
  superadministrator: "SuperAdministrator",
};

export function normalizeLegacyParityRole(role?: string | null): string {
  if (!role) return "SalesAgent";
  const raw = String(role).trim();
  const key = raw.toLowerCase().replace(/[\s_-]+/g, "");
  return ROLE_ALIASES[key] ?? raw;
}

const ADMIN = ["Admin"] as const;
const MANAGERS = ["Admin", "SalesManager"] as const;
const SALES_CORE = ["Admin", "SalesManager", "SalesAgent"] as const;
const MARKETING = ["Admin", "MediaBuyer"] as const;
const SETTINGS = [
  "Admin",
  "SalesManager",
  "SalesAgent",
  "MediaBuyer",
  "AccountManager",
  "AccountManagerLead",
] as const;

/**
 * Legacy route admission rules intentionally mirror the CURRENT legacy sidebar
 * predicates audited on 2026-08-27. These rules do not alter TAS RBAC V1/V2/V3
 * module/action/data-scope policy and must not be reused as backend authorization.
 */
export const LEGACY_ROUTE_PARITY_RULES: readonly LegacyRouteParityRule[] = [
  { path: "/dashboard", match: "exact", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer"] },
  { path: "/leads", match: "exact", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer"] },
  { path: "/leads/", match: "prefix", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer"] },
  { path: "/sales-funnel", match: "exact", roles: SALES_CORE },
  { path: "/task-sla", match: "exact", roles: SALES_CORE },
  { path: "/calendar", match: "exact", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer"] },
  { path: "/inbox", match: "exact", roles: SETTINGS },

  { path: "/admin", match: "exact", roles: ADMIN },
  { path: "/settings", match: "exact", roles: SETTINGS },
  { path: "/import", match: "exact", roles: ADMIN },
  {
    path: "/competitive-queues",
    match: "exact",
    roles: ["Admin", "SalesManager", "SalesAgent", "LeadDispatcher"],
    allowSuperAdmin: true,
  },
  { path: "/ux-library", match: "exact", roles: MANAGERS },
  { path: "/notification-settings", match: "exact", roles: SETTINGS },

  { path: "/meta-campaigns", match: "exact", roles: MARKETING },

  { path: "/bd", match: "exact", roles: MANAGERS },
  { path: "/bd/deals", match: "exact", roles: MANAGERS },
  { path: "/bd/deals/", match: "prefix", roles: MANAGERS },
  { path: "/bd/companies", match: "exact", roles: MANAGERS },
  { path: "/bd/contacts", match: "exact", roles: MANAGERS },
  { path: "/bd/analytics", match: "exact", roles: MANAGERS },
  { path: "/bd/templates", match: "exact", roles: MANAGERS },
  { path: "/bd/settings", match: "exact", roles: ADMIN },

  {
    path: "/wa-gateway/accounts",
    match: "exact",
    roles: ADMIN,
    allowSuperAdmin: true,
  },
  {
    path: "/wa-gateway",
    match: "exact",
    roles: [
      "Admin",
      "SalesManager",
      "SalesAgent",
      "LeadDispatcher",
      "AccountManager",
      "AccountManagerLead",
      "Finance",
      "ServiceAdvisor",
      "PartsAgent",
      "CrmFollowUp",
      "MediaBuyer",
      "BusinessDeveloper",
    ],
    allowSuperAdmin: true,
    allowTaraModerator: true,
  },
  {
    path: "/automotive/whatsapp",
    match: "exact",
    roles: [
      "Admin",
      "SalesManager",
      "SalesAgent",
      "LeadDispatcher",
      "AccountManager",
      "AccountManagerLead",
      "Finance",
      "ServiceAdvisor",
      "PartsAgent",
      "CrmFollowUp",
      "MediaBuyer",
      "BusinessDeveloper",
    ],
    allowSuperAdmin: true,
    allowTaraModerator: true,
  },
];

function cleanPath(pathname: string): string {
  const base = pathname.split(/[?#]/)[0] || "/";
  return base === "/" ? base : base.replace(/\/+$/, "");
}

export function findLegacyRouteParityRule(pathname: string): LegacyRouteParityRule | undefined {
  const path = cleanPath(pathname);
  return LEGACY_ROUTE_PARITY_RULES.find((rule) =>
    rule.match === "exact" ? path === rule.path : path.startsWith(rule.path)
  );
}

export function isLegacyParityAllowed(
  role: string | null | undefined,
  pathname: string,
  options?: { taraCanAccess?: boolean }
): boolean {
  const rule = findLegacyRouteParityRule(pathname);
  if (!rule) return true;

  const normalized = normalizeLegacyParityRole(role);
  if (rule.allowSuperAdmin && (normalized === "SuperAdmin" || normalized === "SuperAdministrator")) {
    return true;
  }

  if (rule.allowTaraModerator && options?.taraCanAccess) return true;

  return rule.roles.includes(normalized);
}

export function legacyRouteNeedsTaraProfile(pathname: string): boolean {
  return Boolean(findLegacyRouteParityRule(pathname)?.allowTaraModerator);
}
