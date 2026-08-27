import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessLegacyRoute } from "@/lib/legacyRolePermissions";
import type { ReactNode } from "react";

export default function LegacyRoleRouteGuard({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const { isRTL } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccessLegacyRoute(user?.role, path)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="text-xl font-bold mb-2">
            {isRTL ? "غير مصرح لك بالوصول" : "Access denied"}
          </div>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "لا يملك هذا الدور صلاحية فتح هذه الصفحة مباشرة."
              : "Your role does not have permission to open this page directly."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
