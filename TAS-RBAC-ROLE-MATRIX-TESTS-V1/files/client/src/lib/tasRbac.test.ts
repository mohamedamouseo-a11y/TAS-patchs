import { describe, expect, it } from "vitest";
import { canFromTasMatrix, scopeFromTasMatrix, tasModuleForPath, type TasPermissionMatrix } from "./tasRbac";

describe("TAS frontend RBAC route mapping", () => {
  it.each([
    ["/tas", "dashboard"],
    ["/tas/conversations", "conversations"],
    ["/tas/shipping-agent", "shipping"],
    ["/tas/finance", "finance"],
    ["/tas/service", "service"],
    ["/tas/after-sales", "after_sales"],
    ["/tas/sales", "sales"],
    ["/tas/operations", "operations"],
    ["/tas/reports", "reports"],
    ["/tas/marketing", "marketing"],
    ["/tas/whatsapp-cloud", "integrations"],
    ["/tas/admin", "admin"],
    ["/tas/admin/permissions", "roles"],
    ["/automotive", "dashboard"],
    ["/automotive/catalog", "catalog"],
    ["/automotive/sales", "sales"],
    ["/automotive/conversations", "conversations"],
    ["/automotive/shipping-agent", "shipping"],
    ["/automotive/finance", "finance"],
    ["/automotive/service", "service"],
    ["/automotive/after-sales", "after_sales"],
    ["/automotive/operations", "operations"],
    ["/automotive/reports", "reports"],
    ["/automotive/marketing", "marketing"],
    ["/automotive/whatsapp-cloud", "integrations"],
    ["/automotive/admin", "admin"],
    ["/audit-log", "audit_log"],
  ] as const)("maps %s to %s", (path, module) => {
    expect(tasModuleForPath(path)).toBe(module);
  });

  it("uses the most specific route before parent routes", () => {
    expect(tasModuleForPath("/tas/admin/permissions?tab=roles")).toBe("roles");
    expect(tasModuleForPath("/automotive/catalog/123")).toBe("catalog");
  });

  it("does not force RBAC onto unrelated legacy pages", () => {
    expect(tasModuleForPath("/settings")).toBeNull();
    expect(tasModuleForPath("/leads")).toBeNull();
  });
});

describe("TAS frontend permission helpers", () => {
  const matrix: TasPermissionMatrix = {
    catalog: {
      view: true, create: false, edit: true, delete: true, export: false, approve: false, assign: false, dataScope: "all",
    },
  };

  it("reads action grants from the matrix", () => {
    expect(canFromTasMatrix(matrix, "catalog", "view")).toBe(true);
    expect(canFromTasMatrix(matrix, "catalog", "edit")).toBe(true);
    expect(canFromTasMatrix(matrix, "catalog", "delete")).toBe(true);
    expect(canFromTasMatrix(matrix, "catalog", "create")).toBe(false);
    expect(canFromTasMatrix(matrix, "sales", "view")).toBe(false);
  });

  it("reads configured scope and fails closed to own when missing", () => {
    expect(scopeFromTasMatrix(matrix, "catalog")).toBe("all");
    expect(scopeFromTasMatrix(matrix, "sales")).toBe("own");
  });
});
