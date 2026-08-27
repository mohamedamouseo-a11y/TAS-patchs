#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(here, "..");
const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");
if (targetIndex === -1 || !args[targetIndex + 1]) {
  throw new Error("Usage: node scripts/apply-tas-rbac-legacy-route-parity-v2.mjs --target <TAS_TARGET>");
}

const target = path.resolve(args[targetIndex + 1]);
const appPath = path.join(target, "client/src/App.tsx");
if (!fs.existsSync(appPath)) throw new Error(`Target App.tsx not found: ${appPath}`);

const copies = [
  ["files/client/src/lib/legacyRouteParity.ts", "client/src/lib/legacyRouteParity.ts"],
  ["files/client/src/components/LegacyRouteParityGuard.tsx", "client/src/components/LegacyRouteParityGuard.tsx"],
];

for (const [, dstRel] of copies) {
  const dst = path.join(target, dstRel);
  if (fs.existsSync(dst)) throw new Error(`Refusing to overwrite existing file: ${dstRel}`);
}

let app = fs.readFileSync(appPath, "utf8");
if (app.includes('LegacyRouteParityGuard from "./components/LegacyRouteParityGuard"')) {
  throw new Error("LegacyRouteParityGuard already integrated in App.tsx");
}

const importAnchor = 'import { InnoCallProvider } from "./contexts/InnoCallProvider";';
if (!app.includes(importAnchor)) throw new Error(`Expected App import anchor not found: ${importAnchor}`);
app = app.replace(
  importAnchor,
  `${importAnchor}\nimport LegacyRouteParityGuard from "./components/LegacyRouteParityGuard";`
);

const replacements = new Map([
  ['<Route path="/dashboard" component={AgentDashboard} />', '<Route path="/dashboard">{() => <LegacyRouteParityGuard><AgentDashboard /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/leads" component={LeadsList} />', '<Route path="/leads">{() => <LegacyRouteParityGuard><LeadsList /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/leads/:id" component={LeadProfile} />', '<Route path="/leads/:id">{() => <LegacyRouteParityGuard><LeadProfile /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/sales-funnel" component={SalesFunnelDashboard} />', '<Route path="/sales-funnel">{() => <LegacyRouteParityGuard><SalesFunnelDashboard /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/task-sla" component={TaskSlaDashboard} />', '<Route path="/task-sla">{() => <LegacyRouteParityGuard><TaskSlaDashboard /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/calendar" component={CalendarPage} />', '<Route path="/calendar">{() => <LegacyRouteParityGuard><CalendarPage /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/inbox" component={InboxPage} />', '<Route path="/inbox">{() => <LegacyRouteParityGuard><InboxPage /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/admin" component={AdminSettings} />', '<Route path="/admin">{() => <LegacyRouteParityGuard><AdminSettings /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/settings" component={AdminSettings} />', '<Route path="/settings">{() => <LegacyRouteParityGuard><AdminSettings /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/import" component={ImportLeads} />', '<Route path="/import">{() => <LegacyRouteParityGuard><ImportLeads /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/competitive-queues" component={TASCompetitiveQueues} />', '<Route path="/competitive-queues">{() => <LegacyRouteParityGuard><TASCompetitiveQueues /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/ux-library" component={UXLibraryPage} />', '<Route path="/ux-library">{() => <LegacyRouteParityGuard><UXLibraryPage /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/notification-settings" component={NotificationSettings} />', '<Route path="/notification-settings">{() => <LegacyRouteParityGuard><NotificationSettings /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/meta-campaigns" component={MetaCampaigns} />', '<Route path="/meta-campaigns">{() => <LegacyRouteParityGuard><MetaCampaigns /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/bd" component={BDDashboard} />', '<Route path="/bd">{() => <LegacyRouteParityGuard><BDDashboard /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/bd/deals" component={DealsKanban} />', '<Route path="/bd/deals">{() => <LegacyRouteParityGuard><DealsKanban /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/bd/deals/:id" component={DealDetail} />', '<Route path="/bd/deals/:id">{() => <LegacyRouteParityGuard><DealDetail /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/bd/companies" component={CompaniesList} />', '<Route path="/bd/companies">{() => <LegacyRouteParityGuard><CompaniesList /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/bd/contacts" component={ContactsList} />', '<Route path="/bd/contacts">{() => <LegacyRouteParityGuard><ContactsList /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/bd/analytics" component={BDAnalytics} />', '<Route path="/bd/analytics">{() => <LegacyRouteParityGuard><BDAnalytics /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/bd/templates" component={BDEmailTemplates} />', '<Route path="/bd/templates">{() => <LegacyRouteParityGuard><BDEmailTemplates /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/bd/settings" component={BDSettings} />', '<Route path="/bd/settings">{() => <LegacyRouteParityGuard><BDSettings /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/wa-gateway/accounts" component={WAGatewayAccounts} />', '<Route path="/wa-gateway/accounts">{() => <LegacyRouteParityGuard><WAGatewayAccounts /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/wa-gateway" component={WAGatewayInbox} />', '<Route path="/wa-gateway">{() => <LegacyRouteParityGuard><WAGatewayInbox /></LegacyRouteParityGuard>}</Route>'],
  ['<Route path="/automotive/whatsapp" component={WAGatewayInbox} />', '<Route path="/automotive/whatsapp">{() => <LegacyRouteParityGuard><WAGatewayInbox /></LegacyRouteParityGuard>}</Route>'],
]);

for (const [from, to] of replacements) {
  if (!app.includes(from)) {
    throw new Error(`Expected route anchor not found: ${from}`);
  }
  app = app.replace(from, to);
}

for (const [srcRel, dstRel] of copies) {
  const src = path.join(patchRoot, srcRel);
  const dst = path.join(target, dstRel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

fs.writeFileSync(appPath, app, "utf8");
console.log("Applied TAS-RBAC-Legacy-Route-Parity-V2");
