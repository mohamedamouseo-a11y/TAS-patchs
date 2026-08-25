import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  inferTasRbacAction,
  inferTasRbacModule,
  legacyExecutionRole,
} from "./tasRbacApiAccess";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("TAS RBAC Permissions V3 API contract", () => {
  it("maps TAS and Automotive API paths to RBAC modules", () => {
    expect(inferTasRbacModule("tas.sales.overview")).toBe("sales");
    expect(inferTasRbacModule("tas.finance.listPrograms")).toBe("finance");
    expect(inferTasRbacModule("tas.channels.listIntegrations")).toBe("integrations");
    expect(inferTasRbacModule("tas.vehicleBrands.list")).toBe("catalog");
    expect(inferTasRbacModule("automotivePhase2.listServiceBookings")).toBe("service");
    expect(inferTasRbacModule("automotiveFeedback.queue")).toBe("after_sales");
    expect(inferTasRbacModule("leads.list")).toBeNull();
  });

  it("maps operation semantics to the seven server-side RBAC actions", () => {
    expect(inferTasRbacAction("tas.sales.overview", "query")).toBe("view");
    expect(inferTasRbacAction("tas.sales.exportPipeline", "query")).toBe("export");
    expect(inferTasRbacAction("tas.sales.createQuotation", "mutation")).toBe("create");
    expect(inferTasRbacAction("tas.sales.updateStage", "mutation")).toBe("edit");
    expect(inferTasRbacAction("tas.sales.deleteQuotation", "mutation")).toBe("delete");
    expect(inferTasRbacAction("tas.sales.assignLead", "mutation")).toBe("assign");
    expect(inferTasRbacAction("tas.service.confirmAppointment", "mutation")).toBe("approve");
  });

  it("keeps custom-role execution conservative while preserving built-in roles", () => {
    expect(legacyExecutionRole("sales", "assigned", "SalesAgent")).toBe("SalesAgent");
    expect(legacyExecutionRole("sales", "assigned", "CustomAgent")).toBe("SalesAgent");
    expect(legacyExecutionRole("sales", "all", "CustomExecutive")).toBe("SalesManager");
    expect(legacyExecutionRole("finance", "all", "CustomFinance")).toBe("Finance");
    expect(legacyExecutionRole("admin", "assigned", "CustomOps")).toBe("Viewer");
    expect(legacyExecutionRole("admin", "all", "CustomOpsAdmin")).toBe("Admin");
    expect(legacyExecutionRole("sales", "branch", "CustomBranch")).toBe("Viewer");
  });

  it("wires a server-side permission procedure into TAS and Automotive routers", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain('import { authorizeTasApiRequest } from "./tasRbacApiAccess";');
    expect(routers).toContain("const tasPermissionProcedure = protectedProcedure.use");
    expect(routers).toContain("await authorizeTasApiRequest(ctx.user, path, type, rawInput)");
    expect(routers).toContain("tasRbacAccess: access");

    const tasStart = routers.indexOf("const tasRouter = router({");
    const appStart = routers.indexOf("export const appRouter = router({", tasStart);
    expect(tasStart).toBeGreaterThanOrEqual(0);
    expect(appStart).toBeGreaterThan(tasStart);
    const tasBlock = routers.slice(tasStart, appStart);
    expect(tasBlock).toContain("tasPermissionProcedure");
    expect(tasBlock).not.toMatch(/\b(?:protectedProcedure|adminProcedure|managerProcedure|salesReadProcedure|salesEditProcedure|automotiveReadProcedure|automotiveWriteProcedure|clientOpsProcedure)\b/);
    expect(tasBlock).toContain("publicProcedure");

    for (const marker of ["automotiveFollowUp", "automotiveFeedback", "automotivePhase3", "automotivePhase2"]) {
      const blockStart = routers.indexOf(`${marker}: router({`);
      expect(blockStart).toBeGreaterThanOrEqual(0);
      const window = routers.slice(blockStart, blockStart + 9000);
      expect(window).toContain("tasPermissionProcedure");
    }
  });

  it("keeps the competitive queue regression contract aligned with RBAC enforcement", () => {
    const queueContract = read("server/tasQueueFeedbackUiHotfix.test.ts");
    expect(queueContract).toContain('expect(router).toContain("excelQueues: tasPermissionProcedure")');
    expect(queueContract).not.toContain('expect(router).toContain("excelQueues: protectedProcedure")');
  });

  it("ships explicit fail-closed scope handling", () => {
    const access = read("server/tasRbacApiAccess.ts");
    expect(access).toContain('if (scope === "branch")');
    expect(access).toContain("fail-closed until an explicit user-to-branch membership is configured");
    expect(access).toContain('if (scope === "own" || scope === "assigned")');
    expect(access).toContain('if (scope === "team")');
    expect(access).toContain("Target user is outside the permitted team scope");
  });
});
