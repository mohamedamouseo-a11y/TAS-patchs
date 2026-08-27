export const TAS_ALL_ROLES = [
  "Admin",
  "SalesManager",
  "SalesAgent",
  "ServiceAdvisor",
  "PartsAgent",
  "CrmFollowUp",
  "AccountManager",
  "AccountManagerLead",
  "Finance",
  "LeadDispatcher",
] as const;

export const TAS_SALES_ROLES = [
  "Admin",
  "SalesManager",
  "SalesAgent",
  "LeadDispatcher",
  "Finance",
] as const;

export const TAS_FINANCE_ROLES = [
  "Admin",
  "SalesManager",
  "SalesAgent",
  "Finance",
] as const;

export const TAS_SERVICE_ROLES = [
  "Admin",
  "SalesManager",
  "ServiceAdvisor",
  "CrmFollowUp",
] as const;

export const TAS_AFTER_SALES_ROLES = [
  "Admin",
  "SalesManager",
  "ServiceAdvisor",
  "PartsAgent",
  "CrmFollowUp",
] as const;

export const TAS_SHIPMENT_ROLES = [
  "Admin",
  "SalesManager",
  "ServiceAdvisor",
  "PartsAgent",
  "CrmFollowUp",
] as const;

export const TAS_OPERATIONS_ROLES = [
  "Admin",
  "SalesManager",
  "LeadDispatcher",
] as const;

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
  superadministrator: "Super Administrator",
};

export function normalizePermissionRole(role?: string | null): string {
  if (!role) return "SalesAgent";
  const raw = String(role).trim();
  const compact = raw.toLowerCase().replace(/[\s_-]+/g, "");
  return ROLE_ALIASES[compact] ?? raw;
}

type RouteRule = {
  exact?: string;
  prefix?: string;
  roles: readonly string[];
  allowSuperAdmin?: boolean;
};

const ADMIN_ONLY = ["Admin"] as const;
const MANAGER_ONLY = ["Admin", "SalesManager"] as const;
const SALES_AGENT_ROLES = ["Admin", "SalesManager", "SalesAgent"] as const;
const MARKETING_ROLES = ["Admin", "MediaBuyer"] as const;
const SETTINGS_ROLES = [
  "Admin",
  "SalesManager",
  "SalesAgent",
  "MediaBuyer",
  "AccountManager",
  "AccountManagerLead",
] as const;

export const LEGACY_ROUTE_RULES: readonly RouteRule[] = [
  { exact: "/dashboard", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer"] },
  { exact: "/inbox", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer", "AccountManager", "AccountManagerLead"] },
  { exact: "/team-dashboard", roles: MANAGER_ONLY },
  { exact: "/sales-funnel", roles: SALES_AGENT_ROLES },
  { exact: "/task-sla", roles: SALES_AGENT_ROLES },
  { exact: "/leads", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer"] },
  { prefix: "/leads/", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer"] },
  { exact: "/calendar", roles: ["Admin", "SalesManager", "SalesAgent", "MediaBuyer"] },
  { exact: "/import", roles: ADMIN_ONLY },
  { exact: "/competitive-queues", roles: ["Admin", "SalesManager", "SalesAgent", "LeadDispatcher"], allowSuperAdmin: true },

  { exact: "/marketing", roles: MARKETING_ROLES },
  { exact: "/meta-campaigns", roles: MARKETING_ROLES },
  { exact: "/tiktok-campaigns", roles: MARKETING_ROLES },
  { exact: "/google-ads", roles: MARKETING_ROLES },
  { exact: "/snapchat-ads", roles: MARKETING_ROLES },
  { exact: "/linkedin-ads", roles: MARKETING_ROLES },

  { exact: "/tas", roles: TAS_ALL_ROLES },
  { exact: "/tas/conversations", roles: TAS_ALL_ROLES },
  { exact: "/tas/sales", roles: TAS_SALES_ROLES },
  { exact: "/tas/whatsapp-cloud", roles: ADMIN_ONLY },
  { exact: "/tas/shipping-agent", roles: TAS_SHIPMENT_ROLES },
  { exact: "/tas/finance", roles: TAS_FINANCE_ROLES },
  { exact: "/tas/service", roles: TAS_SERVICE_ROLES },
  { exact: "/tas/after-sales", roles: TAS_AFTER_SALES_ROLES },
  { exact: "/tas/operations", roles: TAS_OPERATIONS_ROLES },
  { exact: "/tas/reports", roles: MANAGER_ONLY },
  { exact: "/tas/marketing", roles: MARKETING_ROLES },
  { exact: "/tas/admin", roles: ADMIN_ONLY },

  { exact: "/automotive", roles: TAS_ALL_ROLES },
  { exact: "/automotive/catalog", roles: MANAGER_ONLY },
  { exact: "/automotive/sales", roles: TAS_SALES_ROLES },
  { exact: "/automotive/conversations", roles: TAS_ALL_ROLES },
  { exact: "/automotive/whatsapp-cloud", roles: ADMIN_ONLY },
  { exact: "/automotive/shipping-agent", roles: TAS_SHIPMENT_ROLES },
  { exact: "/automotive/finance", roles: TAS_FINANCE_ROLES },
  { exact: "/automotive/service", roles: TAS_SERVICE_ROLES },
  { exact: "/automotive/after-sales", roles: TAS_AFTER_SALES_ROLES },
  { exact: "/automotive/operations", roles: TAS_OPERATIONS_ROLES },
  { exact: "/automotive/reports", roles: MANAGER_ONLY },
  { exact: "/automotive/marketing", roles: MARKETING_ROLES },
  { exact: "/automotive/admin", roles: ADMIN_ONLY },

  { exact: "/bd", roles: MANAGER_ONLY },
  { exact: "/bd/deals", roles: MANAGER_ONLY },
  { prefix: "/bd/deals/", roles: MANAGER_ONLY },
  { exact: "/bd/companies", roles: MANAGER_ONLY },
  { exact: "/bd/contacts", roles: MANAGER_ONLY },
  { exact: "/bd/analytics", roles: MANAGER_ONLY },
  { exact: "/bd/templates", roles: MANAGER_ONLY },
  { exact: "/bd/settings", roles: ADMIN_ONLY },

  { exact: "/wa-gateway/accounts", roles: ADMIN_ONLY, allowSuperAdmin: true },
  { exact: "/ux-library", roles: MANAGER_ONLY },
  { exact: "/audit-log", roles: ADMIN_ONLY },
  { exact: "/trash", roles: ADMIN_ONLY },
  { exact: "/admin", roles: ADMIN_ONLY },
  { exact: "/admin/chat", roles: ADMIN_ONLY },
  { exact: "/settings", roles: SETTINGS_ROLES },
  { exact: "/notification-settings", roles: SETTINGS_ROLES },
];

function normalizePath(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0] || "/";
  if (clean === "/") return clean;
  return clean.replace(/\/+$/, "");
}

export function getLegacyRouteRule(pathname: string): RouteRule | undefined {
  const path = normalizePath(pathname);
  return LEGACY_ROUTE_RULES.find((rule) =>
    rule.exact ? path === rule.exact : Boolean(rule.prefix && path.startsWith(rule.prefix))
  );
}

export function canAccessLegacyRoute(role: string | null | undefined, pathname: string): boolean {
  const rule = getLegacyRouteRule(pathname);
  if (!rule) return true;

  const normalizedRole = normalizePermissionRole(role);
  if (
    rule.allowSuperAdmin &&
    (normalizedRole === "SuperAdmin" || normalizedRole === "Super Administrator")
  ) {
    return true;
  }

  return rule.roles.includes(normalizedRole);
}
