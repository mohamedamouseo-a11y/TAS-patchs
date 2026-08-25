import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("TAS RBAC Permissions V2 UI contract", () => {
  it("registers the permissions management page behind an admin-only RBAC guard", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('import TASRolesPermissionsPage from "./pages/tas/TASRolesPermissionsPage";');
    expect(app).toContain('import TASPermissionGuard from "./components/TASPermissionGuard";');
    expect(app).toContain('<Route path="/tas/admin/permissions">{() => <TASPermissionGuard module="roles" adminOnly><TASRolesPermissionsPage /></TASPermissionGuard>}</Route>');
  });

  it("guards the principal TAS and Automotive workspaces by module view permission", () => {
    const app = read("client/src/App.tsx");
    const expected = [
      ['dashboard', '<TASDashboard />'],
      ['conversations', '<TASConversationsPage />'],
      ['sales', '<TASSalesPage />'],
      ['finance', '<TASFinancePage />'],
      ['service', '<TASServicePage />'],
      ['after_sales', '<TASAfterSalesPage />'],
      ['operations', '<TASOperationsPage />'],
      ['reports', '<AutomotiveReportsPage />'],
      ['marketing', '<TASMarketingPage />'],
      ['shipping', '<TASShipmentAgentPage />'],
      ['integrations', '<WhatsAppCloud />'],
    ];
    for (const [module, component] of expected) {
      expect(app).toContain(`module="${module}"`);
      expect(app).toContain(component);
    }
  });

  it("filters TAS sidebar entries from effective RBAC permissions instead of fixed roles", () => {
    const layout = read("client/src/components/CRMLayout.tsx");
    expect(layout).toContain('import { tasModuleForPath } from "@/lib/tasRbac";');
    expect(layout).toContain("  Shield,\n} from \"lucide-react\";");
    expect(layout).toContain("const tasRbacQ = trpc.tasRbac.me.useQuery");
    expect(layout).toContain("canUseHref(item.href, item.roles)");
    expect(layout).toContain('customSidebarItem("/tas/admin/permissions"');
    expect(layout).toContain('<Shield size={15} />');
  });

  it("ships a full roles matrix editor and user-role assignment UI", () => {
    const page = read("client/src/pages/tas/TASRolesPermissionsPage.tsx");
    expect(page).toContain("trpc.tasRbac.listRoles.useQuery");
    expect(page).toContain("trpc.tasRbac.listUsers.useQuery");
    expect(page).toContain("trpc.tasRbac.saveRole.useMutation");
    expect(page).toContain("trpc.tasRbac.deleteRole.useMutation");
    expect(page).toContain("trpc.tasRbac.assignUserRole.useMutation");
    expect(page).toContain("TAS_RBAC_ACTIONS.map");
    expect(page).toContain("TAS_DATA_SCOPES.map");
  });
});
