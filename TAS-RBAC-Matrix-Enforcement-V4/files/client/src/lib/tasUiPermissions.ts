import {
  type TasDataScope,
  type TasRbacAction,
  type TasRbacModule,
  useTasRbac,
} from "@/lib/tasRbac";

export type TasUiModulePermissions = {
  role: string | null;
  loading: boolean;
  dataScope: TasDataScope;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  approve: boolean;
  assign: boolean;
  can: (action: TasRbacAction) => boolean;
};

/**
 * UI-level view of the same matrix configured from /tas/admin/permissions.
 *
 * Pages must use this helper for action visibility/enablement instead of
 * hard-coded role names. Backend authorization remains the security boundary.
 */
export function useTasModuleActions(module: TasRbacModule): TasUiModulePermissions {
  const rbac = useTasRbac();
  const can = (action: TasRbacAction) => rbac.can(module, action);

  return {
    role: rbac.role,
    loading: rbac.isLoading,
    dataScope: rbac.scope(module),
    view: can("view"),
    create: can("create"),
    edit: can("edit"),
    delete: can("delete"),
    export: can("export"),
    approve: can("approve"),
    assign: can("assign"),
    can,
  };
}
