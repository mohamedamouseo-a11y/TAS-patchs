import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(process.argv[2] || '.');
const files = [
  'client/src/pages/automotive/VehicleCatalogPage.tsx',
  'client/src/pages/tas/TASConversationsPage.tsx',
  'client/src/pages/tas/TASFinancePage.tsx',
  'client/src/pages/automotive/AutomotiveFinancePage.tsx',
  'client/src/pages/tas/TASMarketingPage.tsx',
  'client/src/pages/automotive/AutomotiveMarketingPage.tsx',
  'client/src/pages/tas/TASOperationsPage.tsx',
  'client/src/pages/automotive/AutomotiveOperationsPage.tsx',
  'client/src/pages/tas/TASSalesPage.tsx',
  'client/src/pages/tas/TASAdminPage.tsx',
  'client/src/pages/automotive/AutomotiveAdminPage.tsx',
  'client/src/pages/tas/TASDashboard.tsx',
];

const failures = [];
for (const rel of files) {
  const full = path.join(target, rel);
  if (!fs.existsSync(full)) {
    failures.push(`${rel}: missing`);
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  const hasMutation = /useMutation\s*\(/.test(text);
  if (hasMutation && !/useTasRbac/.test(text)) {
    failures.push(`${rel}: has mutations but no useTasRbac`);
  }

  const suspicious = [
    /\[['"]Admin['"][^\]]*\]\.includes\([^\)]*role/i,
    /\[['"]Admin['"][^\]]*['"]SalesManager['"][^\]]*\]\.includes\([^\)]*role/i,
    /\[['"]Admin['"][^\]]*['"]MediaBuyer['"][^\]]*\]\.includes\([^\)]*role/i,
    /user\?\.role\s*===\s*['"]Admin['"]/i,
    /user\.role\s*===\s*['"]Admin['"]/i,
  ];
  if (hasMutation && suspicious.some((re) => re.test(text))) {
    failures.push(`${rel}: still contains hard-coded current-user role gate alongside mutations; inspect sensitive action controls`);
  }
}

if (failures.length) {
  console.error('TAS_RBAC_UI_PHASE1_VERIFY=FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('TAS_RBAC_UI_PHASE1_VERIFY=PASS');
