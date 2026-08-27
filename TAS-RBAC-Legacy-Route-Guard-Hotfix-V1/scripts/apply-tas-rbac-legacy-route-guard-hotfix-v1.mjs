import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(here, "..");
const args = process.argv.slice(2);
const targetFlag = args.indexOf("--target");
if (targetFlag === -1 || !args[targetFlag + 1]) {
  throw new Error("Usage: node scripts/apply-tas-rbac-legacy-route-guard-hotfix-v1.mjs --target <TAS_DIR>");
}
const targetRoot = path.resolve(args[targetFlag + 1]);

function copy(relative) {
  const src = path.join(patchRoot, "files", relative);
  const dst = path.join(targetRoot, relative);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

copy("client/src/lib/legacyRolePermissions.ts");
copy("client/src/components/LegacyRoleRouteGuard.tsx");

const appPath = path.join(targetRoot, "client/src/App.tsx");
let app = fs.readFileSync(appPath, "utf8");

const importAnchor = 'import { InnoCallProvider } from "./contexts/InnoCallProvider";';
if (!app.includes(importAnchor)) throw new Error("App.tsx import anchor not found");
if (!app.includes('import LegacyRoleRouteGuard from "./components/LegacyRoleRouteGuard";')) {
  app = app.replace(
    importAnchor,
    `${importAnchor}\nimport LegacyRoleRouteGuard from "./components/LegacyRoleRouteGuard";`
  );
}

const routeReplacements = new Map([
  ['<Route path="/dashboard" component={AgentDashboard} />', '<Route path="/dashboard">{() => <LegacyRoleRouteGuard path="/dashboard"><AgentDashboard /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/team-dashboard" component={TeamDashboard} />', '<Route path="/team-dashboard">{() => <LegacyRoleRouteGuard path="/team-dashboard"><TeamDashboard /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/sales-funnel" component={SalesFunnelDashboard} />', '<Route path="/sales-funnel">{() => <LegacyRoleRouteGuard path="/sales-funnel"><SalesFunnelDashboard /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/task-sla" component={TaskSlaDashboard} />', '<Route path="/task-sla">{() => <LegacyRoleRouteGuard path="/task-sla"><TaskSlaDashboard /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/leads" component={LeadsList} />', '<Route path="/leads">{() => <LegacyRoleRouteGuard path="/leads"><LeadsList /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/calendar" component={CalendarPage} />', '<Route path="/calendar">{() => <LegacyRoleRouteGuard path="/calendar"><CalendarPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/import" component={ImportLeads} />', '<Route path="/import">{() => <LegacyRoleRouteGuard path="/import"><ImportLeads /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/competitive-queues" component={TASCompetitiveQueues} />', '<Route path="/competitive-queues">{() => <LegacyRoleRouteGuard path="/competitive-queues"><TASCompetitiveQueues /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/marketing" component={MarketingHub} />', '<Route path="/marketing">{() => <LegacyRoleRouteGuard path="/marketing"><MarketingHub /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/meta-campaigns" component={MetaCampaigns} />', '<Route path="/meta-campaigns">{() => <LegacyRoleRouteGuard path="/meta-campaigns"><MetaCampaigns /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tiktok-campaigns" component={TikTokCampaignsPage} />', '<Route path="/tiktok-campaigns">{() => <LegacyRoleRouteGuard path="/tiktok-campaigns"><TikTokCampaignsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/google-ads" component={GoogleAdsCampaignsPage} />', '<Route path="/google-ads">{() => <LegacyRoleRouteGuard path="/google-ads"><GoogleAdsCampaignsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/snapchat-ads" component={SnapchatCampaignsPage} />', '<Route path="/snapchat-ads">{() => <LegacyRoleRouteGuard path="/snapchat-ads"><SnapchatCampaignsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/linkedin-ads" component={LinkedInCampaignsPage} />', '<Route path="/linkedin-ads">{() => <LegacyRoleRouteGuard path="/linkedin-ads"><LinkedInCampaignsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas" component={TASDashboard} />', '<Route path="/tas">{() => <LegacyRoleRouteGuard path="/tas"><TASDashboard /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/conversations" component={TASConversationsPage} />', '<Route path="/tas/conversations">{() => <LegacyRoleRouteGuard path="/tas/conversations"><TASConversationsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/shipping-agent" component={TASShipmentAgentPage} />', '<Route path="/tas/shipping-agent">{() => <LegacyRoleRouteGuard path="/tas/shipping-agent"><TASShipmentAgentPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/finance" component={TASFinancePage} />', '<Route path="/tas/finance">{() => <LegacyRoleRouteGuard path="/tas/finance"><TASFinancePage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/service" component={TASServicePage} />', '<Route path="/tas/service">{() => <LegacyRoleRouteGuard path="/tas/service"><TASServicePage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/after-sales" component={TASAfterSalesPage} />', '<Route path="/tas/after-sales">{() => <LegacyRoleRouteGuard path="/tas/after-sales"><TASAfterSalesPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/sales" component={TASSalesPage} />', '<Route path="/tas/sales">{() => <LegacyRoleRouteGuard path="/tas/sales"><TASSalesPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/operations" component={TASOperationsPage} />', '<Route path="/tas/operations">{() => <LegacyRoleRouteGuard path="/tas/operations"><TASOperationsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/reports" component={TASSalesPage} />', '<Route path="/tas/reports">{() => <LegacyRoleRouteGuard path="/tas/reports"><TASSalesPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/marketing" component={TASMarketingPage} />', '<Route path="/tas/marketing">{() => <LegacyRoleRouteGuard path="/tas/marketing"><TASMarketingPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/admin" component={TASAdminPage} />', '<Route path="/tas/admin">{() => <LegacyRoleRouteGuard path="/tas/admin"><TASAdminPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/tas/whatsapp-cloud" component={WhatsAppCloud} />', '<Route path="/tas/whatsapp-cloud">{() => <LegacyRoleRouteGuard path="/tas/whatsapp-cloud"><WhatsAppCloud /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/catalog" component={VehicleCatalogPage} />', '<Route path="/automotive/catalog">{() => <LegacyRoleRouteGuard path="/automotive/catalog"><VehicleCatalogPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/sales" component={TASSalesPage} />', '<Route path="/automotive/sales">{() => <LegacyRoleRouteGuard path="/automotive/sales"><TASSalesPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/conversations" component={AutomotiveConversationsPage} />', '<Route path="/automotive/conversations">{() => <LegacyRoleRouteGuard path="/automotive/conversations"><AutomotiveConversationsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/whatsapp-cloud" component={WhatsAppCloud} />', '<Route path="/automotive/whatsapp-cloud">{() => <LegacyRoleRouteGuard path="/automotive/whatsapp-cloud"><WhatsAppCloud /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/shipping-agent" component={TASShipmentAgentPage} />', '<Route path="/automotive/shipping-agent">{() => <LegacyRoleRouteGuard path="/automotive/shipping-agent"><TASShipmentAgentPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/finance" component={AutomotiveFinancePage} />', '<Route path="/automotive/finance">{() => <LegacyRoleRouteGuard path="/automotive/finance"><AutomotiveFinancePage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/service" component={AutomotiveServicePage} />', '<Route path="/automotive/service">{() => <LegacyRoleRouteGuard path="/automotive/service"><AutomotiveServicePage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/after-sales" component={AutomotiveAfterSalesPage} />', '<Route path="/automotive/after-sales">{() => <LegacyRoleRouteGuard path="/automotive/after-sales"><AutomotiveAfterSalesPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/operations" component={AutomotiveOperationsPage} />', '<Route path="/automotive/operations">{() => <LegacyRoleRouteGuard path="/automotive/operations"><AutomotiveOperationsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/reports" component={AutomotiveReportsPage} />', '<Route path="/automotive/reports">{() => <LegacyRoleRouteGuard path="/automotive/reports"><AutomotiveReportsPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/marketing" component={AutomotiveMarketingPage} />', '<Route path="/automotive/marketing">{() => <LegacyRoleRouteGuard path="/automotive/marketing"><AutomotiveMarketingPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive/admin" component={AutomotiveAdminPage} />', '<Route path="/automotive/admin">{() => <LegacyRoleRouteGuard path="/automotive/admin"><AutomotiveAdminPage /></LegacyRoleRouteGuard>}</Route>'],
  ['<Route path="/automotive" component={AutomotiveDashboard} />', '<Route path="/automotive">{() => <LegacyRoleRouteGuard path="/automotive"><AutomotiveDashboard /></LegacyRoleRouteGuard>}</Route>'],
]);

for (const [from, to] of routeReplacements) {
  if (!app.includes(from) && !app.includes(to)) {
    throw new Error(`Expected route anchor not found: ${from}`);
  }
  app = app.replace(from, to);
}

fs.writeFileSync(appPath, app);
console.log("Applied TAS RBAC Legacy Route Guard Hotfix V1");
