import type { PropsWithChildren, ReactNode } from "react";
import type { TasRbacAction, TasRbacModule } from "@/lib/tasRbac";
import { useTasModuleActions } from "@/lib/tasUiPermissions";

type Props = PropsWithChildren<{
  module: TasRbacModule;
  action: TasRbacAction;
  fallback?: ReactNode;
}>;

/**
 * Declarative UI action guard backed by the live TAS permission matrix.
 * This is UX enforcement only; server/tasPermissionProcedure remains the
 * security boundary for every mutation/query.
 */
export default function TASPermissionAction({ module, action, fallback = null, children }: Props) {
  const permissions = useTasModuleActions(module);
  if (permissions.loading) return null;
  if (!permissions.can(action)) return <>{fallback}</>;
  return <>{children}</>;
}
