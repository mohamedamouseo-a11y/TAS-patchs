import { describe, expect, it } from "vitest";
import { APP_USER_ROLES } from "./roleUtils";
import {
  DEFAULT_TAS_ROLE_MATRIX,
  TAS_DATA_SCOPES,
  TAS_RBAC_ACTIONS,
  TAS_RBAC_MODULES,
  getLegacyFallbackMatrix,
  type TasDataScope,
  type TasRbacAction,
  type TasRbacModule,
} from "./tasRbacPolicy";

const fullActions = [...TAS_RBAC_ACTIONS] as TasRbacAction[];

type GrantExpectation = { actions: TasRbacAction[]; scope: TasDataScope };
const grant = (actions: TasRbacAction[], scope: TasDataScope): GrantExpectation => ({ actions, scope });
const view = (scope: TasDataScope): GrantExpectation => grant(["view"], scope);
const work = (scope: TasDataScope): GrantExpectation => grant(["view", "create", "edit"], scope);
const full = (scope: TasDataScope): GrantExpectation => grant(fullActions, scope);

const EXPECTED: Partial<Record<string, Partial<Record<TasRbacModule, GrantExpectation>>>> = {
  SalesManager: {
    dashboard: view("team"), conversations: work("team"), sales: full("team"), catalog: view("all"),
    finance: view("team"), reports: grant(["view", "export"], "team"), shipping: view("team"), audit_log: view("team"),
  },
  SalesAgent: {
    dashboard: view("own"), conversations: work("assigned"), sales: work("assigned"), catalog: view("all"), shipping: view("assigned"),
  },
  LeadDispatcher: {
    dashboard: view("team"), conversations: view("team"), sales: grant(["view", "edit", "assign"], "team"), reports: view("team"),
  },
  AccountManager: {
    dashboard: view("own"), conversations: work("assigned"), sales: work("assigned"), reports: view("assigned"),
  },
  AccountManagerLead: {
    dashboard: view("team"), conversations: work("team"), sales: work("team"), reports: grant(["view", "export"], "team"),
  },
  Finance: {
    dashboard: view("all"), finance: full("all"), reports: grant(["view", "export"], "all"), sales: view("all"),
  },
  ServiceAdvisor: {
    dashboard: view("assigned"), service: work("assigned"), after_sales: work("assigned"), catalog: view("all"),
  },
  PartsAgent: {
    dashboard: view("assigned"), service: work("assigned"), after_sales: work("assigned"), catalog: view("all"),
  },
  CrmFollowUp: {
    dashboard: view("assigned"), conversations: work("assigned"), sales: work("assigned"), service: view("assigned"), after_sales: work("assigned"),
  },
  Viewer: Object.fromEntries(
    TAS_RBAC_MODULES.filter((module) => !["admin", "users", "roles", "system_settings"].includes(module)).map((module) => [module, view("all")]),
  ),
  MediaBuyer: {
    dashboard: view("all"), marketing: full("all"), reports: grant(["view", "export"], "all"), sales: view("all"),
  },
  BusinessDeveloper: {
    dashboard: view("own"), conversations: work("assigned"), sales: work("assigned"), reports: view("own"),
  },
};

function expectedGrant(expectation: GrantExpectation) {
  return {
    view: expectation.actions.includes("view"),
    create: expectation.actions.includes("create"),
    edit: expectation.actions.includes("edit"),
    delete: expectation.actions.includes("delete"),
    export: expectation.actions.includes("export"),
    approve: expectation.actions.includes("approve"),
    assign: expectation.actions.includes("assign"),
    dataScope: expectation.scope,
  };
}

describe("DEFAULT_TAS_ROLE_MATRIX", () => {
  it("defines every built-in role", () => {
    for (const role of APP_USER_ROLES) expect(DEFAULT_TAS_ROLE_MATRIX[role], `missing role matrix: ${role}`).toBeDefined();
  });

  it("keeps Admin full-access on every module/action with all-data scope", () => {
    const admin = DEFAULT_TAS_ROLE_MATRIX.Admin;
    for (const module of TAS_RBAC_MODULES) expect(admin[module], `missing Admin module: ${module}`).toEqual(expectedGrant(full("all")));
  });

  it("matches the intended built-in matrix role by role", () => {
    for (const role of APP_USER_ROLES) {
      if (role === "Admin") continue;
      const matrix = DEFAULT_TAS_ROLE_MATRIX[role];
      const roleExpected = EXPECTED[role] ?? {};
      for (const module of TAS_RBAC_MODULES) {
        const expectation = roleExpected[module];
        if (!expectation) expect(matrix[module], `${role}.${module} should not be granted`).toBeUndefined();
        else expect(matrix[module], `${role}.${module}`).toEqual(expectedGrant(expectation));
      }
    }
  });

  it("never grants a non-view action while view is disabled", () => {
    for (const [role, matrix] of Object.entries(DEFAULT_TAS_ROLE_MATRIX)) {
      for (const [module, permission] of Object.entries(matrix)) {
        if (!permission) continue;
        const nonViewGranted = TAS_RBAC_ACTIONS.filter((action) => action !== "view").some((action) => Boolean(permission[action]));
        if (nonViewGranted) expect(permission.view, `${role}.${module} has actions without view`).toBe(true);
      }
    }
  });

  it("uses only supported data scopes", () => {
    for (const [role, matrix] of Object.entries(DEFAULT_TAS_ROLE_MATRIX)) {
      for (const [module, permission] of Object.entries(matrix)) {
        if (!permission) continue;
        expect(TAS_DATA_SCOPES.includes(permission.dataScope), `${role}.${module} has invalid scope ${permission.dataScope}`).toBe(true);
      }
    }
  });

  it("normalizes legacy admin to the protected Admin matrix", () => {
    expect(getLegacyFallbackMatrix("admin")).toEqual(DEFAULT_TAS_ROLE_MATRIX.Admin);
  });

  it("keeps the documented fallback for an unknown legacy role", () => {
    expect(getLegacyFallbackMatrix("UnknownLegacyRole")).toEqual(DEFAULT_TAS_ROLE_MATRIX.SalesAgent);
  });
});
