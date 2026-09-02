import fs from 'node:fs';
import path from 'node:path';

const targetArg = process.argv[2];
if (!targetArg) {
  console.error('Usage: node verify-tas-rbac-ui-phase2-v1.mjs <TAS_WORKTREE>');
  process.exit(2);
}

const root = path.resolve(targetArg);
const failures = [];
const warnings = [];

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`missing:${relative}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function must(relative, condition, message) {
  if (!condition) failures.push(`${relative}: ${message}`);
}

function warn(relative, condition, message) {
  if (condition) warnings.push(`${relative}: ${message}`);
}

const vehicleCatalog = read('client/src/pages/automotive/VehicleCatalogPage.tsx');
must(
  'client/src/pages/automotive/VehicleCatalogPage.tsx',
  /useTasRbac/.test(vehicleCatalog) && /rbac\.can\(\s*['"]catalog['"]\s*,\s*['"]delete['"]\s*\)/.test(vehicleCatalog),
  'Phase 1 baseline missing: expected useTasRbac + catalog.delete archive gate',
);

const layout = read('client/src/components/CRMLayout.tsx');
must('client/src/components/CRMLayout.tsx', /tasModuleForPath/.test(layout), 'tasModuleForPath mapping must remain in use');
must(
  'client/src/components/CRMLayout.tsx',
  !/permissionModule\s*===\s*['"]roles['"][\s\S]{0,160}?\[['"]Admin['"]\s*,\s*['"]admin['"]\]/.test(layout),
  'roles navigation still has a literal Admin-only exception',
);

const guard = read('client/src/components/TASPermissionGuard.tsx');
must('client/src/components/TASPermissionGuard.tsx', /useTasRbac/.test(guard), 'must remain RBAC-based');
must('client/src/components/TASPermissionGuard.tsx', !/adminOnly/.test(guard), 'adminOnly bypass remains after Phase 2');

const app = read('client/src/App.tsx');
const rolesRoute = app.match(/<Route\s+path=['"]\/tas\/admin\/permissions['"][\s\S]{0,260}?<\/Route>/)?.[0] ?? '';
must('client/src/App.tsx', Boolean(rolesRoute), 'roles route not found');
must('client/src/App.tsx', rolesRoute ? !/adminOnly/.test(rolesRoute) : false, 'roles route still uses adminOnly');
must('client/src/App.tsx', rolesRoute ? /module=['"]roles['"]/.test(rolesRoute) : false, 'roles route must be guarded by roles.view');

const dashboard = read('client/src/pages/tas/TASDashboard.tsx');
must('client/src/pages/tas/TASDashboard.tsx', /useTasRbac/.test(dashboard), 'dashboard must use TAS RBAC view flags');
must('client/src/pages/tas/TASDashboard.tsx', !/isAdminOrManager/.test(dashboard), 'legacy isAdminOrManager view gate remains');
warn(
  'client/src/pages/tas/TASDashboard.tsx',
  /\[['"]Admin['"][\s\S]{0,120}?SalesManager/.test(dashboard),
  'possible literal current-user role allowlist remains; inspect whether it is authorization',
);

for (const relative of [
  'client/src/pages/tas/TASMarketingPage.tsx',
  'client/src/pages/automotive/AutomotiveMarketingPage.tsx',
]) {
  const src = read(relative);
  must(relative, /useTasRbac/.test(src), 'marketing view must use TAS RBAC');
  must(relative, !/canAccessMarketing\s*=\s*\[/.test(src), 'literal Admin/MediaBuyer marketing gate remains');
  must(relative, !/available only to Admin|متاحة فقط للإدارة/i.test(src), 'literal-role access warning remains');
}

for (const relative of [
  'client/src/pages/tas/TASAdminPage.tsx',
  'client/src/pages/automotive/AutomotiveAdminPage.tsx',
  'client/src/pages/tas/TASFinancePage.tsx',
  'client/src/pages/automotive/AutomotiveFinancePage.tsx',
  'client/src/pages/tas/TASConversationsPage.tsx',
  'client/src/pages/tas/TASOperationsPage.tsx',
  'client/src/pages/automotive/AutomotiveOperationsPage.tsx',
  'client/src/pages/tas/TASSalesPage.tsx',
]) {
  const src = read(relative);
  must(relative, /useTasRbac/.test(src), 'expected useTasRbac after Phase 1/2');
  warn(relative, /enabled\s*:\s*isAdmin\b/.test(src), 'query still enabled by isAdmin instead of module.view');
  warn(relative, /const\s+isAdmin\s*=\s*\[['"]Admin['"]/.test(src), 'literal current-user isAdmin gate remains; classify/fix if used for view authorization');
}

const rolesPage = read('client/src/pages/tas/TASRolesPermissionsPage.tsx');
must('client/src/pages/tas/TASRolesPermissionsPage.tsx', /useTasRbac/.test(rolesPage), 'roles page must gate current-user controls via RBAC');
for (const [module, action] of [
  ['roles', 'create'],
  ['roles', 'edit'],
  ['roles', 'delete'],
  ['roles', 'assign'],
  ['users', 'view'],
]) {
  must(
    'client/src/pages/tas/TASRolesPermissionsPage.tsx',
    new RegExp(`rbac\\.can\\(\\s*['"]${module}['"]\\s*,\\s*['"]${action}['"]\\s*\\)`).test(rolesPage),
    `missing ${module}.${action} current-user gate`,
  );
}
must(
  'client/src/pages/tas/TASRolesPermissionsPage.tsx',
  /draft\?\.roleKey\s*===\s*['"]Admin['"]/.test(rolesPage) || /roleKey\s*===\s*['"]Admin['"]/.test(rolesPage),
  'protected Admin-role contextual guard must remain',
);

const rbacRouter = read('server/tasRbacRouter.ts');
must('server/tasRbacRouter.ts', /requireTasPermission/.test(rbacRouter), 'backend must use existing TAS permission checker');
for (const operation of ['listRoles', 'listUsers', 'saveRole', 'deleteRole', 'assignUserRole']) {
  const adminPattern = new RegExp(`${operation}\\s*:\\s*adminProcedure`);
  must('server/tasRbacRouter.ts', !adminPattern.test(rbacRouter), `${operation} still hard-coded to adminProcedure`);
}
for (const signature of [
  ['roles', 'view'],
  ['users', 'view'],
  ['roles', 'create'],
  ['roles', 'edit'],
  ['roles', 'delete'],
  ['roles', 'assign'],
]) {
  const [module, action] = signature;
  must(
    'server/tasRbacRouter.ts',
    new RegExp(`requireTasPermission[\\s\\S]{0,180}?['"]${module}['"][\\s\\S]{0,80}?['"]${action}['"]`).test(rbacRouter),
    `missing backend ${module}.${action} enforcement`,
  );
}

const dirs = [
  'client/src/pages/tas',
  'client/src/pages/automotive',
];
const suspicious = [];
for (const dir of dirs) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) continue;
  for (const name of fs.readdirSync(absolute)) {
    if (!name.endsWith('.tsx')) continue;
    const relative = path.join(dir, name).replaceAll('\\', '/');
    const src = fs.readFileSync(path.join(absolute, name), 'utf8');
    const lines = src.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/draft\?\.roleKey\s*===\s*['"]Admin['"]/.test(line)) return;
      if (/user\?\.role|user\.role|includes\(role\)|const\s+isAdmin\b|isAdminOrManager|canAccessMarketing/.test(line)) {
        suspicious.push(`${relative}:${index + 1}: ${line.trim().slice(0, 180)}`);
      }
    });
  }
}

for (const item of suspicious) warnings.push(`CURRENT_USER_ROLE_CHECK ${item}`);

for (const item of warnings) console.log(`TAS_RBAC_UI_PHASE2_WARN ${item}`);
for (const item of failures) console.error(`TAS_RBAC_UI_PHASE2_FAIL ${item}`);

if (failures.length) {
  console.error(`TAS_RBAC_UI_PHASE2_VERIFY=FAIL failures=${failures.length} warnings=${warnings.length}`);
  process.exit(1);
}

console.log(`TAS_RBAC_UI_PHASE2_VERIFY=PASS warnings=${warnings.length}`);
