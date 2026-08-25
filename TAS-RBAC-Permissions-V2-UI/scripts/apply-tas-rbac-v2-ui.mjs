#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(scriptDir, "..");
const filesRoot = path.join(patchRoot, "files");
const targetArgIndex = process.argv.indexOf("--target");
const targetRoot = path.resolve(targetArgIndex >= 0 ? process.argv[targetArgIndex + 1] : process.cwd());

if (!fs.existsSync(path.join(targetRoot, "client", "src", "App.tsx"))) {
  throw new Error(`Invalid TAS target: ${targetRoot}`);
}

function copyPayload(relativePath) {
  const source = path.join(filesRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  if (!fs.existsSync(source)) throw new Error(`Missing patch payload: ${relativePath}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`[RBAC V2] copied ${relativePath}`);
}

function replaceRequired(text, oldValue, newValue, label) {
  if (text.includes(newValue)) return text;
  if (!text.includes(oldValue)) throw new Error(`Anchor not found: ${label}`);
  return text.replace(oldValue, newValue);
}

for (const relative of [
  "client/src/lib/tasRbac.ts",
  "client/src/components/TASPermissionGuard.tsx",
  "client/src/pages/tas/TASRolesPermissionsPage.tsx",
  "server/tasRbacUiV2.contract.test.ts",
]) {
  copyPayload(relative);
}

// App.tsx: register the admin permissions page and put all TAS/Automotive private pages behind RBAC view guards.
{
  const appPath = path.join(targetRoot, "client", "src", "App.tsx");
  let app = fs.readFileSync(appPath, "utf8");

  app = replaceRequired(
    app,
    'import TASAdminPage from "./pages/tas/TASAdminPage";\n',
    'import TASAdminPage from "./pages/tas/TASAdminPage";\nimport TASRolesPermissionsPage from "./pages/tas/TASRolesPermissionsPage";\nimport TASPermissionGuard from "./components/TASPermissionGuard";\n',
    "App RBAC imports",
  );

  const guardedRoutes = [
    ["/tas", "TASDashboard", "dashboard"],
    ["/tas/conversations", "TASConversationsPage", "conversations"],
    ["/tas/shipping-agent", "TASShipmentAgentPage", "shipping"],
    ["/tas/finance", "TASFinancePage", "finance"],
    ["/tas/service", "TASServicePage", "service"],
    ["/tas/after-sales", "TASAfterSalesPage", "after_sales"],
    ["/tas/sales", "TASSalesPage", "sales"],
    ["/tas/operations", "TASOperationsPage", "operations"],
    ["/tas/reports", "TASSalesPage", "reports"],
    ["/tas/marketing", "TASMarketingPage", "marketing"],
    ["/tas/admin", "TASAdminPage", "admin"],
    ["/tas/whatsapp-cloud", "WhatsAppCloud", "integrations"],
    ["/automotive/catalog", "VehicleCatalogPage", "catalog"],
    ["/automotive/sales", "TASSalesPage", "sales"],
    ["/automotive/conversations", "AutomotiveConversationsPage", "conversations"],
    ["/automotive/whatsapp-cloud", "WhatsAppCloud", "integrations"],
    ["/automotive/shipping-agent", "TASShipmentAgentPage", "shipping"],
    ["/automotive/finance", "AutomotiveFinancePage", "finance"],
    ["/automotive/service", "AutomotiveServicePage", "service"],
    ["/automotive/after-sales", "AutomotiveAfterSalesPage", "after_sales"],
    ["/automotive/operations", "AutomotiveOperationsPage", "operations"],
    ["/automotive/reports", "AutomotiveReportsPage", "reports"],
    ["/automotive/marketing", "AutomotiveMarketingPage", "marketing"],
    ["/automotive/admin", "AutomotiveAdminPage", "admin"],
    ["/automotive", "AutomotiveDashboard", "dashboard"],
  ];

  for (const [route, component, module] of guardedRoutes) {
    const oldRoute = `      <Route path="${route}" component={${component}} />`;
    const newRoute = `      <Route path="${route}">{() => <TASPermissionGuard module="${module}"><${component} /></TASPermissionGuard>}</Route>`;
    app = replaceRequired(app, oldRoute, newRoute, `guard ${route}`);
  }

  app = replaceRequired(
    app,
    '      <Route path="/tas/admin">{() => <TASPermissionGuard module="admin"><TASAdminPage /></TASPermissionGuard>}</Route>\n',
    '      <Route path="/tas/admin/permissions">{() => <TASPermissionGuard module="roles" adminOnly><TASRolesPermissionsPage /></TASPermissionGuard>}</Route>\n      <Route path="/tas/admin">{() => <TASPermissionGuard module="admin"><TASAdminPage /></TASPermissionGuard>}</Route>\n',
    "roles permissions route",
  );

  fs.writeFileSync(appPath, app);
  console.log("[RBAC V2] integrated client/src/App.tsx");
}

// CRMLayout.tsx: use effective RBAC for TAS/Automotive navigation while retaining legacy role logic elsewhere.
{
  const layoutPath = path.join(targetRoot, "client", "src", "components", "CRMLayout.tsx");
  let layout = fs.readFileSync(layoutPath, "utf8");

  layout = replaceRequired(
    layout,
    'import { isTASSuperAdmin } from "@/lib/superAdmin";\n',
    'import { isTASSuperAdmin } from "@/lib/superAdmin";\nimport { tasModuleForPath } from "@/lib/tasRbac";\n',
    "CRMLayout RBAC import",
  );

  const taraQuery = `  const taraModeratorProfileQ = trpc.tara.moderation.profile.useQuery(undefined, {\n    enabled: isAuthenticated,\n    retry: false,\n    refetchOnWindowFocus: false,\n  });\n`;
  const taraAndRbac = `${taraQuery}  const tasRbacQ = trpc.tasRbac.me.useQuery(undefined, {\n    enabled: isAuthenticated,\n    retry: false,\n    staleTime: 30_000,\n    refetchOnWindowFocus: false,\n  });\n`;
  layout = replaceRequired(layout, taraQuery, taraAndRbac, "CRMLayout RBAC query");

  const roleAnchor = '  const role = user?.role ?? "SalesAgent";\n';
  const roleWithGate = `${roleAnchor}  const canUseHref = (href: string, legacyRoles?: string[]) => {\n    const permissionModule = tasModuleForPath(href);\n    if (permissionModule) {\n      if (permissionModule === "roles" && !["Admin", "admin"].includes(role)) return false;\n      return Boolean((tasRbacQ.data?.permissions as any)?.[permissionModule]?.view);\n    }\n    return !legacyRoles || legacyRoles.includes(role);\n  };\n`;
  layout = replaceRequired(layout, roleAnchor, roleWithGate, "CRMLayout permission resolver");

  layout = replaceRequired(
    layout,
    `  const visibleNavItems = navItems.filter(\n    (item) => (item.visible ?? true) && (!item.roles || item.roles.includes(role))\n  );`,
    `  const visibleNavItems = navItems.filter(\n    (item) => (item.visible ?? true) && canUseHref(item.href, item.roles)\n  );`,
    "CRMLayout nav filter",
  );

  layout = replaceRequired(
    layout,
    `    if (!visible || !canShowForRole(roles)) return null;\n    return { href, label, icon };`,
    `    if (!visible || !canUseHref(href, roles)) return null;\n    return { href, label, icon };`,
    "CRMLayout custom nav filter",
  );

  layout = replaceRequired(
    layout,
    `      items: compactItems(\n        toSidebarGroupItem("/settings"),`,
    `      items: compactItems(\n        customSidebarItem("/tas/admin/permissions", isRTL ? "الأدوار والصلاحيات" : "Roles & Permissions", <Shield size={15} />),\n        toSidebarGroupItem("/settings"),`,
    "CRMLayout permissions menu item",
  );

  fs.writeFileSync(layoutPath, layout);
  console.log("[RBAC V2] integrated client/src/components/CRMLayout.tsx");
}

console.log("[RBAC V2] apply complete");
