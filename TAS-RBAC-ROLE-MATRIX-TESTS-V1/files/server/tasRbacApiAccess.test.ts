import { describe, expect, it } from "vitest";
import { inferTasRbacAction, inferTasRbacModule, legacyExecutionRole } from "./tasRbacApiAccess";

describe("TAS API RBAC inference", () => {
  it.each([
    ["automotive.dashboard.summary", "dashboard"],
    ["automotive.conversations.list", "conversations"],
    ["automotive.sales.pipeline", "sales"],
    ["automotive.catalog.listVehicles", "catalog"],
    ["automotive.finance.listPrograms", "finance"],
    ["automotive.service.listAppointments", "service"],
    ["automotive.afterSales.listPartRequests", "after_sales"],
    ["automotive.operations.queue", "operations"],
    ["automotive.reports.summary", "reports"],
    ["automotive.marketing.campaigns", "marketing"],
    ["automotive.shipping.trackingAgent", "shipping"],
    ["automotive.integrations.list", "integrations"],
    ["automotive.admin.settings", "admin"],
    ["tas.vehicleBrands.list", "catalog"],
    ["tas.channels.listIntegrations", "integrations"],
    ["tas.sales.excelQueues", "operations"],
  ] as const)("maps %s to %s", (path, expectedModule) => {
    expect(inferTasRbacModule(path)).toBe(expectedModule);
  });

  it("does not apply TAS API inference to the RBAC management router itself", () => {
    expect(inferTasRbacModule("tasRbac.me")).toBeNull();
  });

  it.each([
    ["tas.catalog.listVehicles", "query", "view"],
    ["tas.catalog.exportVehicles", "query", "export"],
    ["tas.catalog.createVehicle", "mutation", "create"],
    ["tas.catalog.updateVehicle", "mutation", "edit"],
    ["tas.catalog.archiveVehicle", "mutation", "delete"],
    ["tas.catalog.removeImage", "mutation", "delete"],
    ["tas.sales.assignLead", "mutation", "assign"],
    ["tas.sales.reassignLead", "mutation", "assign"],
    ["tas.sales.approveQuote", "mutation", "approve"],
    ["tas.sales.confirmQuote", "mutation", "approve"],
    ["tas.sales.sendQuote", "mutation", "create"],
  ] as const)("maps %s (%s) to action %s", (path, type, expectedAction) => {
    expect(inferTasRbacAction(path, type)).toBe(expectedAction);
  });

  it("maps the vehicle archive operation to catalog.delete", () => {
    const path = "automotive.catalog.archiveVehicle";
    expect(inferTasRbacModule(path)).toBe("catalog");
    expect(inferTasRbacAction(path, "mutation")).toBe("delete");
  });

  it("uses conservative legacy roles for custom-role execution", () => {
    expect(legacyExecutionRole("catalog", "all", "CustomCatalogManager")).toBe("Admin");
    expect(legacyExecutionRole("sales", "team", "CustomSalesTeam")).toBe("SalesAgent");
    expect(legacyExecutionRole("finance", "all", "CustomFinance")).toBe("Finance");
    expect(legacyExecutionRole("after_sales", "all", "CustomAfterSales")).toBe("CrmFollowUp");
    expect(legacyExecutionRole("operations", "all", "CustomDispatcher")).toBe("LeadDispatcher");
  });
});
